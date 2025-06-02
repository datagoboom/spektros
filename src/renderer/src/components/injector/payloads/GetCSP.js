export const GetCSP = {
    name: 'Get CSP',
    description: 'Scans for Content Security Policy settings and security headers',
    process: 'main',
    code: `
  const cspScan = {
    timestamp: new Date().toISOString(),
    headers: {
      csp: null,
      cspReportOnly: null,
      xFrameOptions: null,
      xContentTypeOptions: null,
      xXSSProtection: null,
      referrerPolicy: null,
      permissionsPolicy: null
    },
    windows: [],
    errors: []
  };

  try {
    const { session, BrowserWindow } = require('electron');
    
    // Get all windows
    const windows = BrowserWindow.getAllWindows();
    
    // Scan each window
    for (const win of windows) {
      if (!win.webContents) continue;

      try {
        // Execute in renderer process to get headers
        const headers = win.webContents.executeJavaScript(\`
          (function() {
            const headers = {};
            
            // Get CSP headers
            const cspHeader = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
            const cspReportOnlyHeader = document.querySelector('meta[http-equiv="Content-Security-Policy-Report-Only"]');
            
            headers.csp = cspHeader ? cspHeader.content : null;
            headers.cspReportOnly = cspReportOnlyHeader ? cspReportOnlyHeader.content : null;
            
            // Get other security headers
            headers.xFrameOptions = document.querySelector('meta[http-equiv="X-Frame-Options"]')?.content;
            headers.xContentTypeOptions = document.querySelector('meta[http-equiv="X-Content-Type-Options"]')?.content;
            headers.xXSSProtection = document.querySelector('meta[http-equiv="X-XSS-Protection"]')?.content;
            headers.referrerPolicy = document.querySelector('meta[name="referrer"]')?.content;
            headers.permissionsPolicy = document.querySelector('meta[http-equiv="Permissions-Policy"]')?.content;
            
            return headers;
          })();
        \`);

        // Add window info
        cspScan.windows.push({
          id: win.id,
          title: win.getTitle(),
          url: win.webContents.getURL(),
          headers
        });
      } catch (e) {
        cspScan.errors.push(\`Error scanning window \${win.id}: \${e.message}\`);
      }
    }

    // Get session headers using the correct API
    const defaultSession = session.defaultSession;
    if (defaultSession && defaultSession.webRequest) {
      // Listen for headers
      defaultSession.webRequest.onHeadersReceived((details, callback) => {
        const responseHeaders = details.responseHeaders || {};
        
        // Extract security headers
        cspScan.headers.csp = responseHeaders['content-security-policy']?.[0] || null;
        cspScan.headers.cspReportOnly = responseHeaders['content-security-policy-report-only']?.[0] || null;
        cspScan.headers.xFrameOptions = responseHeaders['x-frame-options']?.[0] || null;
        cspScan.headers.xContentTypeOptions = responseHeaders['x-content-type-options']?.[0] || null;
        cspScan.headers.xXSSProtection = responseHeaders['x-xss-protection']?.[0] || null;
        cspScan.headers.referrerPolicy = responseHeaders['referrer-policy']?.[0] || null;
        cspScan.headers.permissionsPolicy = responseHeaders['permissions-policy']?.[0] || null;
        
        callback({ responseHeaders });
      });
    }

    // Analyze CSP directives
    const analyzeCSP = (csp) => {
      if (!csp) return null;
      
      const directives = {};
      csp.split(';').forEach(directive => {
        const [key, ...values] = directive.trim().split(' ');
        if (key && values.length) {
          directives[key] = values;
        }
      });
      
      return {
        raw: csp,
        directives,
        hasDefaultSrc: 'default-src' in directives,
        hasScriptSrc: 'script-src' in directives,
        hasStyleSrc: 'style-src' in directives,
        hasImgSrc: 'img-src' in directives,
        hasConnectSrc: 'connect-src' in directives,
        hasFrameSrc: 'frame-src' in directives,
        hasObjectSrc: 'object-src' in directives,
        hasBaseUri: 'base-uri' in directives,
        hasFormAction: 'form-action' in directives,
        hasFrameAncestors: 'frame-ancestors' in directives
      };
    };

    // Analyze CSP for each window
    cspScan.windows.forEach(win => {
      if (win.headers.csp) {
        win.headers.cspAnalysis = analyzeCSP(win.headers.csp);
      }
      if (win.headers.cspReportOnly) {
        win.headers.cspReportOnlyAnalysis = analyzeCSP(win.headers.cspReportOnly);
      }
    });

    // Add metadata
    cspScan.metadata = {
      totalWindows: windows.length,
      windowsWithCSP: cspScan.windows.filter(w => w.headers.csp).length,
      windowsWithCSPReportOnly: cspScan.windows.filter(w => w.headers.cspReportOnly).length,
      hasErrors: cspScan.errors.length > 0
    };

  } catch (e) {
    cspScan.errors.push(\`Error scanning CSP: \${e.message}\`);
  }

  return cspScan;
  `
};

export default GetCSP; 