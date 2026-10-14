"use strict";

const { existsSync, readFileSync } = require("node:fs");
const { join } = require("node:path");
const crypto = require("node:crypto");
const { Pool } = require("pg");

// ── Load .env.local ──────────────────────────────────────────────────────────
const localEnvPath = join(__dirname, "..", ".env.local");
if (existsSync(localEnvPath)) {
  for (const line of readFileSync(localEnvPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)\s*$/);
    if (!m || m[1] in process.env) continue;
    process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
  }
}

function getConnectionString() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not configured");
  return url;
}

const pool = new Pool({
  connectionString: getConnectionString(),
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  ssl: { rejectUnauthorized: true },
});

pool.on("error", (err) => console.error("PostgreSQL pool error:", err.message));

// ── Password utilities ────────────────────────────────────────────────────────
function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(String(password), salt, 64).toString("hex");
  return { salt, hash };
}

function verifyPassword(password, stored) {
  try {
    const target     = Buffer.from(stored.hash, "hex");
    const calculated = crypto.scryptSync(String(password), stored.salt, 64);
    return (
      calculated.length === target.length &&
      crypto.timingSafeEqual(calculated, target)
    );
  } catch {
    return false;
  }
}

function normalizeEmail(v = "") {
  return String(v).trim().toLowerCase();
}

function attachVerify(row) {
  if (!row) return row;
  const { password_hash, password_salt } = row;
  return {
    ...row,
    verifyPassword: (pw) =>
      verifyPassword(pw, { hash: password_hash, salt: password_salt }),
  };
}

function stripPassword(row) {
  if (!row) return row;
  const { password_hash: _h, password_salt: _s, ...safe } = row;
  return safe;
}

function parseState(v) {
  return v && typeof v === "object" ? v : {};
}

// ── Schema bootstrap ──────────────────────────────────────────────────────────
async function databaseReady() {
  const sql    = readFileSync(join(__dirname, "schema.sql"), "utf8");
  const client = await pool.connect();
  try {
    await client.query(sql);
  } finally {
    client.release();
  }
}

async function getDbHealth() {
  const client = await pool.connect();
  try {
    const r = await client.query(
      "SELECT current_database() AS database, current_user AS user_name, NOW() AS now",
    );
    return { ok: true, ...r.rows[0] };
  } catch (err) {
    return { ok: false, error: err.message };
  } finally {
    client.release();
  }
}

// ════════════════════════════════════════════════════════════════
// ADMINS
// ════════════════════════════════════════════════════════════════

async function upsertAdmin({ email, password, name, department = "Safety & Training" }) {
  const { hash, salt } = hashPassword(password);
  const client = await pool.connect();
  try {
    const r = await client.query(
      `INSERT INTO admins (name, email, department, password_hash, password_salt)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email) DO UPDATE SET
         name          = EXCLUDED.name,
         department    = EXCLUDED.department,
         password_hash = EXCLUDED.password_hash,
         password_salt = EXCLUDED.password_salt,
         updated_at    = NOW()
       RETURNING *`,
      [name, normalizeEmail(email), department, hash, salt],
    );
    return r.rows[0];
  } finally {
    client.release();
  }
}

async function findAdminByEmail(email, options = {}) {
  const r = await pool.query(
    "SELECT * FROM admins WHERE email = $1",
    [normalizeEmail(email)],
  );
  const row = r.rows[0];
  if (!row) return null;
  return options.includePassword ? attachVerify(row) : stripPassword(row);
}

async function incrementAdminLoginCount(adminId) {
  await pool.query(
    `UPDATE admins
     SET access_count  = access_count + 1,
         last_login_at = NOW(),
         updated_at    = NOW()
     WHERE id = $1`,
    [adminId],
  );
}

// ════════════════════════════════════════════════════════════════
// TRAINEES
// ════════════════════════════════════════════════════════════════

