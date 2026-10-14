# Session Persistence Test

## Quick Test Steps

1. **Start the server:**
   ```bash
   node server.js
   ```

2. **Sign in as admin:**
   - Open: http://127.0.0.1:8080
   - Select "Administrator" tab
   - Email: `admin@warewise.local`
   - Password: `Admin123!`
   - Click "Sign in"

3. **Check the server console output:**
   You should see:
   ```
   [LOGIN] Admin logged in: admin@warewise.local
   [LOGIN] Session token (first 20 chars): xxxxxxxxxxxxxxxxxxxx
   [LOGIN] Cookie being set: ww_session=...
   ```

4. **After redirect to admin dashboard:**
   - You should be at: http://127.0.0.1:8080/admin-dashboard
   - Server console should show:
   ```
   [SESSION] Cookie found, length: 64
   [SESSION] User authenticated: admin@warewise.local | role: admin
   ```

5. **Refresh the page (press F5 or Cmd+R):**
   - Server console should show the same authentication messages
   - **If you see `[SESSION] No cookie found in request`** → cookie not being sent!
   - **If you see `[SESSION] Token invalid or expired`** → database issue!

## Debug: Check Browser Cookies

### Chrome/Edge
1. Open DevTools (F12)
2. Go to "Application" tab
3. Left sidebar: "Cookies" → "http://127.0.0.1:8080"
4. Look for `ww_session` cookie
5. Check:
   - **Path:** should be `/`
   - **HttpOnly:** should be checked
   - **SameSite:** should be `Lax`
   - **Expires/Max-Age:** should say "Session" or a far future date

### Firefox
1. Open DevTools (F12)
2. Go to "Storage" tab
3. Expand "Cookies" → "http://127.0.0.1:8080"
4. Look for `ww_session`

### Safari
1. Develop menu → Show Web Inspector
2. Storage tab → Cookies

## If Cookie Is Missing

The cookie might not be getting set. Check:
1. Browser console for errors
2. Network tab → look at login response headers
3. Should see `Set-Cookie: ww_session=...` header

## Common Issues

### Issue 1: Old Server Process
**Symptom:** Code changes don't take effect

**Solution:**
```bash
pkill -f "node server.js"
node server.js
```

### Issue 2: Browser Cache
**Symptom:** Old JavaScript running

**Solution:**
- Hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows/Linux)
- Or clear browser cache

### Issue 3: Cookie Not Being Set
**Symptom:** `[SESSION] No cookie found in request` on refresh

**Possible causes:**
- SameSite policy issue
- Path mismatch
- Browser security blocking

**Solution:** Check browser DevTools Network tab, look at Set-Cookie header in login response

## Expected Behavior

✅ **CORRECT:**
1. Sign in → redirect to dashboard
2. Refresh page → stay on dashboard (no redirect to login)
3. Navigate to other pages → stay logged in
4. Close/reopen browser → still logged in (modern browsers)

❌ **WRONG:**
1. Sign in → redirect to dashboard
2. Refresh page → redirect back to login page
3. Server console shows: `[SESSION] No cookie found in request`

---

## File Names Changed

Old → New:
- `admin.html` → `admin-dashboard.html`
- `employee.html` → `trainee-dashboard.html`
- `training.html` → `warehouse-training.html`
- `index.html` → (unchanged, landing/login page)

URLs that work:
- `/` → landing page
- `/admin` or `/admin-dashboard` → admin dashboard (redirect to new name)
- `/employee` or `/trainee-dashboard` → trainee dashboard (redirect to new name)
- `/training` or `/warehouse-training` → 3D training simulator (redirect to new name)
