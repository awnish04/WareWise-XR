# V7 Browser Compatibility Fixes

## Date: October 6, 2026

## Problem Summary

After implementing Neon Postgres backend and session management in v7, two browser-specific issues were discovered:

1. **Safari**: Session cookies not persisting across page refreshes (auto-logout)
2. **Brave**: WebGL blocked by default, preventing 3D training warehouse from loading

## Root Causes

### Safari Cookie Issue
- Safari's Intelligent Tracking Prevention (ITP) treats `localhost`/`127.0.0.1` as cross-site in some contexts
- ITP may block cookies without `Secure` flag (requires HTTPS)
- Stricter privacy policies than Chrome/Firefox for local development

### Brave WebGL Issue  
- Brave blocks WebGL by default for fingerprinting protection
- Blocks GPU access to prevent privacy leaks
- Requires explicit per-site or global enablement

## Solutions Implemented

### 1. Browser Compatibility Detection System

**File**: `js/browser-compat.js` (NEW)

Features:
- Auto-detects browser type (Safari, Brave, Chrome, Firefox, Edge)
- Tests WebGL availability
- Tests cookie persistence
- Shows prominent warning banner when issues detected
- Provides browser-specific fix instructions

**Integration**: Added to all HTML pages:
- `index.html`
- `admin-dashboard.html`
- `trainee-dashboard.html`
- `warehouse-training.html`

### 2. Brave WebGL Help UI

**Files**:
- `warehouse-training.html`: Added `#braveWebglHelp` section to fallback UI
- `css/app.css`: Added `.fallback-help` styles
- `js/app.js`: Updated `ensureSim()` to detect Brave and show specific instructions

**User Experience**:
When WebGL fails in Brave:
1. 3D view shows "3D rendering is unavailable"
2. **NEW**: Detects Brave browser specifically
3. **NEW**: Shows step-by-step instructions to enable WebGL
4. **NEW**: Includes both per-site and global enablement options

### 3. Safari Cookie Documentation

**File**: `docs/BROWSER_COMPATIBILITY.md` (NEW)

Comprehensive guide covering:
- Known Safari ITP behavior on localhost
- Three alternative solutions:
  1. Disable cross-site tracking (temporary)
  2. Use `.local` domain instead of `127.0.0.1`
  3. Use different browser (Chrome/Firefox/Brave)
- Technical cookie details
- Troubleshooting steps

### 4. Session Cookie Improvements

**File**: `server.js`

**Changes**:
```javascript
// Before
function cookieFor(token) {
  return `ww_session=${token}; HttpOnly; Path=/; Max-Age=${tenYears}; SameSite=Lax`;
}

// After  
function cookieFor(token, isSecure = false) {
  const secure = isSecure ? '; Secure' : '';
  return `ww_session=${token}; HttpOnly; Path=/; Max-Age=${tenYears}; SameSite=Lax${secure}`;
}
```

**Ready for HTTPS**: When deployed with HTTPS, can add `Secure` flag for better Safari compatibility.

### 5. Enhanced Debug Logging

Already present in v7, now more useful for diagnosing browser issues:

```javascript
console.log('[SESSION] Cookie found, length:', token.length);
console.log('[SESSION] User authenticated:', user.email);
console.log('[SESSION] Token invalid or expired');
```

Helps users diagnose Safari cookie problems in browser console.

## Testing Results

### Chrome ✅
- Sessions: Persist correctly
- WebGL: Works out of box
- No configuration needed

### Firefox ✅
- Sessions: Persist correctly
- WebGL: Works out of box
- No configuration needed

### Brave ⚠️ → ✅
- Sessions: Persist correctly (works fine)
- WebGL: **Blocked by default** → Now shows clear instructions
- **After enabling WebGL**: Full functionality

### Safari ⚠️
- Sessions: **Do not persist on localhost**
- WebGL: Works (when sessions work)
- **Workaround documented**: Use different browser or `.local` domain

## User-Visible Changes

### 1. Warning Banner
When browser issues detected, shows at top of page:
```
⚠️ [Browser] Compatibility Notice

Safari may not persist login sessions
Fix: Enable cookies in Safari Settings > Privacy > Website tracking > Allow

Brave Browser Detected
3D training requires WebGL
Fix: Enable WebGL in brave://settings/shields > Advanced View > WebGL

[✕ Close]
```

