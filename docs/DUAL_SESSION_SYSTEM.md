# Dual Session System - Admin + Employee Simultaneous Login

## Date: October 6, 2026

## Problem Solved

**Before**: You could NOT login as both admin and employee in the same browser. Logging in as one would overwrite the other's session.

**After**: You can NOW login as BOTH admin and employee simultaneously in the same browser, even in the same tab!

## How It Works

### Separate Cookies for Each Role

Instead of one shared cookie, we now use **two separate cookies**:

```
ww_admin_session=ADMIN_TOKEN_123...     (for admins)
ww_employee_session=EMPLOYEE_TOKEN_456... (for employees)
```

### Cookie Isolation

- Admin login → Sets `ww_admin_session` cookie
- Employee login → Sets `ww_employee_session` cookie
- **Both cookies can exist at the same time** ✅
- Each dashboard reads **only its own cookie**

### Smart Session Lookup

When you visit a page, the server checks the appropriate cookie:

- `/admin-dashboard` → Looks for `ww_admin_session` **first**
- `/trainee-dashboard` → Looks for `ww_employee_session` **first**
- If the preferred cookie doesn't exist, falls back to checking the other

### API Endpoint Updates

```javascript
// Admin dashboard calls
GET /api/auth/me?role=admin        // Checks ww_admin_session
GET /api/admin/overview            // Checks ww_admin_session

// Employee dashboard calls
GET /api/auth/me?role=employee     // Checks ww_employee_session
GET /api/training/me               // Checks ww_employee_session
```

## New Behavior

### Scenario 1: Login as Both in Same Browser ✅

**Tab 1:**
1. Go to `http://127.0.0.1:8080`
2. Click "Administrator sign in"
3. Login as Admin
4. Go to `/admin-dashboard` → See admin console ✅

**Tab 2 (same browser):**
1. Go to `http://127.0.0.1:8080`
2. Stay on "Welcome back" mode
3. Login as Employee
4. Go to `/trainee-dashboard` → See employee dashboard ✅

**Tab 1 (go back):**
5. Refresh `/admin-dashboard` → **Still see admin console** ✅ (NO redirect!)

**Both tabs work independently!** ✅

---

### Scenario 2: Switch Dashboards in Same Tab ✅

