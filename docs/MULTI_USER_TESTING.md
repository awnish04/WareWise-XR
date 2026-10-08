# Multi-User Testing Guide

## Understanding Browser Sessions

### Why You Can't Login as Admin AND Employee in the Same Browser

**This is CORRECT and SECURE behavior.**

When you login, the server sends a cookie:
```
Set-Cookie: ww_session=TOKEN123; HttpOnly; Path=/; ...
```

**All tabs in the same browser share the same cookies.**

### What Happens When You Try

#### Scenario (Your Current Experience):
1. **Tab 1**: Login as Admin
   - Cookie set: `ww_session=ADMIN_TOKEN`
   - Tab 1 can access `/admin-dashboard` ✅

2. **Tab 2**: Login as Employee (same browser)
   - Cookie **OVERWRITTEN**: `ww_session=EMPLOYEE_TOKEN`
   - Now **BOTH tabs** have the employee cookie
   - Tab 1 refreshes → Has employee cookie → Redirected to `/trainee-dashboard` ✅ (Correct!)

3. **Tab 1 or Tab 2**: Click Sign Out
   - Cookie deleted: `ww_session=` (empty)
   - **BOTH tabs** lose authentication
   - Both redirect to home page ✅ (Correct!)

### This is NOT a Bug - It's Security!

**Why this is correct**:
- Prevents session fixation attacks
- Ensures one physical person = one role at a time
- Standard web authentication behavior
- Same as Gmail, Facebook, Twitter, etc.

**Try this**: Open Gmail in two tabs, login with Account A in tab 1, then login with Account B in tab 2. Tab 1 will now show Account B when refreshed. This is normal.

---

## How to Test Multiple Users Properly

### Method 1: Different Browsers ✅ (Recommended)

Use different browsers for each role:

- **Chrome**: Login as Admin
- **Brave**: Login as Employee
- **Firefox**: Login as another Employee
- **Safari**: Login as another Employee

Each browser has its own cookie storage, so sessions don't interfere.

#### Steps:
1. Open **Chrome** → `http://127.0.0.1:8080` → Login as Admin
2. Open **Brave** → `http://127.0.0.1:8080` → Login as Employee
3. Refresh both → Each stays on their dashboard ✅
4. Signout in Chrome → Only admin logs out, employee stays logged in ✅

---

### Method 2: Incognito/Private Windows ✅ (Good for Testing)

Use regular + incognito windows:

- **Regular Chrome Window**: Login as Admin
- **Chrome Incognito Window**: Login as Employee

Each incognito window has separate cookie storage from regular windows.

#### Steps:
1. Open **Chrome** (regular) → Login as Admin
2. Open **Chrome Incognito** (Cmd+Shift+N / Ctrl+Shift+N) → Login as Employee  
3. Refresh both → Each stays on their dashboard ✅
4. Signout in regular window → Only admin logs out ✅

**⚠️ Limitation**: Multiple incognito windows in the same browser may share cookies. Use different browsers if you need more than 2 simultaneous sessions.

---

### Method 3: Browser Profiles ✅ (Best for Development)

Create separate browser profiles:

#### Chrome Profiles:
1. Click your profile icon (top right)
2. Click "Add"
3. Create "Admin Profile" and "Employee Profile"
4. Each profile has completely separate cookies, bookmarks, history

#### Steps:
1. Open **Chrome - Admin Profile** → Login as Admin
2. Open **Chrome - Employee Profile** → Login as Employee
3. Both work independently ✅

---

### Method 4: Different Devices 🔧 (Real-World Scenario)

Test on different physical devices:
- **Laptop**: Login as Admin
- **Phone**: Login as Employee
- **Tablet**: Login as Employee

Each device has separate cookie storage.

---

## Quick Test: Verify Role Separation

### Single Browser Test (One User at a Time)

**This tests that roles DON'T interfere:**

1. **Login as Admin**
   - Go to `/admin-dashboard` → See admin console ✅
   - Refresh → Stay on admin dashboard ✅

2. **Signout** → Back to home ✅

3. **Login as Employee**
   - Go to `/trainee-dashboard` → See employee dashboard ✅
   - Refresh → Stay on employee dashboard ✅
   - Try to access `/admin-dashboard` → Redirect to `/trainee-dashboard` ✅

4. **Signout** → Back to home ✅

5. **Login as Admin again**
   - Should see admin dashboard (NOT employee) ✅
   - Should NOT see any employee data ✅

**✅ This proves roles are separate and don't contaminate each other.**

---

### Multi-Browser Test (Simultaneous Users)

**This tests that multiple users can be online together:**

1. **Chrome**: Login as Admin
   - See admin dashboard ✅
   - Refresh → Stay on admin dashboard ✅

