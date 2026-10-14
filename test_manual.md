# Manual Test Plan - Landing Page Auto-Login Fix

## Issue
Visiting `http://127.0.0.1:8080` when already logged in as admin auto-redirects to `/admin`, preventing trainee login.

## Solution
1. Removed auto-redirect from `auth.js`
2. Added "Sign out" button visible when user is already logged in
3. Shows info message: "Already signed in as {email}. Sign out to switch accounts."

## Test Steps

### Test 1: No Session (Clean Start)
1. Clear browser cookies
2. Visit `http://127.0.0.1:8080`
3. ✅ Should see login form, NO redirect
4. ✅ Should NOT see "Sign out" button

### Test 2: Admin Already Logged In
1. Sign in as admin (`admin@warewise.local` / `Admin123!`)
2. Click back to home or open new tab to `http://127.0.0.1:8080`
3. ✅ Should see login form, NO auto-redirect to `/admin`
4. ✅ Should see "Sign out" button in top nav
5. ✅ Should see message: "Already signed in as admin@warewise.local. Sign out to switch accounts."

### Test 3: Sign Out from Landing Page
1. (Continue from Test 2)
2. Click "Sign out" button
3. ✅ Button should disappear
4. ✅ Should see message: "Signed out. Sign in to continue."
5. ✅ Can now sign in as trainee

### Test 4: Trainee Login After Admin Logout
1. (Continue from Test 3)
2. Switch to "Employee" tab if not already selected
3. Enter trainee credentials
4. Click "Sign in"
5. ✅ Should redirect to `/employee` dashboard

### Test 5: Direct Dashboard Access While Logged In
1. Sign in as admin
2. Manually type `/employee` in address bar
3. ✅ Should redirect to `/admin` (role check)
4. Sign out, sign in as trainee
5. Manually type `/admin` in address bar
6. ✅ Should redirect to `/employee` (role check)

## Expected Behavior Summary
- Landing page (`/`) never auto-redirects — always shows login form
- "Sign out" button appears when session exists
- Users explicitly sign out to switch accounts
- Role-based redirect still happens in `/employee` and `/admin` routes
