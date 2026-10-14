# Quick Test: Role Separation

## How to verify admin and employee dashboards stay separate

### Setup
```bash
node server.js
# Server starts at http://127.0.0.1:8080
```

### Test 1: Admin Login and Dashboard Access
1. Go to `http://127.0.0.1:8080`
2. Click **"Administrator sign in"** tab
3. Login with:
   - Email: `admin@warewise.local` (or your admin email)
   - Password: `Admin123!` (or your admin password)
4. **Expected**: Redirected to `/admin-dashboard` with admin console
5. Open browser console (F12) and check for:
   ```
   [ADMIN.JS] Current user: {authenticated: true, user: {role: 'admin', ...}}
   ```
6. **Refresh the page (Cmd+R / Ctrl+R)**
   - **Expected**: Stays on `/admin-dashboard`, does not redirect
7. **Manually navigate to `/trainee-dashboard`**
   - **Expected**: Immediately redirected back to `/admin-dashboard`

✅ Admin dashboard works correctly

---

### Test 2: Employee Login and Dashboard Access
1. **Sign out from admin** (click "Sign out")
2. Go to `http://127.0.0.1:8080`
3. Stay on **"Welcome back"** mode (don't click admin tab)
4. Login with an approved employee account
5. **Expected**: Redirected to `/trainee-dashboard` with employee dashboard
6. Open browser console and check for:
   ```
   [EMPLOYEE.JS] Current user: {authenticated: true, user: {role: 'employee', ...}}
   ```
7. **Refresh the page**
   - **Expected**: Stays on `/trainee-dashboard`, does not redirect
8. **Manually navigate to `/admin-dashboard`**
   - **Expected**: Immediately redirected back to `/trainee-dashboard`

✅ Employee dashboard works correctly

---

### Test 3: Switch Between Accounts (Critical Test)
1. **Login as Admin**
   - Go to `/admin-dashboard` → See admin console ✅
   
2. **WITHOUT signing out, open new tab**
   - Type `http://127.0.0.1:8080` in address bar
   - **Expected**: You're still logged in as admin
   - Try to go to `/trainee-dashboard`
   - **Expected**: Redirected to `/admin-dashboard` ✅

3. **Sign out from admin**

4. **Login as Employee**
   - Go to `/trainee-dashboard` → See employee dashboard ✅

5. **WITHOUT signing out, try to access admin**
   - Manually type `/admin-dashboard` in address bar
   - **Expected**: Redirected back to `/trainee-dashboard` ✅

6. **Refresh employee dashboard multiple times**
   - **Expected**: Stays on `/trainee-dashboard` every time ✅
   - **Check console**: Should show `[EMPLOYEE.JS] Current user` with `role: 'employee'` ✅

✅ Role switching works correctly, no cross-contamination

---

### Test 4: Browser Console Verification

Open browser console (F12 > Console) on any dashboard page and run:

```javascript
// Check current session
fetch('/api/auth/me')
  .then(r => r.json())
  .then(data => console.log('Current user:', data));
```

**Expected output for Admin**:
```json
{
  "authenticated": true,
  "user": {
    "id": 1,
    "role": "admin",
    "email": "admin@warewise.local",
    "name": "WareWise Training Admin"
  }
}
```

**Expected output for Employee**:
```json
{
  "authenticated": true,
  "user": {
    "id": 2,
    "role": "employee",
    "email": "john.doe@company.com",
    "name": "John Doe",
    "status": "approved"
  }
}
```

---

### Test 5: API Security (Advanced)

While logged in as **Employee**, try to access admin API:

```javascript
// In browser console
fetch('/api/admin/overview')
  .then(r => r.json())
  .then(data => console.log(data))
  .catch(err => console.error(err));
```

**Expected**: 
```json
{
  "error": "Administrator access required"
}
```

✅ API endpoints properly reject wrong roles

---

## Common Issues & Solutions

### Issue: Both dashboards show same content after refresh

**Diagnosis**:
1. Open browser console
2. Check what `[ADMIN.JS]` or `[EMPLOYEE.JS]` logs say
3. Run: `document.cookie` to see active cookie

**Solution**:
- Clear browser cookies: `document.cookie = 'ww_session=; Path=/; Max-Age=0'`
- Refresh page
- Login again

### Issue: Redirecting in a loop

**Diagnosis**: Check server logs for session validation

**Solution**:
- Sign out completely
- Clear cookies
- Close all tabs
- Login again fresh

### Issue: "Not authenticated" after refresh in Safari

**See**: `docs/BROWSER_COMPATIBILITY.md` for Safari cookie issues

---

## Success Criteria

✅ Admin can access `/admin-dashboard` only
✅ Employee can access `/trainee-dashboard` only  
✅ Wrong-role access attempts redirect to correct dashboard
✅ Refresh does not change which dashboard you see
✅ Switching accounts works cleanly
✅ API endpoints reject wrong roles with 403
✅ Console logs show correct user role

## If All Tests Pass

Your role-based access control is working correctly! Admin and employee dashboards are fully separated with 3 layers of security.

## If Tests Fail

1. Check server logs for session issues
2. Check browser console for JavaScript errors
3. Clear all cookies and try again
4. Make sure you're using updated `js/admin.js` and `js/employee.js`
5. Verify server.js has correct role-checking logic

---

## Quick Reference

| URL | Admin Access | Employee Access |
|-----|-------------|----------------|
| `/` | ✅ Can visit | ✅ Can visit |
| `/admin-dashboard` | ✅ Allowed | ❌ Redirects to `/trainee-dashboard` |
| `/trainee-dashboard` | ❌ Redirects to `/admin-dashboard` | ✅ Allowed |
| `/warehouse-training` | ❌ Redirects to `/trainee-dashboard` | ✅ If approved |
| `/api/admin/*` | ✅ Allowed | ❌ 403 Error |
| `/api/training/*` | ❌ 403 Error | ✅ Allowed |

---

**Date**: October 6, 2026  
**Version**: WareWiseXR v7.2
