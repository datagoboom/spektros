export const GetGlobalVariables = {
    name: 'Get Global Variables',
    description: 'Finds and displays variables in both main and renderer processes',
    process: 'main',
    code: `
  // Find and display variables in both processes
  const variables = {
    timestamp: new Date().toISOString(),
    mainProcess: {
      globals: {},
      errors: []
    },
    rendererProcess: {
      globals: {},
      errors: []
    }
  };

  // Skip these built-in properties
  const skipProps = new Set([
    // Window properties
    'window', 'self', 'top', 'parent', 'frames', 'opener', 'frameElement',
    // Browser UI elements
    'locationbar', 'menubar', 'personalbar', 'scrollbars', 'statusbar', 'toolbar',
    // Event handlers
    'onabort', 'onblur', 'onchange', 'onclick', 'onclose', 'oncontextmenu', 'ondblclick',
    'onerror', 'onfocus', 'oninput', 'onkeydown', 'onkeypress', 'onkeyup', 'onload',
    'onmousedown', 'onmousemove', 'onmouseout', 'onmouseover', 'onmouseup', 'onreset',
    'onresize', 'onscroll', 'onselect', 'onsubmit', 'onunload',
    // Built-in functions
    'alert', 'atob', 'blur', 'btoa', 'clearInterval', 'clearTimeout', 'close',
    'confirm', 'fetch', 'focus', 'open', 'print', 'prompt', 'setInterval', 'setTimeout',
    // Other common properties to skip
    'customElements', 'history', 'navigation', 'external', 'screen', 'visualViewport',
    'clientInformation', 'styleMedia', 'trustedTypes', 'crypto', 'indexedDB',
    'sessionStorage', 'localStorage', 'performance', 'speechSynthesis'
  ]);

  // Helper to safely get value
  function safeGetValue(obj) {
    try {
      if (obj === null || obj === undefined) return null;
      if (typeof obj === 'function') return null; // Skip functions
      if (typeof obj === 'object') {
        // Try to get a string representation
        try {
          const str = JSON.stringify(obj, null, 2);
          // Skip empty objects
          if (str === '{}' || str === '[]') return null;
          return str;
        } catch {
          return String(obj);
        }
      }
      return obj;
    } catch (e) {
      return '[Error: ' + e.message + ']';
    }
  }

  // Helper to check if a value is interesting
  function isInterestingValue(value) {
    if (value === null || value === undefined) return false;
    if (typeof value === 'function') return false;
    if (typeof value === 'object') {
      // Skip empty objects
      if (Object.keys(value).length === 0) return false;
      // Check if it's a common state container
      const stateIndicators = ['state', 'store', 'data', 'config', 'settings', 'user', 'auth'];
      return stateIndicators.some(indicator => 
        Object.keys(value).some(key => key.toLowerCase().includes(indicator))
      );
    }
    return true;
  }

  // Get main process variables
  try {
    // Get global variables
    for (let key in global) {
      try {
        if (skipProps.has(key)) continue;
        
        const value = global[key];
        const safeValue = safeGetValue(value);
        
        if (safeValue !== null && isInterestingValue(value)) {
          variables.mainProcess.globals[key] = safeValue;
        }
      } catch (e) {
        variables.mainProcess.errors.push('Error getting global.' + key + ': ' + e.message);
      }
    }

    // Get process variables
    if (typeof process !== 'undefined') {
      const processVars = {
        env: process.env,
        versions: process.versions,
        platform: process.platform,
        arch: process.arch,
        pid: process.pid,
        ppid: process.ppid,
        title: process.title,
        argv: process.argv,
        execPath: process.execPath
      };
      
      for (let key in processVars) {
        const value = processVars[key];
        const safeValue = safeGetValue(value);
        if (safeValue !== null) {
          variables.mainProcess.globals['process.' + key] = safeValue;
        }
      }
    }

    // Get app variables if available
    if (typeof app !== 'undefined') {
      const appVars = {
        name: app.getName(),
        version: app.getVersion(),
        locale: app.getLocale(),
        isPackaged: app.isPackaged,
        appPath: app.getAppPath(),
        userDataPath: app.getPath('userData')
      };
      
      for (let key in appVars) {
        const value = appVars[key];
        const safeValue = safeGetValue(value);
        if (safeValue !== null) {
          variables.mainProcess.globals['app.' + key] = safeValue;
        }
      }
    }
  } catch (e) {
    variables.mainProcess.errors.push('Error in main process: ' + e.message);
  }

  // Get renderer process variables by executing in all windows
  try {
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      if (!win.webContents) continue;
      
      try {
        // Execute in renderer process
        const rendererVars = win.webContents.executeJavaScript(\`
          (function() {
            const skipProps = new Set([
              'window', 'self', 'top', 'parent', 'frames', 'opener', 'frameElement',
              'locationbar', 'menubar', 'personalbar', 'scrollbars', 'statusbar', 'toolbar',
              'onabort', 'onblur', 'onchange', 'onclick', 'onclose', 'oncontextmenu', 'ondblclick',
              'onerror', 'onfocus', 'oninput', 'onkeydown', 'onkeypress', 'onkeyup', 'onload',
              'onmousedown', 'onmousemove', 'onmouseout', 'onmouseover', 'onmouseup', 'onreset',
              'onresize', 'onscroll', 'onselect', 'onsubmit', 'onunload',
              'alert', 'atob', 'blur', 'btoa', 'clearInterval', 'clearTimeout', 'close',
              'confirm', 'fetch', 'focus', 'open', 'print', 'prompt', 'setInterval', 'setTimeout',
              'customElements', 'history', 'navigation', 'external', 'screen', 'visualViewport',
              'clientInformation', 'styleMedia', 'trustedTypes', 'crypto', 'indexedDB',
              'sessionStorage', 'localStorage', 'performance', 'speechSynthesis'
            ]);

            const vars = {};
            for (let key in window) {
              if (skipProps.has(key)) continue;
              try {
                const value = window[key];
                if (value === null || value === undefined || typeof value === 'function') continue;
                if (typeof value === 'object') {
                  if (Object.keys(value).length === 0) continue;
                  try {
                    const str = JSON.stringify(value, null, 2);
                    if (str === '{}' || str === '[]') continue;
                    vars[key] = str;
                  } catch {
                    vars[key] = String(value);
                  }
                } else {
                  vars[key] = value;
                }
              } catch (e) {
                vars[key] = '[Error: ' + e.message + ']';
              }
            }
            return vars;
          })();
        \`);

        // Add renderer variables to the result
        for (let key in rendererVars) {
          variables.rendererProcess.globals[key] = rendererVars[key];
        }
      } catch (e) {
        variables.rendererProcess.errors.push('Error in window ' + win.id + ': ' + e.message);
      }
    }
  } catch (e) {
    variables.rendererProcess.errors.push('Error accessing renderer process: ' + e.message);
  }

  return variables;
  `
};

export default GetGlobalVariables;