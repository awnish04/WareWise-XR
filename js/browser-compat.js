/**
 * Browser Compatibility Detection & Guidance
 * Detects Safari cookie issues and Brave WebGL blocking
 */

(function() {
  'use strict';

  const COMPAT = {
    browser: null,
    webglAvailable: false,
    cookiesWork: false,
    issues: []
  };

  // Detect browser
  function detectBrowser() {
    const ua = navigator.userAgent;
    if (ua.includes('Brave')) return 'Brave';
    if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari';
    if (ua.includes('Chrome') && !ua.includes('Edg')) return 'Chrome';
    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('Edg')) return 'Edge';
    return 'Unknown';
  }

  // Test WebGL availability
  function testWebGL() {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      return !!gl;
    } catch (e) {
      return false;
    }
  }

  // Test cookie persistence
  function testCookies() {
    try {
      const testName = '_ww_cookie_test';
      const testValue = 'test_' + Date.now();
      
      // Set a test cookie with Max-Age
      document.cookie = `${testName}=${testValue}; Path=/; Max-Age=86400; SameSite=Lax`;
      
      // Immediately check if it was set
      const cookies = document.cookie.split(';').map(c => c.trim());
      const found = cookies.some(c => c.startsWith(testName + '='));
      
      // Clean up
      if (found) {
        document.cookie = `${testName}=; Path=/; Max-Age=0`;
      }
      
      return found;
    } catch (e) {
      return false;
    }
  }

  // Run compatibility check
  function checkCompatibility() {
    COMPAT.browser = detectBrowser();
    COMPAT.webglAvailable = testWebGL();
    COMPAT.cookiesWork = testCookies();

    // Check for known issues
    if (COMPAT.browser === 'Safari' && !COMPAT.cookiesWork) {
      COMPAT.issues.push({
        type: 'cookie',
        severity: 'high',
        message: 'Safari may not persist login sessions',
        fix: 'Enable cookies in Safari Settings > Privacy > Website tracking > Allow',
        technicalReason: 'Safari\'s Intelligent Tracking Prevention may block cookies from localhost'
      });
    }

    if (COMPAT.browser === 'Brave' && !COMPAT.webglAvailable) {
      COMPAT.issues.push({
        type: 'webgl',
        severity: 'high',
        message: '3D training requires WebGL',
        fix: 'Enable WebGL in brave://settings/shields > Advanced View > WebGL',
        technicalReason: 'Brave blocks WebGL by default for fingerprinting protection'
      });
    }

    return COMPAT;
  }

  // Show warning banner if issues detected
  function showCompatibilityWarning() {
    const compat = checkCompatibility();
    
    if (compat.issues.length === 0) {
      console.log('✓ Browser compatibility check passed:', compat.browser);
      return;
    }

    console.warn('Browser compatibility issues detected:', compat.issues);

    // Create warning banner
    const banner = document.createElement('div');
    banner.className = 'browser-compat-banner';
    banner.innerHTML = `
      <div class="compat-content">
        <div class="compat-icon">⚠️</div>
        <div class="compat-text">
          <strong>${compat.browser} Compatibility Notice</strong>
          ${compat.issues.map(issue => `
            <p><strong>${issue.message}</strong><br>
            <span class="compat-fix">Fix: ${issue.fix}</span></p>
          `).join('')}
        </div>
        <button class="compat-close" onclick="this.parentElement.parentElement.remove()">✕</button>
      </div>
    `;

    // Add styles
    const style = document.createElement('style');
    style.textContent = `
      .browser-compat-banner {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        background: linear-gradient(135deg, #ff6b00 0%, #ff8c00 100%);
        color: white;
        padding: 1rem;
        z-index: 10000;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        animation: slideDown 0.3s ease-out;
      }
      .compat-content {
        max-width: 1200px;
        margin: 0 auto;
        display: flex;
        align-items: flex-start;
        gap: 1rem;
      }
      .compat-icon {
        font-size: 2rem;
        flex-shrink: 0;
      }
      .compat-text {
        flex: 1;
      }
      .compat-text strong {
        display: block;
        font-size: 1.1rem;
        margin-bottom: 0.5rem;
      }
      .compat-text p {
        margin: 0.5rem 0;
        font-size: 0.95rem;
      }
      .compat-fix {
        opacity: 0.9;
        font-size: 0.9rem;
      }
      .compat-close {
        background: rgba(255,255,255,0.2);
        border: none;
        color: white;
        width: 32px;
        height: 32px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 1.2rem;
        flex-shrink: 0;
      }
      .compat-close:hover {
        background: rgba(255,255,255,0.3);
      }
      @keyframes slideDown {
        from { transform: translateY(-100%); }
        to { transform: translateY(0); }
      }
      body.has-compat-banner {
        padding-top: 120px;
      }
    `;

    document.head.appendChild(style);
    document.body.insertBefore(banner, document.body.firstChild);
    document.body.classList.add('has-compat-banner');
  }

  // Export to window
  window.WAREWISE_COMPAT = {
    check: checkCompatibility,
    showWarning: showCompatibilityWarning,
    get: () => COMPAT
  };

  // Auto-run on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', showCompatibilityWarning);
  } else {
    showCompatibilityWarning();
  }

})();
