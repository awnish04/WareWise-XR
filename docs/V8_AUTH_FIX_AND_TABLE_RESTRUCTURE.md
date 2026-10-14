# WareWise XR v8 — Auth Fix & Database Restructure

**Date:** 2026-10-06  
**Status:** ✅ Complete

---

## Issues Fixed

### 1. Auto-redirect preventing account switching
**Problem:** Visiting `http://127.0.0.1:8080` when already logged in (e.g., as admin) automatically redirected to the dashboard, making it impossible to sign in as a different user (e.g., trainee) without clearing cookies.

**Solution:**
- Removed auto-redirect from landing page (`js/auth.js`)
- Added "Sign out" button to navbar (visible when logged in)
- Shows helpful message: "Already signed in as {email}. Sign out to switch accounts."
- Users can now explicitly sign out and switch accounts

### 2. Synthetic Neon Auth emails in database
**Problem:** Neon Auth was auto-generating placeholder user identities like `employee.1791264148911.4350da91@example.test` that leaked into the application's `users` table.

**Solution:** Complete database restructure with separate tables and email validation.

---

## Database Restructure (v7 → v8)

### Old Schema (v7)
- `users` — mixed admin + employee accounts
- `training_progress` — training data
- `sessions` — single user_id FK
- `access_events` — audit trail

### New Schema (v8)

| Table | Purpose |
|---|---|
| **`admins`** | Admin accounts only — real email, password hash, `access_count`, `last_login_at` |
| **`trainees`** | Employee accounts — real email, department, status (pending/approved/rejected), approval tracking |
| **`sessions`** | Shared session store — one of `admin_id` or `trainee_id` per row (CHECK enforced) |
| **`trainee_leaderboard`** | Training progress per trainee (replaces `training_progress`) |
| **`leaderboard`** | Dedicated snapshot leaderboard — automatically refreshed on every save |
| **`access_events`** | Full audit trail — `admin_id`/`trainee_id`, `actor_email` snapshot, `actor_role`, timestamp |

### Key Improvements
- **Separate tables** for admins and trainees — no mixed role logic
- **Real email validation** — synthetic Neon Auth addresses are rejected at insert
- **Email snapshots** in `access_events` — actor email stored immediately, readable even after account deletion
- **Dedicated leaderboard table** — automatically updated, optimized for queries
- **Login tracking** — `access_count` and `last_login_at` per account

---

## Code Changes

### `database/schema.sql`
- Dropped old `users`, `training_progress`, all views
- Created 6 new tables with proper constraints
- No `is_real_email()` function — validation is handled in app layer

### `database/db.js`
- Split API: `upsertAdmin`, `findAdminByEmail`, `incrementAdminLoginCount`
- Split API: `createTrainee`, `findTraineeByEmail`, `setTraineeStatus`, `incrementTraineeLoginCount`
- `createSession({ adminId })` or `{ traineeId }` — type-safe session creation
- `getSessionUser()` checks both `admins` and `trainees` tables
- `saveTrainingProgress()` auto-refreshes `leaderboard` snapshot table
- `recordAccessEvent()` takes `{ id, email, role }` actor object — email snapshot stored immediately

### `server.js`
- Rewritten to use split admin/trainee API
- Login route checks admin table first, then trainee table
- Increments `access_count` on every successful login
- Passes full actor object `{ id, email, role }` to `recordAccessEvent`

### `js/auth.js`
- **Removed** auto-redirect on landing page
- Added logout button handler
- On page load: checks if user is logged in, shows logout button + info message if yes
- No automatic redirect — users stay on landing page

### `index.html`
- Added `<button id="logoutButton">` to navbar (hidden by default)

### `css/portal.css`
- Added `.logout-button` styling

### `test/database.test.js`
- Completely rewritten to match new table structure
- All 6 tests pass

---

## Migration Notes

**Data loss:** All old `users` and `training_progress` data was **deleted** during the restructure. This was intentional — the old data contained synthetic Neon Auth placeholder rows.

**Fresh start:** After migration:
- 0 trainees
- 1 admin (seeded on server boot: `admin@warewise.local`)
- All tables empty except `admins`

---

## How to Use

### Starting the Server
```bash
node server.js
```

The admin account is auto-seeded on boot:
- Email: `admin@warewise.local`
- Password: `Admin123!` (or `$WAREWISE_ADMIN_PASSWORD` env var)

### Switching Accounts
1. Visit `http://127.0.0.1:8080`
2. If already logged in, click **"Sign out"** button
3. Select **Employee** or **Administrator** tab
4. Enter credentials and sign in

### Role-Based Access
- `/admin` — admin accounts only
- `/employee` — approved trainee accounts only
- `/training` — approved trainee accounts only
- `/` — public (login page)

---

## Testing

Run the test suite:
```bash
npm test
```

All 6 tests pass:
1. Database connection health
2. Database initialization idempotence
3. Admin upsert + password verification
4. Admin login counter
5. Trainee full lifecycle (create, session, progress, leaderboard, approval)
6. Admin session role resolution

Manual testing checklist: see `test_manual.md`

---

## Files Changed

### Database Layer
- `database/schema.sql` — complete rewrite
- `database/db.js` — complete rewrite
- `database/migrate.js` — unchanged

### Server
- `server.js` — complete rewrite

### Frontend
- `js/auth.js` — auto-redirect removed, logout button added
- `index.html` — logout button added to navbar
- `css/portal.css` — logout button styling

### Tests
- `test/database.test.js` — complete rewrite

### Documentation
- `docs/V8_AUTH_FIX_AND_TABLE_RESTRUCTURE.md` — this file
- `test_manual.md` — manual test plan

---

## Breaking Changes

⚠️ **Old API no longer exists:**
- `createUser` → `createTrainee`
- `findUserByEmailAndRole` → `findAdminByEmail` / `findTraineeByEmail`
- `setUserStatus` → `setTraineeStatus`
- `incrementLoginCount` → `incrementAdminLoginCount` / `incrementTraineeLoginCount`

⚠️ **Old tables dropped:**
- `users`
- `training_progress`
- All old views

---

## What's Next

Suggested improvements for future versions:
- Password reset flow
- Multi-admin support (invite/manage admins from admin console)
- Email notifications (approval confirmations, progress milestones)
- Export leaderboard to CSV
- Trainee self-service profile updates

---

**End of v8 migration notes.**
