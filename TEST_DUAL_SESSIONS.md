# Quick Test: Dual Session System

## Start Server
```bash
node server.js
```

## Test: Login as Both Admin AND Employee in Same Browser

### Step 1: Login as Admin (Tab 1)
1. Open browser → `http://127.0.0.1:8080`
2. Click **"Administrator sign in"** tab
3. Login:
   - Email: `admin@warewise.local`
   - Password: `Admin123!`
4. **Expected**: Redirected to `/admin-dashboard`
5. **Expected**: See admin console with employee approval section

### Step 2: Login as Employee (Tab 2, SAME BROWSER)
1. Open **new tab** (same browser window)
2. Go to `http://127.0.0.1:8080`
3. Stay on **"Welcome back"** mode (don't click admin tab)
4. Login with approved employee account
5. **Expected**: Redirected to `/trainee-dashboard`
6. **Expected**: See employee dashboard with training access

### Step 3: Test Both Tabs Stay Independent
1. Go back to **Tab 1** (admin)
2. **Refresh the page** (Cmd+R / Ctrl+R)
3. ✅ **Expected**: STAY on `/admin-dashboard` (NO redirect!)
4. ✅ **Expected**: Still see admin console

5. Go to **Tab 2** (employee)
6. **Refresh the page**
7. ✅ **Expected**: STAY on `/trainee-dashboard` (NO redirect!)
8. ✅ **Expected**: Still see employee dashboard

### Step 4: Switch Dashboards Manually
1. In **Tab 1**, type `/trainee-dashboard` in address bar
2. ✅ **Expected**: See employee dashboard
3. Type `/admin-dashboard` in address bar
4. ✅ **Expected**: See admin dashboard
5. **Both dashboards work!** ✅

### Step 5: Verify Sessions (Debug)
1. Open new tab → `http://127.0.0.1:8080/debug/session`
2. ✅ **Expected**:
```json
{
  "adminCookie": true,
  "employeeCookie": true,
  "adminAuthenticated": true,
  "employeeAuthenticated": true,
  "adminUser": {
    "email": "admin@warewise.local",
    "role": "admin"
  },
  "employeeUser": {
    "email": "...",
    "role": "employee"
  }
}
```

## Success Criteria

✅ Tab 1 (admin) refreshes → Stays on admin dashboard  
✅ Tab 2 (employee) refreshes → Stays on employee dashboard  
✅ Can manually switch between dashboards  
✅ Both sessions show in `/debug/session`  
✅ Logout clears both sessions  

## If It Works

**🎉 SUCCESS! You can now use both admin and employee in the same browser simultaneously!**

## Quick Browser Console Check

Open console (F12) on any page:

```javascript
// Check cookies
document.cookie
// Should see: "ww_admin_session=...; ww_employee_session=..."

// Check admin session
fetch('/api/auth/me?role=admin').then(r=>r.json()).then(console.log)

// Check employee session
fetch('/api/auth/me?role=employee').then(r=>r.json()).then(console.log)
```

---

## Before (v7.2) vs After (v7.3)

### Before (BROKEN):
```
Tab 1: Login as Admin ✅
Tab 2: Login as Employee ✅
Tab 1: Refresh → ❌ Redirects to employee dashboard (BUG!)
```

### After (FIXED):
```
Tab 1: Login as Admin ✅
Tab 2: Login as Employee ✅
Tab 1: Refresh → ✅ Stays on admin dashboard (FIXED!)
Tab 2: Refresh → ✅ Stays on employee dashboard (FIXED!)
```

---

**Version**: WareWiseXR v7.3
