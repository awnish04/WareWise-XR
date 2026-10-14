# Training Access Issue Fix

## Problem
Employee gets "Approved employee access required" error when trying to access `/warehouse-training`, even though they are approved.

## Root Cause
The `requireApprovedEmployee()` function was not passing the role preference to `currentUser()`, so it might check the admin session instead of the employee session.

## Fix Applied

### 1. Updated `requireUser()` to accept role preference
```javascript
// Before
async function requireUser(req, res) {
  const u = await currentUser(req); // ❌ No role preference
  ...
}

// After
async function requireUser(req, res, preferredRole = null) {
  const u = await currentUser(req, preferredRole); // ✅ Pass role preference
  ...
}
```

### 2. Updated `requireAdmin()` to prefer admin session
```javascript
async function requireAdmin(req, res) {
  const u = await requireUser(req, res, "admin"); // ✅ Prefer admin cookie
  ...
}
```

### 3. Updated `requireApprovedEmployee()` to prefer employee session
```javascript
async function requireApprovedEmployee(req, res) {
  const u = await requireUser(req, res, "employee"); // ✅ Prefer employee cookie
  if (!u) return null;
  if (u.role !== "employee" || u.status !== "approved") {
    console.log('[REQUIRE] Employee check failed - role:', u.role, 'status:', u.status);
    json(res, 403, { error: "Approved employee access required" });
    return null;
  }
  return u;
}
```

### 4. Enhanced training-loader.js debugging
```javascript
const me = await api('/api/auth/me?role=employee');
console.log('[TRAINING-LOADER] Auth check:', me);

if(!me.authenticated){
  console.error('[TRAINING-LOADER] Not authenticated');
  location.href='/trainee-dashboard';
  return;
}

if(me.user?.role!=='employee'){
  console.error('[TRAINING-LOADER] Wrong role:', me.user?.role);
  location.href='/trainee-dashboard';
  return;
}

if(me.user?.status!=='approved'){
  console.error('[TRAINING-LOADER] Not approved, status:', me.user?.status);
  location.href='/trainee-dashboard';
  return;
}
```

## Testing Steps

### Step 1: Restart Server
```bash
# Stop current server (Ctrl+C if running)
node server.js
```

### Step 2: Clear Old Sessions
Open browser console (F12) and run:
```javascript
// Clear all old cookies
document.cookie = 'ww_session=; Path=/; Max-Age=0';
document.cookie = 'ww_admin_session=; Path=/; Max-Age=0';
document.cookie = 'ww_employee_session=; Path=/; Max-Age=0';

// Reload
location.href = '/';
```

### Step 3: Fresh Login as Employee
1. Go to `http://127.0.0.1:8080`
2. Stay on "Welcome back" mode
3. Login with **approved** employee account
4. You should see `/trainee-dashboard`
5. Check status shows "Access active" (green)

### Step 4: Try Training Access
1. Click **"Start / continue training"** button
2. OR navigate to `http://127.0.0.1:8080/warehouse-training`
3. **Expected**: 3D warehouse loads ✅
4. **If error**: Check browser console for debug logs

### Step 5: Debug If Still Failing

#### Check Browser Console
Open console (F12 > Console) and look for:
```
[TRAINING-LOADER] Auth check: {authenticated: true, user: {role: 'employee', status: 'approved', ...}}
```

**If you see**:
- `Not authenticated` → No employee session cookie
- `Wrong role: admin` → Admin session is being checked instead
- `Not approved, status: pending` → Employee not approved in database

#### Check Session Debug Endpoint
Navigate to:
```
http://127.0.0.1:8080/debug/session
```

**Expected output** (employee logged in):
```json
{
  "adminCookie": false,
  "employeeCookie": true,
  "adminAuthenticated": false,
  "employeeAuthenticated": true,
  "adminUser": null,
  "employeeUser": {
    "email": "your-email@company.com",
    "role": "employee"
  }
}
```

**If employeeAuthenticated is false**:
- Employee not logged in
- OR employee session expired
- Solution: Logout and login again

#### Check Employee Status in Database

If you have access to the database, run:
```sql
SELECT id, name, email, status, approved_at 
FROM trainees 
WHERE email = 'your-email@company.com';
```

**Expected**:
- `status` should be `'approved'` (not `'pending'` or `'rejected'`)
- `approved_at` should have a date

**If status is not approved**:
1. Login as admin
2. Go to `/admin-dashboard`
3. Find the employee in "Access requests" section
4. Click "Approve"
5. Logout admin, login as employee again

### Step 6: Verify Training Works

Once you successfully access `/warehouse-training`:
1. You should see the 3D warehouse loading
2. Controls should appear at bottom
3. Objective card should show on left
4. Minimap should show on right
5. No error in console

**If you see WebGL error**: That's a different issue (see `docs/BROWSER_COMPATIBILITY.md`)

## Common Issues

### Issue 1: "Approved employee access required" after approved

**Cause**: Old session cookie, or admin session interfering

**Solution**:
```javascript
// Clear all cookies
document.cookie.split(';').forEach(c => {
  document.cookie = c.split('=')[0] + '=; Path=/; Max-Age=0';
});
location.href = '/';
```

Then login fresh.

### Issue 2: Employee dashboard shows "Awaiting admin" but admin says approved

**Cause**: Employee session is old, needs refresh

**Solution**:
1. Logout
2. Login again
3. Status should update

### Issue 3: Training works in one tab but not another

**Cause**: One tab has old session

**Solution**:
- Refresh the tab that doesn't work
- Or close it and open new tab

### Issue 4: Both admin and employee logged in, training doesn't work

**Cause**: Server checking wrong session

**Solution** (already fixed in v7.3):
- Training APIs now explicitly check `ww_employee_session` cookie
- Should work even if admin is also logged in

## Files Modified

- ✅ `server.js`
  - `requireUser()` - Now accepts `preferredRole` parameter
  - `requireAdmin()` - Passes `"admin"` to `requireUser()`
  - `requireApprovedEmployee()` - Passes `"employee"` to `requireUser()`
  
- ✅ `js/training-loader.js`
  - Enhanced error logging
  - Better error messages in console

## Verification

After applying the fix, this should work:

```
✅ Login as employee (approved)
✅ Go to /trainee-dashboard → See "Access active"
✅ Click "Start training" → 3D warehouse loads
✅ OR navigate to /warehouse-training directly → Works

✅ Login as admin in another tab
✅ Employee training still works in first tab
✅ Both sessions independent
```

## Quick Fix Command

If you're still having issues, run this in browser console:

```javascript
// 1. Clear everything
localStorage.clear();
document.cookie.split(';').forEach(c => {
  document.cookie = c.split('=')[0] + '=; Path=/; Max-Age=0';
});

// 2. Check session
fetch('/debug/session').then(r=>r.json()).then(console.log);

// 3. Reload
location.href = '/';
```

Then login fresh as employee.

---

**Version**: WareWiseXR v7.3.1  
**Date**: October 6, 2026
