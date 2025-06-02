export const DevToolsControl = {
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

  export default DevToolsControl;