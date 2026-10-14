# Browser Compatibility Guide

## Overview

WareWiseXR v7 has been tested across multiple browsers. This guide documents known compatibility issues and their solutions.

## Supported Browsers

### ✅ Fully Compatible
- **Chrome** (Desktop): Full support for 3D WebGL and session persistence
- **Firefox** (Desktop): Full support for 3D WebGL and session persistence  
- **Edge** (Desktop): Full support for 3D WebGL and session persistence

### ⚠️ Compatible with Configuration
- **Brave** (Desktop): Requires WebGL enablement (see below)
- **Safari** (macOS): May require cookie settings adjustment (see below)

## Known Issues & Solutions

### 1. Brave Browser: WebGL Disabled

**Symptom**: 3D training warehouse shows "3D rendering is unavailable" message

**Root Cause**: Brave blocks WebGL by default as a fingerprinting protection measure

**Solution - Per-Site (Recommended)**:
1. Navigate to `http://127.0.0.1:8080`
2. Click the **Brave shield icon** (🦁) in the address bar
3. Click **"Advanced View"**
4. Toggle **"WebGL"** to enabled
5. Refresh the page

**Solution - Global**:
1. Visit `brave://settings/shields`
2. Scroll to "Block fingerprinting"
3. Change from "Strict" to "Standard" (enables WebGL globally)
4. Restart Brave

**Verification**: The 3D warehouse should load when you click "Enter 3D Warehouse"

---

### 2. Safari: Session Cookie Persistence

**Symptom**: After login, refreshing the page redirects back to the home/signup page

**Root Cause**: Safari's Intelligent Tracking Prevention (ITP) may block cookies from `localhost` or `127.0.0.1`

**Solution 1 - Enable Cross-Site Tracking (Temporary)**:
1. Open Safari
2. Go to **Safari > Settings > Privacy**
3. Uncheck **"Prevent cross-site tracking"**
4. Refresh the WareWise page

**Solution 2 - Use a Different Host**:
Instead of `http://127.0.0.1:8080`, try:
1. Add `127.0.0.1 warewise.local` to `/etc/hosts`
2. Access via `http://warewise.local:8080`
3. Safari is more permissive with `.local` domains

**Solution 3 - Use Chrome/Brave/Firefox**:
Safari's cookie policies on localhost are stricter than other browsers. For development, Chrome, Brave, or Firefox provide better compatibility.

**Technical Details**:
- Current cookie: `Max-Age=315360000` (10 years), `SameSite=Lax`, `HttpOnly`
- Safari ITP treats localhost domains as "cross-site" in some contexts
- Adding `Secure` flag requires HTTPS (not available on plain HTTP localhost)

---

## Testing Session Persistence

To verify your browser supports session persistence:

1. **Login as Admin or Trainee**
2. **Refresh the page** (Cmd+R / Ctrl+R)
3. **Expected**: You stay logged in
4. **If you're redirected**: Session cookies are not persisting

Check browser console (F12 > Console) for session debugging logs:
```
[SESSION] Cookie found, length: 64
[SESSION] User authenticated: admin@warewise.local | role: admin
```

If you see `[SESSION] No cookie found in request`, the cookie was not sent with the request.

---

## Testing WebGL Support

To verify WebGL is available:

1. Open browser console (F12 > Console)
2. Run:
   ```javascript
   const canvas = document.createElement('canvas');
   const gl = canvas.getContext('webgl');
   console.log('WebGL available:', !!gl);
   ```
3. **Expected**: `WebGL available: true`
4. **If false**: WebGL is disabled (see Brave solution above)

---

## Browser Fingerprinting vs. Functionality

### Privacy-First Browsers (Brave, Safari)

These browsers prioritize user privacy by blocking:
- **WebGL** (GPU fingerprinting vector)
- **Third-party cookies** (tracking prevention)
- **LocalStorage in some contexts**

**For WareWiseXR**:
- WebGL is **required** for 3D training visualization
- Cookies are **required** for session authentication
- Both are used for **functionality**, not tracking

**Our Approach**:
- We auto-detect browser limitations
- We show clear instructions when features are blocked
- We respect user privacy choices

---

## Recommended Browser Setup

### For Development/Testing:
- **Chrome** or **Firefox**: Zero configuration needed
- **Brave**: Enable WebGL for localhost (per-site)
- **Safari**: Use Chrome/Firefox instead for local development

### For Production Deployment:
- Serve over HTTPS (enables `Secure` cookie flag)
- Use a real domain (not localhost/127.0.0.1)
- Safari ITP is less restrictive on HTTPS + real domains

---

## Troubleshooting Commands

### Check Session Cookie (Browser Console)
```javascript
document.cookie.split(';').find(c => c.includes('ww_session'))
```

### Check WebGL Support
```javascript
!!document.createElement('canvas').getContext('webgl')
```

### Force Logout and Clear Session
```javascript
document.cookie = 'ww_session=; Path=/; Max-Age=0';
location.href = '/';
```

---

## Future Enhancements

Planned improvements for better browser compatibility:

1. **HTTPS Local Development**: Use `mkcert` for local HTTPS (enables Safari `Secure` cookies)
2. **Session Alternative**: Investigate localStorage backup for Safari cookie issues
3. **WebGL Fallback**: 2D map-based training mode for WebGL-restricted environments
4. **Browser Recommendations**: Show browser compatibility warnings on home page

---

## Contact & Support

If you encounter browser compatibility issues not covered here:

1. Check browser console for error messages
2. Verify browser version (latest recommended)
3. Test in Chrome/Firefox to isolate browser-specific issues
4. Document the issue with browser version, OS, and reproduction steps

---

## Version History

- **v7.1** (2026-10-06): Added browser compatibility detection, Brave WebGL help, Safari cookie documentation
- **v7.0**: Initial full-stack release with Neon Postgres backend