2. **Brave** (don't close Chrome): Login as Employee
   - See employee dashboard ✅
   - Refresh → Stay on employee dashboard ✅

3. **Go back to Chrome** (still open)
   - Refresh → Still admin dashboard ✅

4. **Signout in Brave**
   - Brave → Back to home ✅
   - Chrome → Still admin dashboard ✅ (NOT affected)

5. **Signout in Chrome**
   - Chrome → Back to home ✅

**✅ This proves multiple users can be online simultaneously without interfering.**

---

## What You Were Experiencing (and Why It's Correct)

### Your Test:
```
Tab 1 (Chrome): Login as Admin
Tab 2 (Chrome): Login as Employee  
Tab 1 (Chrome): Refresh → Goes to Employee dashboard
```

### Why This Happened:
- **Both tabs share the same cookie storage**
- When you logged in as Employee in Tab 2, it **replaced** the admin cookie
- Tab 1 now has the employee cookie
- Server sees employee cookie → Correctly redirects to `/trainee-dashboard`

### This is CORRECT Security Behavior! ✅

Imagine if it worked differently:
- Tab 1 has admin cookie
- Tab 2 has employee cookie (same browser)
- **Which cookie does the browser send to the server?**
- Answer: **Only one** - the most recent one

Browsers don't support multiple simultaneous sessions in the same cookie domain. This is a web standard, not a WareWise limitation.

---

## Real-World Usage

### In Production:
- **Admin** logs in on their laptop → Admin access
- **Employee A** logs in on their laptop → Employee access
- **Employee B** logs in on their laptop → Employee access
- All three work simultaneously ✅

### In Development/Testing:
- Use different browsers or incognito windows
- Or test sequentially (login admin → test → logout → login employee → test)

---

## Common Questions

### Q: Why can't I be logged in as both admin and employee at the same time?

**A**: Because web browsers use **one cookie per domain**. The `ww_session` cookie can only hold one value at a time. When you login as employee, it overwrites the admin token.

### Q: Other websites let me have multiple accounts in different tabs!

**A**: No, they don't. Try it:
1. Open Gmail in Tab 1 → Login as `account-a@gmail.com`
2. Open Gmail in Tab 2 → Login as `account-b@gmail.com`
3. Refresh Tab 1 → Now shows `account-b@gmail.com`

Same behavior. The only way to have multiple accounts is:
- Different browsers
- Incognito windows
- Browser profiles

### Q: Can you make it so I can login as both admin and employee in the same browser?

**A**: Technically possible but **bad security**:
- Would require separate cookie names (`admin_session` + `employee_session`)
- Server would need to check both cookies and decide which one to use
- Opens security holes (session fixation, privilege escalation)
- Non-standard behavior confuses users
- Not how any professional web app works

**Better approach**: Use different browsers or profiles for testing.

### Q: What if I want to test admin approving an employee request?

**Sequential testing** (one browser):
1. Login as Employee → Request access → Logout
2. Login as Admin → See request → Approve → Logout
3. Login as Employee → See approved status → Enter warehouse ✅

Or **parallel testing** (two browsers):
1. **Brave**: Login as Employee → Request access
2. **Chrome**: Login as Admin → Refresh → See request → Approve
3. **Brave**: Refresh employee dashboard → See approved status ✅

---

## Testing Checklist

Use this to verify everything works:

### Single Browser Test (Sequential)
- [ ] Login as Admin → See admin dashboard ✅
- [ ] Refresh → Stay on admin dashboard ✅
- [ ] Logout → Go to home ✅
- [ ] Login as Employee → See employee dashboard ✅
- [ ] Refresh → Stay on employee dashboard ✅
- [ ] Logout → Go to home ✅
- [ ] Login as Admin again → See admin dashboard (not employee) ✅

### Multi-Browser Test (Parallel)
- [ ] Browser A: Login as Admin → See admin dashboard ✅
- [ ] Browser B: Login as Employee → See employee dashboard ✅
- [ ] Browser A: Refresh → Still admin ✅
- [ ] Browser B: Refresh → Still employee ✅
- [ ] Browser A: Logout → Browser B still logged in ✅
- [ ] Browser B: Logout → Goes to home ✅

### Security Test
- [ ] Login as Employee in Browser A
- [ ] Manually type `/admin-dashboard` → Redirected to `/trainee-dashboard` ✅
- [ ] Login as Admin in Browser B
- [ ] Manually type `/trainee-dashboard` → Redirected to `/admin-dashboard` ✅

---

## Summary

✅ **Your system is working correctly!**

What you experienced is **standard web authentication behavior**, not a bug:
- One browser = One session = One role at a time
- Logging in with a different account overwrites the previous session
- All tabs in the same browser share cookies
- Signout clears the cookie for all tabs

To test multiple users simultaneously:
- Use **different browsers** (Chrome + Brave + Firefox)
- Use **incognito/private windows**
- Use **browser profiles**
- Or test **sequentially** (one user at a time)

**The admin and employee dashboards ARE properly separated. Each user gets their correct dashboard based on their role. The system is secure.** ✅

---

**Date**: October 6, 2026  
**Version**: WareWiseXR v7.2
