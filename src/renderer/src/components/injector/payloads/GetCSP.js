export const GetCSP = {
    name: 'Get CSP',
    description: 'Scans for Content Security Policy settings and security headers',
    process: 'renderer',
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
    meta: {
      csp: null,
      cspReportOnly: null,
      xFrameOptions: null,
      xContentTypeOptions: null,
      xXSSProtection: null,
      referrerPolicy: null,
      permissionsPolicy: null
    },
    errors: []
  };

  try {
    // Check if we're in a context with document access
    if (typeof document === 'undefined') {
      // If no document, try to get CSP from window.performance
      if (window.performance && window.performance.getEntriesByType) {
        const entries = window.performance.getEntriesByType('resource');
        if (entries.length > 0) {
          const headers = entries[0].responseHeaders;
          if (headers) {
            cspScan.headers.csp = headers['content-security-policy'] || null;
            cspScan.headers.cspReportOnly = headers['content-security-policy-report-only'] || null;
            cspScan.headers.xFrameOptions = headers['x-frame-options'] || null;
            cspScan.headers.xContentTypeOptions = headers['x-content-type-options'] || null;
            cspScan.headers.xXSSProtection = headers['x-xss-protection'] || null;
            cspScan.headers.referrerPolicy = headers['referrer-policy'] || null;
            cspScan.headers.permissionsPolicy = headers['permissions-policy'] || null;
          }
        }
      }
    } else {
      // We have document access, get CSP from meta tags
      const cspHeader = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
      const cspReportOnlyHeader = document.querySelector('meta[http-equiv="Content-Security-Policy-Report-Only"]');
      
      cspScan.meta.csp = cspHeader ? cspHeader.content : null;
      cspScan.meta.cspReportOnly = cspReportOnlyHeader ? cspReportOnlyHeader.content : null;
      cspScan.meta.xFrameOptions = document.querySelector('meta[http-equiv="X-Frame-Options"]')?.content;
      cspScan.meta.xContentTypeOptions = document.querySelector('meta[http-equiv="X-Content-Type-Options"]')?.content;
      cspScan.meta.xXSSProtection = document.querySelector('meta[http-equiv="X-XSS-Protection"]')?.content;
      cspScan.meta.referrerPolicy = document.querySelector('meta[name="referrer"]')?.content;
      cspScan.meta.permissionsPolicy = document.querySelector('meta[http-equiv="Permissions-Policy"]')?.content;

      // Also try to get headers from performance API
      if (window.performance && window.performance.getEntriesByType) {
        const entries = window.performance.getEntriesByType('resource');
        if (entries.length > 0) {
          const headers = entries[0].responseHeaders;
          if (headers) {
            cspScan.headers.csp = headers['content-security-policy'] || null;
            cspScan.headers.cspReportOnly = headers['content-security-policy-report-only'] || null;
            cspScan.headers.xFrameOptions = headers['x-frame-options'] || null;
            cspScan.headers.xContentTypeOptions = headers['x-content-type-options'] || null;
            cspScan.headers.xXSSProtection = headers['x-xss-protection'] || null;
            cspScan.headers.referrerPolicy = headers['referrer-policy'] || null;
            cspScan.headers.permissionsPolicy = headers['permissions-policy'] || null;
          }
        }
      }
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

    // Analyze CSP from both meta tags and headers
    if (cspScan.meta.csp) {
      cspScan.meta.cspAnalysis = analyzeCSP(cspScan.meta.csp);
    }
    if (cspScan.meta.cspReportOnly) {
      cspScan.meta.cspReportOnlyAnalysis = analyzeCSP(cspScan.meta.cspReportOnly);
    }
    if (cspScan.headers.csp) {
      cspScan.headers.cspAnalysis = analyzeCSP(cspScan.headers.csp);
    }
    if (cspScan.headers.cspReportOnly) {
      cspScan.headers.cspReportOnlyAnalysis = analyzeCSP(cspScan.headers.cspReportOnly);
    }

    // Add metadata
    cspScan.metadata = {
      hasDocument: typeof document !== 'undefined',
      url: typeof window !== 'undefined' ? window.location.href : null,
      hasMetaCSP: !!cspScan.meta.csp,
      hasMetaCSPReportOnly: !!cspScan.meta.cspReportOnly,
      hasHeaderCSP: !!cspScan.headers.csp,
      hasHeaderCSPReportOnly: !!cspScan.headers.cspReportOnly,
      hasErrors: cspScan.errors.length > 0
    };

  } catch (e) {
    cspScan.errors.push(\`Error scanning CSP: \${e.message}\`);
  }

  return cspScan;
  `
};

export default GetCSP; 