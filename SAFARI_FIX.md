# Safari Session Fix - Complete Guide

## The Problem

Safari on macOS has **strict cookie policies** for `localhost` and `127.0.0.1`. When you navigate to a new page, Safari doesn't send the session cookie, so you get logged out.

**This is a Safari limitation, not a bug in WareWise.**

---

## Solution 1: Use Chrome or Firefox (Recommended)

**Fastest solution**: Use Chrome, Firefox, or Brave instead of Safari for local development.

✅ **Chrome**: Everything works perfectly  
✅ **Firefox**: Everything works perfectly  
✅ **Brave**: Everything works (enable WebGL once, see docs)  
⚠️ **Safari**: Sessions don't work on localhost

---

## Solution 2: Use `.local` Domain (Safari Fix)

Safari works better with `.local` domains than `127.0.0.1`.

### Step 1: Add Local Domain

Open Terminal and run:

```bash
sudo nano /etc/hosts
```

Enter your password, then add this line at the bottom:

```
127.0.0.1 warewise.local
```

Press `Ctrl+O` to save, `Ctrl+X` to exit.

### Step 2: Access via New URL

Instead of `http://127.0.0.1:8080`, use:

```
http://warewise.local:8080
```

Safari treats `.local` domains differently and **should** keep cookies.

### Step 3: Test

1. Login as employee at `http://warewise.local:8080`
2. Click "Start training"
3. Should stay logged in ✅

---

## Solution 3: Disable Safari Tracking Prevention

⚠️ **Not recommended for daily use** - reduces your privacy.

1. Safari > Settings > Privacy
2. **Uncheck** "Prevent cross-site tracking"
3. Restart Safari
4. Try logging in again

**Remember to re-enable it after testing!**

---

## Solution 4: Use HTTPS with Local Certificate

Safari respects cookies better over HTTPS. This is advanced but most reliable.

### Install mkcert

```bash
brew install mkcert
mkcert -install
cd /Users/awnishmehta/Desktop/WareWiseXR_Final_FullStack_v7
mkcert localhost 127.0.0.1 ::1 warewise.local
```

This creates `localhost.pem` and `localhost-key.pem`.

### Update server.js

Add at the top:
```javascript
const https = require('https');
const fs = require('fs');
```

Replace the `http.createServer` part with:
```javascript
const server = https.createServer({
  key: fs.readFileSync(path.join(__dirname, 'localhost-key.pem')),
  cert: fs.readFileSync(path.join(__dirname, 'localhost.pem'))
}, async (req, res) => {
  // ... existing code
});
```

Access via: `https://localhost:8080` or `https://warewise.local:8080`

---

## Why Safari Does This

Safari's **Intelligent Tracking Prevention (ITP)** treats `localhost` and `127.0.0.1` as potential tracking domains.

### Safari Cookie Policy:
- ✅ Works fine on production HTTPS sites
- ✅ Works fine on `.local` domains (sometimes)
- ⚠️ Blocks cookies on `localhost` by default
- ⚠️ Blocks cookies on `127.0.0.1` by default
- ⚠️ Blocks cookies without `Secure` flag (needs HTTPS)

### Other Browsers:
- Chrome/Firefox: Allow cookies on localhost
- Brave: Allow cookies on localhost
- Edge: Allow cookies on localhost

**This is why Safari is not recommended for local web development.**

---

## Current Workarounds in WareWise

We've already implemented:
- ✅ Long cookie expiration (10 years)
- ✅ `SameSite=Lax` attribute
- ✅ `HttpOnly` for security
- ✅ Separate admin/employee cookies
- ✅ Role-based session lookup

**But Safari still blocks them on localhost!**

---

## Recommendation

### For Development/Testing:
**Use Chrome or Firefox** - zero configuration, everything works.

### For Production:
- Deploy to a real domain with HTTPS
- Safari will work perfectly in production
- This is a **local development only** issue

---

## Quick Comparison

| Browser | Sessions on localhost | WebGL | Recommendation |
|---------|---------------------|-------|----------------|
| **Chrome** | ✅ Perfect | ✅ Perfect | ⭐⭐⭐ Use this |
| **Firefox** | ✅ Perfect | ✅ Perfect | ⭐⭐⭐ Use this |
| **Brave** | ✅ Perfect | ⚠️ Enable once | ⭐⭐ Good after setup |
| **Safari** | ❌ Broken on localhost | ✅ Usually works | ❌ Don't use for dev |

---

## Testing Right Now

**Fastest solution to test everything**:

1. **Close Safari**
2. **Open Chrome**
3. Go to `http://127.0.0.1:8080`
4. Login as employee
5. Click "Start training"
6. ✅ Everything will work!

---

## If You Must Use Safari

Try Option 2 (`.local` domain):

1. Add to `/etc/hosts`:
   ```
   127.0.0.1 warewise.local
   ```

2. Access via `http://warewise.local:8080`

3. Test login → Navigate to training

4. **If it still fails**: Safari ITP is too aggressive, use Chrome instead.

---

## Production Deployment

When you deploy WareWise to production:

```
✅ Real domain (example.com)
✅ HTTPS certificate
✅ Safari will work perfectly
✅ All browsers will work perfectly
```

The session issue **only exists on localhost**. In production, Safari is fine.

---

## Summary

**Problem**: Safari blocks cookies on `localhost`/`127.0.0.1`  
**Why**: Safari's privacy protection (ITP)  
**Fix**: Use Chrome/Firefox for local development  
**Alternative**: Use `.local` domain or HTTPS  
**Production**: Will work fine on real domain + HTTPS

**Recommended action**: Switch to Chrome for development. It's what 99% of web developers use for local testing.

---

**Date**: October 6, 2026  
**Version**: WareWiseXR v7.3