async function createTrainee({ name, email, department, password, status = "pending" }) {
  const { hash, salt } = hashPassword(password);
  const client = await pool.connect();
  try {
    const r = await client.query(
      `INSERT INTO trainees
         (name, email, department, status, password_hash, password_salt, requested_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING *`,
      [name, normalizeEmail(email), department, status, hash, salt],
    );
    return r.rows[0];
  } finally {
    client.release();
  }
}

async function findTraineeByEmail(email, options = {}) {
  const r = await pool.query(
    "SELECT * FROM trainees WHERE email = $1",
    [normalizeEmail(email)],
  );
  const row = r.rows[0];
  if (!row) return null;
  return options.includePassword ? attachVerify(row) : stripPassword(row);
}

async function findTraineeById(id) {
  const r = await pool.query("SELECT * FROM trainees WHERE id = $1", [id]);
  return r.rows[0] ? stripPassword(r.rows[0]) : null;
}

async function updateTrainee(id, changes) {
  const fields = [], values = [];
  let i = 1;
  for (const [k, v] of Object.entries(changes)) {
    if (v === undefined) continue;
    fields.push(`${k} = $${i}`);
    values.push(v);
    i++;
  }
  if (!fields.length) return null;
  fields.push(`updated_at = NOW()`);
  const r = await pool.query(
    `UPDATE trainees SET ${fields.join(", ")} WHERE id = $${i} RETURNING *`,
    [...values, id],
  );
  return r.rows[0] ? stripPassword(r.rows[0]) : null;
}

