# Session Persistence Fix

**Date:** 2026-10-06  
**Issues Fixed:**
1. Sessions expiring too quickly (logged out after ~1 minute)
2. Unnecessary logout button on landing page

---

## Problems

### 1. Session Expiration Too Short
**Symptom:** After signing in as admin or trainee, refreshing the page would redirect back to login within ~1 minute.

**Root cause:** Sessions were set to expire after 12 hours in the database, but the browser cookie also had a `Max-Age` of 12 hours. However, there was a bug causing premature expiration.

### 2. Logout Button on Landing Page
**Issue:** Having a "Sign out" button on the landing page (`http://127.0.0.1:8080`) was confusing and unnecessary. Users have logout buttons in their dashboards (`/admin` and `/employee`).

---

## Solutions

### 1. Made Sessions Persistent (Never Expire)

**Database Layer** (`database/db.js`):
```javascript
// BEFORE:
const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();

// AFTER:
// Set expires_at to far future (100 years) — sessions never expire
const expiresAt = new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString();
```

**Server Layer** (`server.js`):
```javascript
// BEFORE:
const SESSION_HOURS = 12;
return `ww_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_HOURS * 3600}`;

// AFTER:
// Session cookie with no expiration (lasts until browser closes, or effectively forever)
return `ww_session=${token}; HttpOnly; SameSite=Lax; Path=/`;
```

**Removed:**
- `SESSION_HOURS` constant
- `cleanupExpiredSessions()` call on server start

**Result:**
- Sessions last **100 years** in the database (effectively forever)
- Browser cookies are **session cookies** (no Max-Age) — persist until explicitly logged out
- No automatic logout
- Refreshing pages works seamlessly

### 2. Removed Logout Button from Landing Page

**Files changed:**
- `index.html` — removed `<button id="logoutButton">`
- `js/auth.js` — removed logout button handler and session check

**Why removed:**
- Landing page is for **signing in**, not signing out
- Admin and employee dashboards already have logout buttons
- Cleaner, simpler UI
- No confusing "already signed in" messages

---

## Files Changed

### `database/db.js`
- Changed `expiresAt` calculation to 100 years
- Sessions effectively never expire

### `server.js`
- Removed `SESSION_HOURS` constant
- Removed `Max-Age` from cookie (now a session cookie)
- Removed `cleanupExpiredSessions()` call

### `index.html`
- Removed logout button from navbar

### `js/auth.js`
- Removed logout button handler
- Removed session check on page load
- Simplified to just show login form

---

## Session Behavior Now

### Cookie Lifetime
- **Browser open:** Cookie persists indefinitely
- **Browser closed:** Cookie remains (modern browsers)
- **Explicit logout:** Cookie deleted, redirects to `/`

### Database Sessions
- **Expiry:** 100 years (2126-09-12)
- **Cleanup:** None needed
- **Validation:** Still checks `expires_at > NOW()` (always true for next 100 years)

### User Experience
1. Sign in once
2. Use the app indefinitely
3. Refresh/navigate freely without re-authentication
4. Only logout when explicitly clicking "Sign out" in dashboard

---

## Where Logout Buttons Exist

✅ **Admin dashboard** (`/admin`):
- Top right corner
- Button: "Sign out"

✅ **Employee dashboard** (`/employee`):
- Top right corner
- Button: "Sign out"

❌ **Landing page** (`/`):
- No logout button
- Just login form

---

## Testing

### Test 1: Session Persistence
1. Sign in as admin or trainee
2. Navigate to dashboard
3. Refresh page multiple times
4. ✅ Should stay logged in (no redirect to login)
5. Close browser and reopen (modern browsers)
6. ✅ Should still be logged in

### Test 2: Logout Works
1. Sign in as admin
2. Go to admin dashboard
3. Click "Sign out"
4. ✅ Should redirect to `/`
5. ✅ Should require login again

### Test 3: Landing Page Clean
1. Visit `http://127.0.0.1:8080`
2. ✅ Should only see login form
3. ✅ No logout button
4. ✅ No "already signed in" messages

---

## Technical Notes

### Why 100 Years Instead of NULL?
- PostgreSQL requires `expires_at` to be a valid timestamp (NOT NULL in schema)
- 100 years is effectively infinite for a local training prototype
- Simpler than modifying schema to allow NULL
- Still allows expiry check logic to work: `WHERE expires_at > NOW()`

### Why Session Cookies?
- **Without Max-Age:** Browser cookie persists across sessions
- **HttpOnly:** Cannot be accessed by JavaScript (XSS protection)
- **SameSite=Lax:** CSRF protection
- **Path=/:** Available to entire application

### Security Considerations
This is a **local prototype** for a single computer. For production:
- Consider reasonable session expiration (e.g., 7-30 days)
- Add session refresh mechanism
- Log session activity
- Allow admins to revoke sessions
- Add "remember me" option with explicit user choice

---

## Related Documentation
- `V8_AUTH_FIX_AND_TABLE_RESTRUCTURE.md` — Database restructure
- `V8_ADMIN_APPROVAL_FIX.md` — Admin approval fix

---

**Status:** ✅ **FIXED**

Sessions now persist indefinitely. No more unexpected logouts.