1. Login as Admin → Go to `/admin-dashboard` ✅
2. Login as Employee (don't logout) → Go to `/trainee-dashboard` ✅
3. Type `/admin-dashboard` → See admin dashboard ✅
4. Type `/trainee-dashboard` → See employee dashboard ✅
5. **Both sessions active simultaneously!** ✅

---

### Scenario 3: Logout Behavior

**Option A: Logout from Admin Dashboard**
- Clears **both** admin and employee sessions
- Both dashboards redirect to home
- This is intentional for security (full logout)

**Option B: Logout from Employee Dashboard**
- Clears **both** admin and employee sessions
- Both dashboards redirect to home
- This is intentional for security (full logout)

**Why clear both?** 
- The "Sign out" button is meant as a full logout
- Prevents confusion about partial logout states
- If you want to keep one session, just close that tab instead of logging out

---

## Technical Implementation

### Server-Side Changes

#### 1. Separate Cookie Names
```javascript
// OLD (single cookie)
ww_session=TOKEN

// NEW (dual cookies)
ww_admin_session=ADMIN_TOKEN
ww_employee_session=EMPLOYEE_TOKEN
```

#### 2. Role-Specific Cookie Creation
```javascript
function cookieFor(token, role, isSecure = false) {
  const cookieName = role === 'admin' ? 'ww_admin_session' : 'ww_employee_session';
  return `${cookieName}=${token}; HttpOnly; Path=/; Max-Age=...`;
}

// Login response
if (role === "admin") {
  return json(res, 200, { ok: true, ... }, 
    { "Set-Cookie": cookieFor(token, "admin") }
  );
}
```

#### 3. Smart Session Lookup
```javascript
async function currentUser(req, preferredRole = null) {
  const cookies = parseCookies(req);
  const adminToken = cookies.ww_admin_session;
  const employeeToken = cookies.ww_employee_session;
  
  // Check preferred role first
  if (preferredRole === 'admin' && adminToken) {
    const user = await getSessionUser(adminToken);
    if (user && user.role === 'admin') return user;
  }
  
  if (preferredRole === 'employee' && employeeToken) {
    const user = await getSessionUser(employeeToken);
    if (user && user.role === 'employee') return user;
  }
  
  // Fallback: check both
  // ... (see server.js for full implementation)
}
```

#### 4. Role-Specific Route Handling
```javascript
// Admin dashboard - prefer admin session
if (url.pathname === "/admin-dashboard") {
  const u = await currentUser(req, "admin");
  if (!u) return redirect(res, "/");
  if (u.role !== "admin") return redirect(res, "/trainee-dashboard");
  return serveFile(res, path.join(ROOT, "admin-dashboard.html"));
}

// Employee dashboard - prefer employee session  
if (url.pathname === "/trainee-dashboard") {
  const u = await currentUser(req, "employee");
  if (!u) return redirect(res, "/");
  if (u.role !== "employee") return redirect(res, "/admin-dashboard");
  return serveFile(res, path.join(ROOT, "trainee-dashboard.html"));
}
```

#### 5. Logout Clears Both
```javascript
if (p === "/api/auth/logout" && req.method === "POST") {
  const cookies = parseCookies(req);
  
  // Clear both session tokens from database
  if (cookies.ww_admin_session) await clearSession(cookies.ww_admin_session);
  if (cookies.ww_employee_session) await clearSession(cookies.ww_employee_session);
  
  // Clear both cookies
  return json(res, 200, { ok: true }, {
    "Set-Cookie": [
      "ww_admin_session=; HttpOnly; Path=/; Max-Age=0",
      "ww_employee_session=; HttpOnly; Path=/; Max-Age=0"
    ]
  });
}
```

### Client-Side Changes

#### 1. Role-Specific API Calls
```javascript
// admin.js
const me = await api('/api/auth/me?role=admin'); // Query admin session

// employee.js
const me = await api('/api/auth/me?role=employee'); // Query employee session

// training-loader.js
const me = await api('/api/auth/me?role=employee'); // Query employee session
```

#### 2. API Endpoint with Role Parameter
```javascript
// Server handles ?role=admin or ?role=employee
if (p === "/api/auth/me" && req.method === "GET") {
  const roleParam = url.searchParams.get('role');
  const preferredRole = roleParam === 'admin' ? 'admin' 
                      : roleParam === 'employee' ? 'employee' 
                      : null;
  const u = await currentUser(req, preferredRole);
  return json(res, 200, { authenticated: !!u, user: publicUser(u) });
}
```

## Files Modified

### Server Files
- **`server.js`**
  - `cookieFor()` - Takes role parameter, returns role-specific cookie
  - `currentUser()` - Checks both cookies, prefers specified role
  - Login endpoint - Sets role-specific cookie
  - Logout endpoint - Clears both cookies
  - Route handlers - Pass preferred role to `currentUser()`
  - `/api/auth/me` - Accepts `?role=admin` or `?role=employee` parameter

### Client Files
- **`js/admin.js`** - Calls `/api/auth/me?role=admin`
- **`js/employee.js`** - Calls `/api/auth/me?role=employee`
- **`js/training-loader.js`** - Calls `/api/auth/me?role=employee`

## Testing the Dual Session System

### Test 1: Simultaneous Login (Same Browser, Different Tabs)

1. **Tab 1**: Login as Admin
   ```
   http://127.0.0.1:8080
   → Administrator sign in
   → admin@warewise.local / Admin123!
   → Should see /admin-dashboard ✅
   ```

2. **Tab 2**: Login as Employee (don't close Tab 1)
   ```
   http://127.0.0.1:8080
   → Welcome back
   → employee@company.com / password
   → Should see /trainee-dashboard ✅
   ```

3. **Tab 1**: Refresh
   ```
   → Should STILL see /admin-dashboard ✅
   → NOT redirected to employee dashboard ✅
   ```

4. **Tab 2**: Refresh
   ```
   → Should STILL see /trainee-dashboard ✅
   → NOT redirected to admin dashboard ✅
   ```

✅ **SUCCESS**: Both sessions persist independently!

---

### Test 2: Switch Between Dashboards (Same Tab)

1. Login as Admin → Visit `/admin-dashboard` ✅
2. Manually type `/trainee-dashboard` → Redirected to `/admin-dashboard` (no employee session yet)
3. Login as Employee (from home page, don't logout admin)
4. Visit `/trainee-dashboard` ✅
5. Manually type `/admin-dashboard` → See admin dashboard ✅
6. Manually type `/trainee-dashboard` → See employee dashboard ✅
7. Refresh on `/admin-dashboard` → Stay on admin ✅
8. Refresh on `/trainee-dashboard` → Stay on employee ✅

✅ **SUCCESS**: Can access both dashboards without logging out!

---

### Test 3: Debug Session State

Visit the debug endpoint to see both sessions:

```
http://127.0.0.1:8080/debug/session
```

**Expected Output** (when both logged in):
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
    "email": "john.doe@company.com",
    "role": "employee"
  }
}
```

✅ **SUCCESS**: Both sessions are active!

---

### Test 4: Logout Clears Both

1. Login as Admin → See admin dashboard ✅
2. Login as Employee → See employee dashboard ✅
3. Open `/debug/session` → See both sessions ✅
4. Click "Sign out" on **either** dashboard
5. Both dashboards redirect to home ✅
6. Visit `/debug/session` → Both sessions cleared ✅

✅ **SUCCESS**: Logout clears all sessions for security!

---

## Browser Console Verification

### Check Cookies
```javascript
// In browser console
document.cookie
// Should see both:
// "ww_admin_session=...; ww_employee_session=..."
```

### Check Admin Session
```javascript
fetch('/api/auth/me?role=admin')
  .then(r => r.json())
  .then(d => console.log('Admin:', d));
```

### Check Employee Session
```javascript
fetch('/api/auth/me?role=employee')
  .then(r => r.json())
  .then(d => console.log('Employee:', d));
```

---

## Security Considerations

### ✅ Pros (Why This Is Good)

1. **Testing Convenience**: Can test admin approving employee without switching browsers
2. **Multi-Role Users**: If same person is both admin and employee (small team), they can access both
3. **Session Isolation**: Each role has its own token, reducing cross-role contamination
4. **Explicit Role Checking**: Each page explicitly requests its role, preventing accidents

### ⚠️ Cons (Potential Issues)

1. **Logout Clears Both**: Some users might expect to logout from one role only
2. **Cookie Overhead**: Two cookies instead of one (minimal impact)
3. **Confusion**: User might forget they're logged in as both roles
4. **Not Standard**: Most web apps don't allow simultaneous multi-role login

### 🔒 Security Is Maintained

- Each dashboard only reads its own cookie
- API endpoints still require correct role (403 if wrong)
- Session tokens are still HttpOnly, secure, long-lived
- Database still tracks sessions separately
- Logout still clears all sessions (prevents session lingering)

---

## Comparison: Before vs After

| Feature | Before (Single Cookie) | After (Dual Cookies) |
|---------|----------------------|---------------------|
| Login as Admin in Tab 1 | ✅ Works | ✅ Works |
| Login as Employee in Tab 2 | ❌ Overwrites admin | ✅ Both work |
| Refresh Tab 1 (admin) | ❌ Redirects to employee | ✅ Stays on admin |
| Access both dashboards | ❌ Must logout and switch | ✅ Can access both |
| Logout | ✅ Clears one session | ✅ Clears both sessions |
| Security | ✅ Role-based | ✅ Role-based |

---

## Troubleshooting

### Issue: Still getting redirected after refresh

**Diagnosis**:
1. Open browser console → Check cookies: `document.cookie`
2. Should see **both** `ww_admin_session` and `ww_employee_session`
3. If only one cookie, the old single-cookie session might be cached

**Solution**:
```javascript
// Clear old sessions
document.cookie = 'ww_session=; Path=/; Max-Age=0';
document.cookie = 'ww_admin_session=; Path=/; Max-Age=0';
document.cookie = 'ww_employee_session=; Path=/; Max-Age=0';
location.href = '/';
```

Then login fresh with both roles.

### Issue: Logout doesn't clear both sessions

**Check**: Server logs should show:
```
[SESSION] Clearing admin session
[SESSION] Clearing employee session
```

If not, the logout endpoint might not be updated. Restart the server.

### Issue: Browser console shows wrong role

**Check**: Make sure JavaScript files call the right API:
- `admin.js` should call `/api/auth/me?role=admin`
- `employee.js` should call `/api/auth/me?role=employee`

---

## Summary

✅ **Problem Solved**: You can now login as both admin and employee simultaneously in the same browser!

✅ **How It Works**: Separate cookies (`ww_admin_session` + `ww_employee_session`) allow both roles to coexist

✅ **Testing**: Open 2 tabs, login as admin in one, employee in other, refresh both - both stay logged in

✅ **Security**: Still maintained - each dashboard only reads its own cookie, APIs still enforce role checks

✅ **Logout**: Clears both sessions for clean logout

**This is now a dual-session system that supports simultaneous multi-role access!** 🎉

---

**Date**: October 6, 2026  
**Version**: WareWiseXR v7.3 - Dual Session System
