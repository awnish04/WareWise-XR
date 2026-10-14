"use strict";

const http   = require("http");
const fs     = require("fs");
const path   = require("path");
const crypto = require("crypto");
const { URL } = require("url");

const {
  databaseReady,
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
  cleanupExpiredSessions,
  moduleCompletion,
  getTrainingProgress,
  startTraining,
  saveTrainingProgress,
  resetTrainingProgress,
  getLeaderboard,
  getAdminOverview,
  recordAccessEvent,
} = require("./database/db");

const ROOT         = __dirname;
const PORT         = Number(process.env.PORT || 8080);
const HOST         = process.env.HOST || "127.0.0.1";
const ADMIN_EMAIL   = (process.env.WAREWISE_ADMIN_EMAIL  || "admin@warewise.local").toLowerCase();
const ADMIN_PASSWORD = process.env.WAREWISE_ADMIN_PASSWORD || "Admin123!";

// ── Helpers ───────────────────────────────────────────────────────────────────

function now() { return new Date().toISOString(); }

function normalizeEmail(v = "") { return String(v).trim().toLowerCase(); }

function defaultState() {
  return {
    score: 0, hazards: [], manualDelivered: 0,
    harness: false, heightPlan: false, heightDone: false,
    whyDone: false, cyberDone: false, unsafeDone: false,
    unsafeActs: [], briefed: false,
    moduleDone: { manual: false, height: false, hazards: false,
                  unsafe: false, why: false, cyber: false },
    highScores: [],
  };
}

function parseCookies(req) {
  const out = {};
  String(req.headers.cookie || "").split(";").forEach((part) => {
    const i = part.indexOf("=");
    if (i < 0) return;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  });
  return out;
}

// Serialise a trainee row for JSON responses (no passwords)
function publicTrainee(t, tl = null) {
  if (!t) return null;
  return {
    id:             t.id,
    role:           "employee",
    name:           t.name,
    email:          t.email,
    department:     t.department || "",
    status:         t.status,
    createdAt:      t.created_at,
    requestedAt:    t.requested_at,
    approvedAt:     t.approved_at   || null,
    rejectedAt:     t.rejected_at   || null,
    accessCount:    t.access_count  || 0,
    lastLoginAt:    t.last_login_at || null,
    bestScore:      tl?.best_score      || t.best_score      || 0,
    bestCompletion: tl?.best_completion || t.best_completion || 0,
    attempts:       tl?.attempts        || t.attempts        || 0,
    lastPlayedAt:   tl?.last_played_at  || t.last_played_at  || null,
  };
}

// Serialise an admin row (no passwords)
function publicAdmin(a) {
  if (!a) return null;
  return {
    id:          a.id,
    role:        "admin",
    name:        a.name,
    email:       a.email,
    department:  a.department || "",
    status:      "approved",
    accessCount: a.access_count  || 0,
    lastLoginAt: a.last_login_at || null,
    createdAt:   a.created_at,
  };
}

// Returns whichever is correct for the given role
function publicUser(u) {
  if (!u) return null;
  return u.role === "admin" ? publicAdmin(u) : publicTrainee(u);
}

function json(res, status, body, headers = {}) {
  const data = Buffer.from(JSON.stringify(body));
  res.writeHead(status, {
    "Content-Type":   "application/json; charset=utf-8",
    "Content-Length": data.length,
    "Cache-Control":  "no-store",
    ...headers,
  });
  res.end(data);
}

function redirect(res, location) {
  res.writeHead(302, { Location: location, "Cache-Control": "no-store" });
  res.end();
}

function readBody(req, max = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > max) { reject(new Error("Request too large")); req.destroy(); }
      else chunks.push(c);
    });
    req.on("end", () => {
      try {
        resolve(chunks.length
          ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {});
      } catch (_) { reject(new Error("Invalid JSON")); }
    });
    req.on("error", reject);
  });
}

function cookieFor(token, role, isSecure = false) {
  // Cookie with 10 year expiration
  const tenYears = 10 * 365 * 24 * 60 * 60;
  const secure = isSecure ? '; Secure' : '';
  const cookieName = role === 'admin' ? 'ww_admin_session' : 'ww_employee_session';
  return `${cookieName}=${encodeURIComponent(token)}; HttpOnly; Path=/; Max-Age=${tenYears}; SameSite=Lax${secure}`;
}