async function setTraineeStatus(traineeId, status, approvedByAdminId = null) {
  const allowed = ["pending", "approved", "rejected"];
  if (!allowed.includes(status)) throw new Error("Invalid status");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const snap = await client.query(
      "SELECT email FROM trainees WHERE id = $1", [traineeId]
    );
    const actorEmail = snap.rows[0]?.email || null;

    const r = await client.query(
      `UPDATE trainees SET
         status      = $1,
         approved_at = CASE WHEN $1 = 'approved' THEN NOW() ELSE approved_at END,
         rejected_at = CASE WHEN $1 = 'rejected' THEN NOW() ELSE rejected_at END,
         approved_by = CASE WHEN $1 = 'approved' THEN $2::uuid ELSE NULL END,
         updated_at  = NOW()
       WHERE id = $3
       RETURNING *`,
      [status, approvedByAdminId, traineeId],
    );

    await client.query(
      `INSERT INTO access_events
         (trainee_id, actor_email, actor_role, event_type, event_details)
       VALUES ($1, $2, 'trainee', $3, $4)`,
      [
        traineeId,
        actorEmail,
        status === "approved" ? "approval" : "rejection",
        JSON.stringify({ approved_by: approvedByAdminId }),
      ],
    );

    await client.query("COMMIT");
    return r.rows[0] ? stripPassword(r.rows[0]) : null;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function incrementTraineeLoginCount(traineeId) {
  await pool.query(
    `UPDATE trainees
     SET access_count  = access_count + 1,
         last_login_at = NOW(),
         updated_at    = NOW()
     WHERE id = $1`,
    [traineeId],
  );
}

// ════════════════════════════════════════════════════════════════
// SESSIONS  (shared for admins and trainees)
// ════════════════════════════════════════════════════════════════

function _tokenHash(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

async function createSession({ adminId = null, traineeId = null }, token) {
  if (!adminId && !traineeId) throw new Error("Session needs adminId or traineeId");
  const hash   = _tokenHash(token);
  // Set expires_at to far future (100 years) — sessions never expire
  const expiresAt = new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString();
  const client = await pool.connect();
  try {
    const r = await client.query(
      `INSERT INTO sessions (admin_id, trainee_id, token_hash, expires_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (token_hash) DO UPDATE SET
         expires_at   = EXCLUDED.expires_at,
         last_seen_at = NOW()
       RETURNING *`,
      [adminId, traineeId, hash, expiresAt],
    );
    return r.rows[0];
  } finally {
    client.release();
  }
}

async function getSessionUser(token) {
  const hash   = _tokenHash(token);
  const client = await pool.connect();
  try {
    // Try admin session first
    const adminQ = await client.query(
      `SELECT a.*, 'admin' AS role
       FROM sessions s
       JOIN admins a ON a.id = s.admin_id
       WHERE s.token_hash = $1 AND s.expires_at > NOW()`,
      [hash],
    );
    if (adminQ.rows[0]) {
      await client.query(
        "UPDATE sessions SET last_seen_at = NOW() WHERE token_hash = $1", [hash]
      );
      return { ...stripPassword(adminQ.rows[0]), role: "admin" };
    }

    // Try trainee session
    const traineeQ = await client.query(
      `SELECT t.*, 'employee' AS role
       FROM sessions s
       JOIN trainees t ON t.id = s.trainee_id
       WHERE s.token_hash = $1 AND s.expires_at > NOW()`,
      [hash],
    );
    if (traineeQ.rows[0]) {
      await client.query(
        "UPDATE sessions SET last_seen_at = NOW() WHERE token_hash = $1", [hash]
      );
      return { ...stripPassword(traineeQ.rows[0]), role: "employee" };
    }

    return null;
  } finally {
    client.release();
  }
}

async function clearSession(token) {
  await pool.query(
    "DELETE FROM sessions WHERE token_hash = $1", [_tokenHash(token)]
  );
}

async function cleanupExpiredSessions() {
  await pool.query("DELETE FROM sessions WHERE expires_at <= NOW()");
}

// ════════════════════════════════════════════════════════════════
// TRAINEE LEADERBOARD  (training progress)
// ════════════════════════════════════════════════════════════════

function moduleCompletion(state) {
  const keys  = ["manual", "height", "hazards", "unsafe", "why", "cyber"];
  const count = keys.filter((k) => !!state?.moduleDone?.[k]).length;
  return { count, percent: Math.round((count / 6) * 100) };
}

async function getTrainingProgress(traineeId) {
  const r = await pool.query(
    "SELECT * FROM trainee_leaderboard WHERE trainee_id = $1", [traineeId]
  );
  return r.rows[0] || null;
}

async function startTraining(traineeId) {
  const r = await pool.query(
    `INSERT INTO trainee_leaderboard
       (trainee_id, current_state, best_score, best_completion, attempts,
        last_started_at, last_played_at, updated_at)
     VALUES ($1, '{}', 0, 0, 1, NOW(), NOW(), NOW())
     ON CONFLICT (trainee_id) DO UPDATE SET
       attempts        = trainee_leaderboard.attempts + 1,
       last_started_at = NOW(),
       updated_at      = NOW()
     RETURNING attempts`,
    [traineeId],
  );
  return r.rows[0].attempts;
}

async function saveTrainingProgress(traineeId, state) {
  const next       = parseState(state);
  const completion = moduleCompletion(next);
  const now        = new Date().toISOString();

  const r = await pool.query(
    `INSERT INTO trainee_leaderboard
       (trainee_id, current_state, best_score, best_completion, attempts,
        last_started_at, last_played_at, updated_at)
     VALUES ($1, $2, $3, $4,
             COALESCE((SELECT attempts FROM trainee_leaderboard WHERE trainee_id = $1), 0),
             NOW(), $5, $5)
     ON CONFLICT (trainee_id) DO UPDATE SET
       current_state   = EXCLUDED.current_state,
       best_score      = GREATEST(trainee_leaderboard.best_score, EXCLUDED.best_score),
       best_completion = GREATEST(trainee_leaderboard.best_completion, EXCLUDED.best_completion),
       last_played_at  = EXCLUDED.last_played_at,
       updated_at      = EXCLUDED.updated_at
     RETURNING *`,
    [traineeId, next, Number(next.score) || 0, completion.percent, now],
  );

  // Refresh the dedicated leaderboard snapshot
  await _refreshLeaderboardEntry(traineeId);

  return r.rows[0];
}

async function resetTrainingProgress(traineeId, options = {}) {
  const { keep_history = true } = options;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const snap = await client.query(
      "SELECT email FROM trainees WHERE id = $1", [traineeId]
    );
    const actorEmail = snap.rows[0]?.email || null;

    const prev = await client.query(
      `SELECT best_score, best_completion, attempts, last_played_at
       FROM trainee_leaderboard WHERE trainee_id = $1`,
      [traineeId],
    );
    const p = prev.rows[0] || {
      best_score: 0, best_completion: 0, attempts: 0, last_played_at: null
    };

    const blank = {
      score: 0, hazards: [], manualDelivered: 0,
      harness: false, heightPlan: false, heightDone: false,
      whyDone: false, cyberDone: false, unsafeDone: false,
      unsafeActs: [], briefed: false,
      moduleDone: { manual: false, height: false, hazards: false,
                    unsafe: false, why: false, cyber: false },
      highScores: [],
    };

    await client.query(
      `INSERT INTO trainee_leaderboard
         (trainee_id, current_state, best_score, best_completion, attempts,
          last_played_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       ON CONFLICT (trainee_id) DO UPDATE SET
         current_state   = EXCLUDED.current_state,
         best_score      = CASE WHEN $7 THEN trainee_leaderboard.best_score      ELSE 0 END,
         best_completion = CASE WHEN $7 THEN trainee_leaderboard.best_completion ELSE 0 END,
         attempts        = CASE WHEN $7 THEN trainee_leaderboard.attempts        ELSE 0 END,
         last_played_at  = EXCLUDED.last_played_at,
         updated_at      = NOW()`,
      [
        traineeId, blank,
        keep_history ? p.best_score       : 0,
        keep_history ? p.best_completion  : 0,
        keep_history ? p.attempts         : 0,
        p.last_played_at, keep_history,
      ],
    );

    await client.query(
      `INSERT INTO access_events
         (trainee_id, actor_email, actor_role, event_type, event_details)
       VALUES ($1, $2, 'trainee', 'training_progress_reset', $3)`,
      [traineeId, actorEmail, JSON.stringify({ keep_history })],
    );

    await client.query("COMMIT");

    // Refresh leaderboard snapshot
    await _refreshLeaderboardEntry(traineeId);

    return getTrainingProgress(traineeId);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// ════════════════════════════════════════════════════════════════
// LEADERBOARD  (dedicated snapshot table)
// ════════════════════════════════════════════════════════════════

async function _refreshLeaderboardEntry(traineeId) {
  // Upserts one row in the leaderboard table from current trainee + progress data
  await pool.query(
    `INSERT INTO leaderboard
       (trainee_id, trainee_name, trainee_email, department,
        best_score, best_completion, total_attempts, total_logins,
        last_played_at, last_login_at, updated_at)
     SELECT
       t.id, t.name, t.email, COALESCE(t.department, ''),
       COALESCE(tl.best_score,      0),
       COALESCE(tl.best_completion, 0),
       COALESCE(tl.attempts,        0),
       t.access_count,
       tl.last_played_at,
       t.last_login_at,
       NOW()
     FROM trainees t
     LEFT JOIN trainee_leaderboard tl ON tl.trainee_id = t.id
     WHERE t.id = $1
       AND t.status = 'approved'
       AND COALESCE(tl.attempts, 0) > 0
     ON CONFLICT (trainee_id) DO UPDATE SET
       trainee_name    = EXCLUDED.trainee_name,
       trainee_email   = EXCLUDED.trainee_email,
       department      = EXCLUDED.department,
       best_score      = EXCLUDED.best_score,
       best_completion = EXCLUDED.best_completion,
       total_attempts  = EXCLUDED.total_attempts,
       total_logins    = EXCLUDED.total_logins,
       last_played_at  = EXCLUDED.last_played_at,
       last_login_at   = EXCLUDED.last_login_at,
       updated_at      = NOW()`,
    [traineeId],
  );
}

async function getLeaderboard() {
  const r = await pool.query(
    `SELECT
       ROW_NUMBER() OVER (
         ORDER BY best_score DESC, best_completion DESC, trainee_name ASC
       ) AS rank,
       trainee_id       AS id,
       trainee_name     AS name,
       trainee_email    AS email,
       department,
       best_score,
       best_completion,
       total_attempts   AS attempts,
       total_logins,
       last_played_at,
       last_login_at
     FROM leaderboard
     ORDER BY best_score DESC, best_completion DESC, trainee_name ASC`,
  );
  return r.rows;
}

// ════════════════════════════════════════════════════════════════
// ACCESS EVENTS
// ════════════════════════════════════════════════════════════════

async function recordAccessEvent(actor, eventType, details = {}) {
  // actor: { id, email, role }  – role is 'admin' or 'employee'/'trainee'
  const isAdmin   = actor?.role === "admin";
  const adminId   = isAdmin ? actor.id   : null;
  const traineeId = isAdmin ? null       : actor.id;
  const actorRole = isAdmin ? "admin"    : "trainee";

  const r = await pool.query(
    `INSERT INTO access_events
       (admin_id, trainee_id, actor_email, actor_role, event_type, event_details)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [adminId, traineeId, actor?.email || null, actorRole, eventType, details],
  );
  return r.rows[0];
}

// ════════════════════════════════════════════════════════════════
// ADMIN OVERVIEW  (for admin console)
// ════════════════════════════════════════════════════════════════

async function getAdminOverview() {
  const counts = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'pending')   AS pending,
       COUNT(*) FILTER (WHERE status = 'approved')  AS approved,
       COUNT(*) FILTER (WHERE status = 'rejected')  AS rejected,
       COUNT(*) FILTER (WHERE status = 'approved'
         AND (SELECT attempts FROM trainee_leaderboard
              WHERE trainee_id = trainees.id) > 0)  AS played,
       COUNT(*) FILTER (WHERE status = 'approved'
         AND (SELECT best_completion FROM trainee_leaderboard
              WHERE trainee_id = trainees.id) >= 100) AS completed
     FROM trainees`,
  );

  const employees = await pool.query(
    `SELECT
       t.id, t.name, t.email, t.department, t.status,
       t.created_at, t.requested_at, t.approved_at, t.rejected_at,
       t.access_count, t.last_login_at,
       COALESCE(tl.best_score,      0) AS best_score,
       COALESCE(tl.best_completion, 0) AS best_completion,
       COALESCE(tl.attempts,        0) AS attempts,
       tl.last_played_at
     FROM trainees t
     LEFT JOIN trainee_leaderboard tl ON tl.trainee_id = t.id
     ORDER BY t.name ASC`,
  );

  const pending = await pool.query(
    `SELECT
       t.id, t.name, t.email, t.department, t.status,
       t.created_at, t.requested_at, t.approved_at, t.rejected_at,
       t.access_count, t.last_login_at,
       COALESCE(tl.best_score,      0) AS best_score,
       COALESCE(tl.best_completion, 0) AS best_completion,
       COALESCE(tl.attempts,        0) AS attempts,
       tl.last_played_at
     FROM trainees t
     LEFT JOIN trainee_leaderboard tl ON tl.trainee_id = t.id
     WHERE t.status = 'pending'
     ORDER BY t.requested_at ASC`,
  );

  return {
    counts:     counts.rows[0],
    employees:  employees.rows,
    pending:    pending.rows,
    leaderboard: await getLeaderboard(),
  };
}

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
  pool,
  databaseReady,
  getDbHealth,
  getConnectionString,
  hashPassword,
  verifyPassword,
  normalizeEmail,
  // admins
  upsertAdmin,
  findAdminByEmail,
  incrementAdminLoginCount,
  // trainees
  createTrainee,
  findTraineeByEmail,
  findTraineeById,
  updateTrainee,
  setTraineeStatus,
  incrementTraineeLoginCount,
  // sessions
  createSession,
  getSessionUser,
  clearSession,
  cleanupExpiredSessions,
  // training progress
  moduleCompletion,
  getTrainingProgress,
  startTraining,
  saveTrainingProgress,
  resetTrainingProgress,
  // leaderboard
  getLeaderboard,
  // admin overview
  getAdminOverview,
  // access events
  recordAccessEvent,
};