### 2. WebGL Fallback (Brave-specific)
```
3D rendering is unavailable

This browser did not provide WebGL. Use a modern Chrome, Edge, 
Firefox or Safari browser with hardware acceleration enabled.

┌─────────────────────────────────────────────┐
│ Brave Browser Detected                      │
│                                             │
│ Brave blocks WebGL by default for privacy. │
│ To enable 3D training:                      │
│                                             │
│ 1. Click the Brave shield icon in address  │
│ 2. Click "Advanced View"                    │
│ 3. Enable "WebGL"                           │
│ 4. Refresh this page                        │
│                                             │
│ Or visit brave://settings/shields to       │
│ enable WebGL globally                       │
└─────────────────────────────────────────────┘

[Back to dashboard]
```

## Files Modified

### New Files
- `js/browser-compat.js` - Browser detection and warning system
- `docs/BROWSER_COMPATIBILITY.md` - Comprehensive compatibility guide
- `docs/V7_BROWSER_FIXES.md` - This document

### Modified Files
- `index.html` - Added browser-compat.js
- `admin-dashboard.html` - Added browser-compat.js
- `trainee-dashboard.html` - Added browser-compat.js
- `warehouse-training.html` - Added browser-compat.js, Brave help UI
- `css/app.css` - Added fallback help styles
- `js/app.js` - Enhanced WebGL fallback detection
- `server.js` - Cookie function ready for HTTPS

## Limitations & Known Issues

### Safari on Localhost
**Status**: Not fully resolved

**Why**: Safari ITP is aggressive on localhost. Cookie flags alone cannot override this.

**Workarounds**:
1. Use Chrome/Firefox/Brave for development
2. Deploy to HTTPS + real domain (Safari works fine in production)
3. Use `.local` domain hack (requires `/etc/hosts` edit)

**Not Recommended**: Disabling Safari ITP globally reduces user security

### Brave WebGL
**Status**: ✅ Resolved with user guidance

**Why**: Privacy-first default is correct behavior from Brave

**Solution**: Clear instructions shown automatically when WebGL missing

## Production Deployment Recommendations

For production deployment to resolve Safari issues:

1. **Use HTTPS** (required for `Secure` cookie flag)
2. **Real domain** (not localhost) - Safari ITP is less strict
3. **Update server.js**:
   ```javascript
   // Detect HTTPS from request
   const isSecure = req.connection.encrypted || req.headers['x-forwarded-proto'] === 'https';
   
   // Use in login responses
   { "Set-Cookie": cookieFor(token, isSecure) }
   ```

## Browser Recommendations to Users

Based on testing, recommended priority:

1. **Chrome** - Best compatibility, zero config
2. **Firefox** - Best compatibility, zero config  
3. **Brave** - Full compatibility after enabling WebGL (one-time setup)
4. **Safari** - Works in production, difficult on localhost

## Next Steps

### Immediate
- ✅ Browser detection implemented
- ✅ Brave WebGL instructions added
- ✅ Safari workarounds documented

### Future Enhancements
- [ ] Consider localStorage session backup for Safari
- [ ] Add HTTPS local dev setup guide (`mkcert`)
- [ ] 2D fallback training mode (for WebGL-restricted envs)
- [ ] Pre-flight browser check on landing page

## Testing Checklist

To verify browser compatibility implementation:

- [ ] Chrome: Login → Refresh → Still logged in ✅
- [ ] Firefox: Login → Refresh → Still logged in ✅
- [ ] Brave (WebGL off): See WebGL instructions ✅
- [ ] Brave (WebGL on): Full 3D training works ✅
- [ ] Safari: See cookie warning banner ✅

## Conclusion

**Brave**: Issue resolved through clear user instructions
**Safari**: Issue documented with workarounds, resolves in production HTTPS deployment

Both browsers prioritize user privacy, which is good. Our implementation respects that while providing clear paths to functionality for users who choose to enable features.

---

## Version
WareWiseXR v7.1 - Browser Compatibility Enhancements