async function currentUser(req, preferredRole = null) {
  const cookies = parseCookies(req);
  const adminToken = cookies.ww_admin_session;
  const employeeToken = cookies.ww_employee_session;
  
  // If a specific role is preferred (for role-specific pages), check that token first
  if (preferredRole === 'admin' && adminToken) {
    console.log('[SESSION] Admin cookie found, length:', adminToken.length);
    const user = await getSessionUser(adminToken);
    if (user && user.role === 'admin') {
      console.log('[SESSION] Admin authenticated:', user.email);
      return user;
    }
  }
  
  if (preferredRole === 'employee' && employeeToken) {
    console.log('[SESSION] Employee cookie found, length:', employeeToken.length);
    const user = await getSessionUser(employeeToken);
    if (user && user.role === 'employee') {
      console.log('[SESSION] Employee authenticated:', user.email);
      return user;
    }
  }
  
  // Fallback: check both cookies if no preference or preferred not found
  if (adminToken) {
    const user = await getSessionUser(adminToken);
    if (user && user.role === 'admin') {
      console.log('[SESSION] Admin authenticated (fallback):', user.email);
      return user;
    }
  }
  
  if (employeeToken) {
    const user = await getSessionUser(employeeToken);
    if (user && user.role === 'employee') {
      console.log('[SESSION] Employee authenticated (fallback):', user.email);
      return user;
    }
  }
  
  console.log('[SESSION] No valid session found');
  return null;
}

async function requireUser(req, res, preferredRole = null) {
  const u = await currentUser(req, preferredRole);
  if (!u) { json(res, 401, { error: "Authentication required" }); return null; }
  return u;
}

async function requireAdmin(req, res) {
  const u = await requireUser(req, res, "admin");
  if (!u) return null;
  if (u.role !== "admin") {
    json(res, 403, { error: "Administrator access required" });
    return null;
  }
  return u;
}

async function requireApprovedEmployee(req, res) {
  const u = await requireUser(req, res, "employee");
  if (!u) return null;
  if (u.role !== "employee" || u.status !== "approved") {
    console.log('[REQUIRE] Employee check failed - role:', u.role, 'status:', u.status);
    json(res, 403, { error: "Approved employee access required" });
    return null;
  }
  return u;
}

function sanitizeState(input = {}) {
  const d       = defaultState();
  const bool    = (k) => !!input[k];
  const strList = (v) =>
    Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(0, 50) : [];
  const moduleDone = {};
  for (const k of Object.keys(d.moduleDone)) moduleDone[k] = !!input?.moduleDone?.[k];
  return {
    score:           Math.max(0, Math.min(100000, Number(input.score) || 0)),
    hazards:         strList(input.hazards),
    manualDelivered: Math.max(0, Math.min(3, Number(input.manualDelivered) || 0)),
    harness:         bool("harness"),
    heightPlan:      bool("heightPlan"),
    heightDone:      bool("heightDone"),
    whyDone:         bool("whyDone"),
    cyberDone:       bool("cyberDone"),
    unsafeDone:      bool("unsafeDone"),
    unsafeActs:      strList(input.unsafeActs),
    briefed:         bool("briefed"),
    moduleDone,
    highScores: Array.isArray(input.highScores) ? input.highScores.slice(0, 10) : [],
  };
}

function formatLeaderboard(rows = []) {
  return rows.map((r, i) => ({
    rank:           r.rank   || i + 1,
    id:             r.id,
    name:           r.name,
    department:     r.department || "",
    bestScore:      r.best_score      || 0,
    bestCompletion: r.best_completion || 0,
    attempts:       r.attempts        || 0,
    totalLogins:    r.total_logins    || 0,
    lastPlayedAt:   r.last_played_at  || null,
    lastLoginAt:    r.last_login_at   || null,
  }));
}

// ── Static file serving ───────────────────────────────────────────────────────

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".js":   "application/javascript; charset=utf-8",
  ".svg":  "image/svg+xml",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
  ".json": "application/json; charset=utf-8",
  ".md":   "text/markdown; charset=utf-8",
  ".txt":  "text/plain; charset=utf-8",
};

function serveFile(res, file) {
  const resolved = path.resolve(file);
  if (!resolved.startsWith(path.resolve(ROOT) + path.sep) &&
      resolved !== path.resolve(ROOT)) {
    return json(res, 403, { error: "Forbidden" });
  }
  fs.stat(resolved, (err, st) => {
    if (err || !st.isFile()) return json(res, 404, { error: "Not found" });
    const ext = path.extname(resolved).toLowerCase();
    res.writeHead(200, {
      "Content-Type":   MIME[ext] || "application/octet-stream",
      "Content-Length": st.size,
      "Cache-Control":  ext === ".html" ? "no-store" : "no-cache",
    });
    fs.createReadStream(resolved).pipe(res);
  });
}

