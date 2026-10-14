"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  databaseReady,
  getDbHealth,
  upsertAdmin,
  findAdminByEmail,
  incrementAdminLoginCount,
  createTrainee,
  findTraineeByEmail,
  findTraineeById,
  updateTrainee,
  setTraineeStatus,
  incrementTraineeLoginCount,
  createSession,
  getSessionUser,
  clearSession,
  getTrainingProgress,
  startTraining,
  saveTrainingProgress,
  resetTrainingProgress,
  getLeaderboard,
  getAdminOverview,
  recordAccessEvent,
} = require("../database/db");

test.before(async () => {
  await databaseReady();
});

// ── Connectivity ──────────────────────────────────────────────────────────────

test("database exposes a working Neon connection", async () => {
  const h = await getDbHealth();
  assert.equal(h.ok, true);
  assert.equal(typeof h.database, "string");
});

test("database initialisation is idempotent", async () => {
  await databaseReady();
  await databaseReady();
  assert.equal((await getDbHealth()).ok, true);
});

// ── Admins ────────────────────────────────────────────────────────────────────

test("admin upsert stores a real email and verifies password", async () => {
  const admin = await upsertAdmin({
    email: "admin@warewise.local",
    password: "Admin123!",
    name: "WareWise Training Admin",
    department: "Safety & Training",
  });
  assert.equal(admin.email, "admin@warewise.local");
  assert.ok(admin.password_hash);

  const found = await findAdminByEmail("admin@warewise.local", {
    includePassword: true,
  });
  assert.equal(found.email, "admin@warewise.local");
  assert.equal(typeof found.verifyPassword, "function");
  assert.equal(found.verifyPassword("Admin123!"), true);
  assert.equal(found.verifyPassword("wrong"), false);
});

test("incrementAdminLoginCount updates access_count and last_login_at", async () => {
  const admin = await upsertAdmin({
    email: "admin@warewise.local",
    password: "Admin123!",
    name: "Admin",
  });
  await incrementAdminLoginCount(admin.id);
  const updated = await findAdminByEmail("admin@warewise.local");
  assert.ok(updated.access_count >= 1);
  assert.ok(updated.last_login_at);
});

// ── Trainees ──────────────────────────────────────────────────────────────────

test("trainees, sessions, training progress and leaderboard persist in Postgres", async () => {
  // Use a real-looking email so the DB accepts it
  const tag = Date.now();
  const email = `testemployee.${tag}@warewise-test.local`;

  // Create trainee
  const trainee = await createTrainee({
    name: "Test Employee",
    email,
    department: "Safety",
    password: "StrongPassword123!",
    status: "pending",
  });
  assert.equal(trainee.email, email);
  assert.equal(trainee.status, "pending");
  assert.ok(trainee.password_hash);

  // Find by email
  const found = await findTraineeByEmail(email);
  assert.equal(found.id, trainee.id);
  assert.equal(found.status, "pending");

  // Password verify
  const withPw = await findTraineeByEmail(email, { includePassword: true });
  assert.equal(typeof withPw.verifyPassword, "function");
  assert.equal(withPw.verifyPassword("StrongPassword123!"), true);
  assert.equal(withPw.verifyPassword("wrong"), false);

  // Find by id
  const byId = await findTraineeById(trainee.id);
  assert.equal(byId.id, trainee.id);

  // Session for trainee
  const token = `session-token-${tag}`;
  const session = await createSession({ traineeId: trainee.id }, token);
  assert.equal(session.trainee_id, trainee.id);

  const sessionUser = await getSessionUser(token);
  assert.equal(sessionUser.id, trainee.id);
  assert.equal(sessionUser.role, "employee");
  await clearSession(token);
  assert.equal(await getSessionUser(token), null);

  // Training progress
  await startTraining(trainee.id);
  await saveTrainingProgress(trainee.id, {
    score: 95,
    hazards: ["missing PPE"],
    moduleDone: {
      manual: true,
      height: false,
      hazards: true,
      unsafe: false,
      why: false,
      cyber: false,
    },
    unsafeActs: ["unsafe ladder use"],
  });

  const progress = await getTrainingProgress(trainee.id);
  assert.equal(progress.best_score, 95);
  assert.equal(progress.best_completion, 33);
  assert.equal(progress.current_state.score, 95);
  assert.equal(progress.current_state.hazards[0], "missing PPE");
  assert.equal(progress.attempts, 1);

  // Approve and check leaderboard
  const admin = await upsertAdmin({
    email: "admin@warewise.local",
    password: "Admin123!",
    name: "Admin",
  });
  await setTraineeStatus(trainee.id, "approved", admin.id);

  // Re-save progress so the leaderboard snapshot gets refreshed
  await saveTrainingProgress(trainee.id, {
    score: 95,
    moduleDone: {
      manual: true,
      height: false,
      hazards: true,
      unsafe: false,
      why: false,
      cyber: false,
    },
  });

  const lb = await getLeaderboard();
  assert.ok(lb.some((e) => e.email === email));

  // Access event
  await recordAccessEvent(
    { id: trainee.id, email, role: "employee" },
    "login",
    { ip: "127.0.0.1" },
  );

  // Admin overview
  const overview = await getAdminOverview();
  assert.ok(
    (overview.counts && typeof overview.counts.approved === "string") ||
      typeof overview.counts.approved === "number",
  );

  // Reset progress (keep history)
  await resetTrainingProgress(trainee.id, { keep_history: true });
  const reset = await getTrainingProgress(trainee.id);
  assert.equal(reset.best_score, 95); // history kept
  assert.equal(reset.attempts, 1); // history kept
  assert.equal(reset.current_state.score, 0); // live state cleared

  // Login counter
  await incrementTraineeLoginCount(trainee.id);
  const updated = await findTraineeById(trainee.id);
  assert.ok(updated.access_count >= 1);
  assert.ok(updated.last_login_at);
});

// ── Admin session ─────────────────────────────────────────────────────────────

test("admin session resolves to role=admin", async () => {
  const admin = await upsertAdmin({
    email: "admin@warewise.local",
    password: "Admin123!",
    name: "Admin",
  });
  const token = `admin-session-${Date.now()}`;
  await createSession({ adminId: admin.id }, token);
  const u = await getSessionUser(token);
  assert.equal(u.role, "admin");
  assert.equal(u.email, "admin@warewise.local");
  await clearSession(token);
});
