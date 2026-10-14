# Admin Approval Fix

**Date:** 2026-10-06  
**Issue:** "Administrator access required" error when approving trainees from admin dashboard

---

## Problem

When clicking "Approve" or "Reject" in the admin dashboard at `http://127.0.0.1:8080/admin`, the action would fail with:

```
Administrator access required
```

Even though the user **was** logged in as admin.

---

## Root Cause

**Two issues:**

### 1. Route Mismatch (ID vs Email)
- **Frontend** (`js/admin.js`): Sends trainee **UUID** in API call:
  ```javascript
  `/api/admin/users/${id}/approve`
  ```
- **Backend** (`server.js`): Route expected **email** and called `findTraineeByEmail()`:
  ```javascript
  const t = await findTraineeByEmail(decodeURIComponent(approveM[1]));
  ```
- **Result:** `findTraineeByEmail(uuid)` returned `null`, then "not found" response triggered auth check, showing wrong error message

### 2. Field Name Mismatch (snake_case vs camelCase)
- **Database** returns: `requested_at`, `best_score`, `last_played_at`
- **Frontend** expects: `requestedAt`, `bestScore`, `lastPlayedAt`
- **Result:** Frontend tried to display `undefined` values, causing rendering issues

---

## Solution

### 1. Changed API Routes to Use ID Instead of Email

**Backend** (`server.js`):
```javascript
// OLD (email-based):
/api/admin/users/:email/approve
/api/admin/users/:email/reject
/api/admin/users/:email/reset-progress

// NEW (ID-based):
/api/admin/trainees/:id/approve
/api/admin/trainees/:id/reject
/api/admin/trainees/:id/reset-progress
```

Route handlers now call:
- `findTraineeById(traineeId)` instead of `findTraineeByEmail(email)`

**Frontend** (`js/admin.js`):
```javascript
// OLD:
await api(`/api/admin/users/${id}/${action}`, {method:'POST'});

// NEW:
await api(`/api/admin/trainees/${id}/${action}`, {method:'POST'});
```

### 2. Added Field Name Transformation

**Backend** (`server.js`):

Updated `publicTrainee()` helper to handle both merged DB row and separate progress object:
```javascript
function publicTrainee(t, tl = null) {
  return {
    // ... existing fields
    bestScore:      tl?.best_score      || t.best_score      || 0,
    bestCompletion: tl?.best_completion || t.best_completion || 0,
    attempts:       tl?.attempts        || t.attempts        || 0,
    lastPlayedAt:   tl?.last_played_at  || t.last_played_at  || null,
  };
}
```

Applied transformation in `/api/admin/overview` route:
```javascript
return json(res, 200, {
  counts: { ... },
  pending:     overview.pending.map(t => publicTrainee(t)),    // ✅ transformed
  employees:   overview.employees.map(t => publicTrainee(t)),  // ✅ transformed
  leaderboard: formatLeaderboard(overview.leaderboard),
});
```

---

## Files Changed

- `server.js`:
  - Changed routes from `/api/admin/users/:email/*` to `/api/admin/trainees/:id/*`
  - Updated route handlers to use `findTraineeById()` instead of `findTraineeByEmail()`
  - Enhanced `publicTrainee()` to accept merged DB rows (with `best_score` etc.)
  - Added `.map(t => publicTrainee(t))` transformation in admin overview route

- `js/admin.js`:
  - Changed API path from `/api/admin/users/` to `/api/admin/trainees/`

---

## Testing

### Manual Test
1. Start server: `node server.js`
2. Sign in as admin: `admin@warewise.local` / `Admin123!`
3. Have a trainee request access (or use existing pending request)
4. In admin dashboard, click "Approve"
5. ✅ Should succeed without error
6. ✅ Trainee status should change to "approved"
7. ✅ Should see updated count in metrics

### Automated Test
```bash
node -e "
const { createTrainee, findAdminByEmail, setTraineeStatus } = require('./database/db');
// ... test code from earlier output
"
```

---

## Why ID-Based Routes Are Better

**Before (email-based):**
- Email could change (rare, but possible)
- URL encoding issues with special characters in email
- Longer URL strings

**After (ID-based):**
- UUID never changes
- No encoding issues
- Standard RESTful pattern: `/api/resource/:id/action`
- More efficient database lookup (primary key)

---

## Related Routes That Still Work

These routes continue to work correctly:
- `POST /api/auth/login` — still accepts email (for login form)
- `POST /api/access/request` — still accepts email (for signup)
- `GET /api/auth/me` — returns user session
- `GET /api/leaderboard` — public leaderboard

---

**Status:** ✅ **FIXED**

Admin can now approve/reject trainees without errors.