// ── API handler ───────────────────────────────────────────────────────────────

async function handleApi(req, res, url) {
  const p = url.pathname;
  try {

    // ── GET /api/auth/me ──────────────────────────────────────────────────────
    if (p === "/api/auth/me" && req.method === "GET") {
      // Check for role preference in query string (?role=admin or ?role=employee)
      const roleParam = url.searchParams.get('role');
      const preferredRole = roleParam === 'admin' ? 'admin' : roleParam === 'employee' ? 'employee' : null;
      const u = await currentUser(req, preferredRole);
      return json(res, 200, { authenticated: !!u, user: publicUser(u) });
    }

    // ── POST /api/auth/login ──────────────────────────────────────────────────
    if (p === "/api/auth/login" && req.method === "POST") {
      const b    = await readBody(req);
      const email = normalizeEmail(b.email);
      const role  = b.role === "admin" ? "admin" : "employee";

      if (role === "admin") {
        const a = await findAdminByEmail(email, { includePassword: true });
        if (!a || !a.verifyPassword(b.password || ""))
          return json(res, 401, { error: "Email or password is incorrect" });

        const token = crypto.randomBytes(32).toString("hex");
        await createSession({ adminId: a.id }, token);
        await incrementAdminLoginCount(a.id);
        await recordAccessEvent({ id: a.id, email: a.email, role: "admin" },
          "login", { source: "web" });

        console.log('[LOGIN] Admin logged in:', a.email);
        console.log('[LOGIN] Admin session token (first 20 chars):', token.substring(0, 20));

        return json(res, 200,
          { ok: true, user: publicAdmin(a), redirect: "/admin-dashboard" },
          { "Set-Cookie": cookieFor(token, "admin") });
      }

      // Employee login
      const t = await findTraineeByEmail(email, { includePassword: true });
      if (!t || !t.verifyPassword(b.password || ""))
        return json(res, 401, { error: "Email or password is incorrect" });

      const token = crypto.randomBytes(32).toString("hex");
      await createSession({ traineeId: t.id }, token);
      await incrementTraineeLoginCount(t.id);
      await recordAccessEvent({ id: t.id, email: t.email, role: "employee" },
        "login", { source: "web" });

      console.log('[LOGIN] Employee logged in:', t.email);
      console.log('[LOGIN] Employee session token (first 20 chars):', token.substring(0, 20));

      return json(res, 200,
        { ok: true, user: publicTrainee(t), redirect: "/trainee-dashboard" },
        { "Set-Cookie": cookieFor(token, "employee") });
    }

    // ── POST /api/auth/logout ─────────────────────────────────────────────────
    // Role-specific logout
    if (p === "/api/auth/logout" && req.method === "POST") {
      const body = await readBody(req);
      const logoutRole = body.role; // "admin" or "employee" or undefined (logout all)
      const cookies = parseCookies(req);
      const adminToken = cookies.ww_admin_session;
      const employeeToken = cookies.ww_employee_session;
      
      const cookiesToClear = [];
      
      if (logoutRole === "admin") {
        // Logout admin only
        if (adminToken) await clearSession(adminToken);
        cookiesToClear.push("ww_admin_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
        console.log('[LOGOUT] Admin session cleared');
      } else if (logoutRole === "employee") {
        // Logout employee only
        if (employeeToken) await clearSession(employeeToken);
        cookiesToClear.push("ww_employee_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
        console.log('[LOGOUT] Employee session cleared');
      } else {
        // Logout both (default for security)
        if (adminToken) await clearSession(adminToken);
        if (employeeToken) await clearSession(employeeToken);
        cookiesToClear.push("ww_admin_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
        cookiesToClear.push("ww_employee_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
        console.log('[LOGOUT] Both sessions cleared');
      }
      
      return json(res, 200, { ok: true }, {
        "Set-Cookie": cookiesToClear
      });
    }

    // ── POST /api/access/request ──────────────────────────────────────────────
    if (p === "/api/access/request" && req.method === "POST") {
      const b          = await readBody(req);
      const email      = normalizeEmail(b.email);
      const name       = String(b.name       || "").trim();
      const department = String(b.department || "").trim();
      const password   = String(b.password   || "");

      if (name.length < 2)
        return json(res, 400, { error: "Enter your full name" });
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
        return json(res, 400, { error: "Enter a valid work email" });
      if (department.length < 2)
        return json(res, 400, { error: "Enter your department or team" });
      if (password.length < 8)
        return json(res, 400, { error: "Password must contain at least 8 characters" });

      // Check admin email clash
      const existingAdmin = await findAdminByEmail(email);
      if (existingAdmin)
        return json(res, 409, { error: "That email is reserved for an administrator" });

      const existing = await findTraineeByEmail(email);
      if (existing) {
        if (existing.status === "rejected") {
          const withPw = await findTraineeByEmail(email, { includePassword: true });
          if (!withPw || !withPw.verifyPassword(password))
            return json(res, 409, {
              error: "Account was rejected. Use the same password or contact the administrator.",
            });
          await updateTrainee(existing.id, {
            name, department, status: "pending",
            requested_at: new Date().toISOString(), rejected_at: null,
          });
          await recordAccessEvent(
            { id: existing.id, email: existing.email, role: "employee" },
            "request_resubmitted", { department });
          return json(res, 200, {
            ok: true,
            message: "Access request resubmitted. An administrator must approve it before training is unlocked.",
          });
        }
        return json(res, 409, {
          error: existing.status === "approved"
            ? "An approved account already exists for this email. Sign in instead."
            : "An access request already exists for this email.",
        });
      }

      const trainee = await createTrainee({ name, email, department, password, status: "pending" });
      await recordAccessEvent(
        { id: trainee.id, email: trainee.email, role: "employee" },
        "access_request", { department });
      return json(res, 201, {
        ok: true,
        message: "Request submitted. You can sign in now, but training remains locked until an administrator approves the account.",
      });
    }

    // ── GET /api/leaderboard ──────────────────────────────────────────────────
    if (p === "/api/leaderboard" && req.method === "GET") {
      const u = await requireUser(req, res);
      if (!u) return;
      const rows = await getLeaderboard();
      return json(res, 200, { leaderboard: formatLeaderboard(rows) });
    }

    // ── GET /api/training/me ──────────────────────────────────────────────────
    if (p === "/api/training/me" && req.method === "GET") {
      const u = await requireApprovedEmployee(req, res);
      if (!u) return;
      const tl = await getTrainingProgress(u.id);
      return json(res, 200, {
        progress:       tl?.current_state   || defaultState(),
        bestScore:      tl?.best_score      || 0,
        bestCompletion: tl?.best_completion || 0,
        attempts:       tl?.attempts        || 0,
        lastPlayedAt:   tl?.last_played_at  || null,
      });
    }

    // ── POST /api/training/start ──────────────────────────────────────────────
    if (p === "/api/training/start" && req.method === "POST") {
      const u = await requireApprovedEmployee(req, res);
      if (!u) return;
      const attempts = await startTraining(u.id);
      await recordAccessEvent(
        { id: u.id, email: u.email, role: "employee" },
        "training_started", { attempts });
      return json(res, 200, { ok: true, attempts });
    }

    // ── POST /api/training/progress ───────────────────────────────────────────
    if (p === "/api/training/progress" && req.method === "POST") {
      const u     = await requireApprovedEmployee(req, res);
      if (!u) return;
      const b     = await readBody(req);
      const state = sanitizeState(b.state || b);
      const prev  = await getTrainingProgress(u.id);
      await saveTrainingProgress(u.id, state);
      await recordAccessEvent(
        { id: u.id, email: u.email, role: "employee" },
        "training_progress_saved", {
          score:      state.score,
          completion: moduleCompletion(state).percent,
        });
      const completion = moduleCompletion(state);
      return json(res, 200, {
        ok:             true,
        bestScore:      Math.max(prev?.best_score      || 0, state.score),
        bestCompletion: Math.max(prev?.best_completion || 0, completion.percent),
        completion:     completion.percent,
      });
    }

    // ── GET /api/admin/overview ───────────────────────────────────────────────
    if (p === "/api/admin/overview" && req.method === "GET") {
      const a = await requireAdmin(req, res);
      if (!a) return;
      const overview = await getAdminOverview();
      return json(res, 200, {
        counts: {
          pending:   Number(overview.counts.pending),
          approved:  Number(overview.counts.approved),
          rejected:  Number(overview.counts.rejected),
          played:    Number(overview.counts.played),
          completed: Number(overview.counts.completed),
        },
        pending:     overview.pending.map(t => publicTrainee(t)),
        employees:   overview.employees.map(t => publicTrainee(t)),
        leaderboard: formatLeaderboard(overview.leaderboard),
      });
    }

    // ── POST /api/admin/trainees/:id/(approve|reject) ────────────────────────
    const approveM = p.match(/^\/api\/admin\/trainees\/([^/]+)\/(approve|reject)$/);
    if (approveM && req.method === "POST") {
      const a = await requireAdmin(req, res);
      if (!a) return;
      const traineeId = decodeURIComponent(approveM[1]);
      const t = await findTraineeById(traineeId);
      if (!t) return json(res, 404, { error: "Trainee not found" });
      const updated = await setTraineeStatus(
        t.id,
        approveM[2] === "approve" ? "approved" : "rejected",
        a.id,
      );
      return json(res, 200, { ok: true, user: publicTrainee(updated) });
    }

    // ── POST /api/admin/trainees/:id/reset-progress ──────────────────────────
    const resetM = p.match(/^\/api\/admin\/trainees\/([^/]+)\/reset-progress$/);
    if (resetM && req.method === "POST") {
      const a = await requireAdmin(req, res);
      if (!a) return;
      const traineeId = decodeURIComponent(resetM[1]);
      const t = await findTraineeById(traineeId);
      if (!t) return json(res, 404, { error: "Trainee not found" });
      await resetTrainingProgress(t.id, { keep_history: true });
      return json(res, 200, { ok: true });
    }

    return json(res, 404, { error: "API route not found" });

  } catch (err) {
    console.error(err);
    return json(res, 400, { error: err.message || "Request failed" });
  }
}

// ── HTTP server ───────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  if (url.pathname.startsWith("/api/")) return handleApi(req, res, url);

  if (url.pathname === "/")
    return serveFile(res, path.join(ROOT, "index.html"));

  if (url.pathname === "/employee" || url.pathname === "/employee.html" || 
      url.pathname === "/trainee-dashboard" || url.pathname === "/trainee-dashboard.html") {
    const u = await currentUser(req, "employee"); // Prefer employee session
    if (!u) return redirect(res, "/");
    if (u.role !== "employee") return redirect(res, "/admin-dashboard");
    return serveFile(res, path.join(ROOT, "trainee-dashboard.html"));
  }

  if (url.pathname === "/admin" || url.pathname === "/admin.html" ||
      url.pathname === "/admin-dashboard" || url.pathname === "/admin-dashboard.html") {
    const u = await currentUser(req, "admin"); // Prefer admin session
    if (!u) return redirect(res, "/");
    if (u.role !== "admin") return redirect(res, "/trainee-dashboard");
    return serveFile(res, path.join(ROOT, "admin-dashboard.html"));
  }

  if (url.pathname === "/training" || url.pathname === "/training.html" ||
      url.pathname === "/warehouse-training" || url.pathname === "/warehouse-training.html") {
    const u = await currentUser(req, "employee"); // Prefer employee session
    if (!u) return redirect(res, "/");
    if (u.role !== "employee" || u.status !== "approved")
      return redirect(res, "/trainee-dashboard");
    return serveFile(res, path.join(ROOT, "warehouse-training.html"));
  }

  if (url.pathname === "/health")
    return json(res, 200, { ok: true, time: now() });
  
  // Debug endpoint to check session
  if (url.pathname === "/debug/session") {
    const cookies = parseCookies(req);
    const adminUser = await currentUser(req, "admin");
    const employeeUser = await currentUser(req, "employee");
    return json(res, 200, {
      adminCookie: !!cookies.ww_admin_session,
      employeeCookie: !!cookies.ww_employee_session,
      adminAuthenticated: !!adminUser,
      employeeAuthenticated: !!employeeUser,
      adminUser: adminUser ? { email: adminUser.email, role: adminUser.role } : null,
      employeeUser: employeeUser ? { email: employeeUser.email, role: employeeUser.role } : null,
    });
  }

  const clean = decodeURIComponent(url.pathname).replace(/^\/+/, "");
  if (!clean || clean.includes("..") ||
      clean.startsWith("data/") || clean === "server.js")
    return json(res, 404, { error: "Not found" });

  return serveFile(res, path.join(ROOT, clean));
});

// ── Boot ──────────────────────────────────────────────────────────────────────

async function startServer() {
  await databaseReady();
  await upsertAdmin({
    email:      ADMIN_EMAIL,
    password:   ADMIN_PASSWORD,
    name:       "WareWise Training Admin",
    department: "Safety & Training",
  });
  // Sessions no longer expire, so no cleanup needed

  server.listen(PORT, HOST, () => {
    console.log(`\nWareWise XR local server: http://${HOST}:${PORT}`);
    console.log(`Admin email:   ${ADMIN_EMAIL}`);
    console.log("Trainee accounts must request access and be approved in the Admin Console.\n");
  });
}

startServer().catch((err) => {
  console.error("Unable to start WareWise XR:", err.message);
  process.exit(1);
});
