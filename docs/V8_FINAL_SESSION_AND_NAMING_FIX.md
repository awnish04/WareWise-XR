# Session Debugging + File Renaming

**Date:** 2026-10-06  
**Changes:** Added session debugging + renamed files with meaningful names

---

## Changes Made

### 1. Added Comprehensive Session Logging

**Purpose:** Diagnose why sessions aren't persisting across page refreshes

**Added to `server.js`:**

```javascript
// In currentUser():
console.log('[SESSION] No cookie found in request');
console.log('[SESSION] Cookie found, length:', token.length);
console.log('[SESSION] User authenticated:', user.email, '| role:', user.role);
console.log('[SESSION] Token invalid or expired');

// In login handler:
console.log('[LOGIN] Admin logged in:', a.email);
console.log('[LOGIN] Session token (first 20 chars):', token.substring(0, 20));
console.log('[LOGIN] Cookie being set:', cookieFor(token).substring(0, 80));
```

**What to look for in console:**
- ✅ After login: `[LOGIN] Admin logged in:...`
- ✅ On refresh: `[SESSION] Cookie found, length: 64` + `[SESSION] User authenticated:...`
- ❌ If broken: `[SESSION] No cookie found in request`

### 2. Renamed Files with Meaningful Names

**Before → After:**
```
admin.html           → admin-dashboard.html
employee.html        → trainee-dashboard.html
training.html        → warehouse-training.html
index.html           → (unchanged - landing/login page)
```

**Server routes updated:**
- `/admin` → serves `admin-dashboard.html` (old URL still works)
- `/admin-dashboard` → serves `admin-dashboard.html`
- `/employee` → serves `trainee-dashboard.html` (old URL still works)
- `/trainee-dashboard` → serves `trainee-dashboard.html`
- `/training` → serves `warehouse-training.html` (old URL still works)
- `/warehouse-training` → serves `warehouse-training.html`

**Login redirects updated:**
- Admin login → `/admin-dashboard`
- Trainee login → `/trainee-dashboard`

### 3. Added Debug Endpoint

**New route:** `GET /debug/session`

Returns:
```json
{
  "hasCookie": true,
  "cookieValue": "abc123...",
  "authenticated": true,
  "user": { "email": "admin@warewise.local", "role": "admin" }
}
```

Use for testing: `http://127.0.0.1:8080/debug/session`

---

## How to Test

### Step 1: Start Fresh
```bash
# Kill any old server processes
pkill -f "node server.js"

# Start server
node server.js
```

### Step 2: Watch Console
Server should print:
```
WareWise XR local server: http://127.0.0.1:8080
Admin email:   admin@warewise.local
```

### Step 3: Sign In
1. Open: http://127.0.0.1:8080
2. Choose "Administrator"
3. Email: `admin@warewise.local`
4. Password: `Admin123!`
5. Click "Sign in"

**Expected console output:**
```
[LOGIN] Admin logged in: admin@warewise.local
[LOGIN] Session token (first 20 chars): 1a2b3c4d5e6f7g8h9i0j
[LOGIN] Cookie being set: ww_session=1a2b3c4d5e6f7g8h9i0j...
```

### Step 4: Check Dashboard
- URL should be: `http://127.0.0.1:8080/admin-dashboard`
- Page should load

**Expected console output:**
```
[SESSION] Cookie found, length: 64
[SESSION] User authenticated: admin@warewise.local | role: admin
```

### Step 5: Refresh Page (F5 or Cmd+R)
**Expected console output (SAME as Step 4):**
```
[SESSION] Cookie found, length: 64
[SESSION] User authenticated: admin@warewise.local | role: admin
```

**If you see this instead:**
```
[SESSION] No cookie found in request
```
→ Cookie is not being sent by browser! See troubleshooting below.

---

## Troubleshooting

### Issue: Cookie Not Persisting

**Symptom:**
- Sign in works → redirects to dashboard
- Refresh page → redirects back to login
- Console shows: `[SESSION] No cookie found in request`

**Diagnosis:**
1. Open browser DevTools (F12)
2. Go to "Network" tab
3. Refresh page
4. Click on the request to `/admin-dashboard`
5. Check "Request Headers" section
6. Look for `Cookie:` header

**If Cookie header is missing:**
- Browser is not sending the cookie
- Possible causes:
  - SameSite policy blocking
  - Path mismatch
  - Browser security settings
  - Incognito/private mode restrictions

**If Cookie header is present:**
- Cookie IS being sent
- Problem is server-side (database lookup or token hash mismatch)
- Check database:
  ```sql
  SELECT * FROM sessions ORDER BY created_at DESC LIMIT 5;
  ```

### Issue: Old Code Running

**Symptom:** Changes don't take effect

**Solution:**
1. Kill server: `pkill -f "node server.js"`
2. Hard refresh browser: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
3. Start server: `node server.js`

### Issue: Database Connection

**Symptom:** Server hangs on startup

**Solution:**
1. Check `.env.local` has `DATABASE_URL`
2. Check Neon database is accessible
3. Run migration: `npm run migrate`

---

## Session Behavior Summary

**Current implementation:**
- Sessions expire: **100 years** (effectively never)
- Cookie type: **Session cookie** (no Max-Age attribute)
- Cookie settings: `HttpOnly; SameSite=Lax; Path=/`
- Browser behavior: Cookie persists until explicitly logged out

**What SHOULD happen:**
1. Sign in → cookie set → redirect to dashboard
2. Refresh page → cookie sent → authentication succeeds → stay on dashboard
3. Navigate to other pages → cookie sent → stay authenticated
4. Close browser → cookie may persist (browser-dependent)
5. Logout → cookie deleted → redirect to login

**What SHOULD NOT happen:**
1. Sign in → redirect to dashboard
2. Refresh page → no cookie → redirect to login ❌

---

## Files Changed

### Server
- `server.js`
  - Added session logging
  - Updated file paths for renamed HTML files
  - Updated login redirects
  - Added `/debug/session` endpoint

### Frontend
- `js/auth.js`
  - Updated redirect fallback to `/trainee-dashboard`

### HTML Files (renamed)
- `admin-dashboard.html` (was `admin.html`)
- `trainee-dashboard.html` (was `employee.html`)
- `warehouse-training.html` (was `training.html`)

### Documentation
- `TEST_SESSION.md` — comprehensive testing guide
- `docs/V8_FINAL_SESSION_AND_NAMING_FIX.md` — this file

---

## Next Steps

1. **Run the test** (see TEST_SESSION.md)
2. **Check console logs** to see where session breaks
3. **Check browser DevTools** to verify cookie is set/sent
4. **Report findings:**
   - Does cookie appear in browser DevTools?
   - Do console logs show authentication success?
   - Does refresh keep you logged in?

---

**Status:** 🔍 **DEBUGGING ENABLED**

All session operations now log to console. Follow TEST_SESSION.md to diagnose the issue.
