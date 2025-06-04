export const EnumerateIPC = {
    name: 'Enumerate IPC Channels',
    description: 'Discovers and analyzes IPC channels and handlers',
    process: 'main',
    code: `
  // Import required modules
  const { ipcMain, ipcRenderer, contextBridge } = require('electron');
  
  // Enumerate IPC channels and handlers
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

  // Helper to safely get object properties
  function getObjectProperties(obj) {
    try {
      if (typeof obj !== 'object' || obj === null) return [];
      return Object.getOwnPropertyNames(obj);
    } catch (e) {
      return [];
    }
  }

  try {
    // Enumerate ipcMain channels
    if (typeof ipcMain !== 'undefined') {
      // Get all registered handlers using multiple methods
      const mainHandlers = new Set();
      
      // Method 1: Direct event listeners
      if (ipcMain._events) {
        Object.keys(ipcMain._events).forEach(channel => mainHandlers.add(channel));
      }

      // Method 2: Using listenerCount to find channels
      const commonChannels = [
        'app', 'window', 'dialog', 'menu', 'shell', 'clipboard', 'power',
        'screen', 'systemPreferences', 'nativeTheme', 'desktopCapturer',
        'contentTracing', 'crashReporter', 'autoUpdater', 'protocol',
        'session', 'webContents', 'browserWindow', 'ipc', 'electron'
      ];

      commonChannels.forEach(channel => {
        if (ipcMain.listenerCount(channel) > 0) {
          mainHandlers.add(channel);
        }
      });

      // Method 3: Look for channels in the prototype chain
      const prototypeProps = getObjectProperties(Object.getPrototypeOf(ipcMain));
      prototypeProps.forEach(prop => {
        if (typeof ipcMain[prop] === 'function' && prop.startsWith('on')) {
          mainHandlers.add(prop.slice(2));
        }
      });

      // Process all found channels
      mainHandlers.forEach(channel => {
        try {
          const handler = ipcMain._events?.[channel];
          const listenerCount = ipcMain.listenerCount(channel);
          
          ipcEnumeration.channels.main[channel] = {
            type: typeof handler,
            isFunction: typeof handler === 'function',
            isArray: Array.isArray(handler),
            listenerCount: listenerCount,
            properties: getObjectProperties(handler)
          };

          ipcEnumeration.handlers.push({
            channel,
            type: typeof handler,
            isFunction: typeof handler === 'function',
            isArray: Array.isArray(handler),
            listenerCount: listenerCount,
            source: 'main'
          });
        } catch (e) {
          ipcEnumeration.errors.push(\`Error analyzing main channel "\${channel}": \${e.message}\`);
        }
      });
    }

    // Try to enumerate renderer process channels
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      if (!win.webContents) continue;

      try {
        // Execute in renderer process to find IPC channels
        const rendererChannels = win.webContents.executeJavaScript(\`
          (function() {
            const { ipcRenderer } = require('electron');
            const channels = new Set();
            
            
            if (ipcRenderer && ipcRenderer._events) {
              Object.keys(ipcRenderer._events).forEach(channel => channels.add(channel));
            }

            
            const commonChannels = [
              'app', 'window', 'dialog', 'menu', 'shell', 'clipboard', 'power',
              'screen', 'systemPreferences', 'nativeTheme', 'desktopCapturer',
              'contentTracing', 'crashReporter', 'autoUpdater', 'protocol',
              'session', 'webContents', 'browserWindow', 'ipc', 'electron'
            ];

            if (ipcRenderer) {
              commonChannels.forEach(channel => {
                if (ipcRenderer.listenerCount(channel) > 0) {
                  channels.add(channel);
                }
              });
            }

            
            if (ipcRenderer) {
              const prototypeProps = Object.getOwnPropertyNames(Object.getPrototypeOf(ipcRenderer));
              prototypeProps.forEach(prop => {
                if (typeof ipcRenderer[prop] === 'function' && prop.startsWith('on')) {
                  channels.add(prop.slice(2));
                }
              });
            }

            
            const channelDetails = {};
            channels.forEach(channel => {
              try {
                const handler = ipcRenderer?._events?.[channel];
                channelDetails[channel] = {
                  type: typeof handler,
                  isFunction: typeof handler === 'function',
                  isArray: Array.isArray(handler),
                  listenerCount: ipcRenderer?.listenerCount(channel) || 0
                };
              } catch (e) {
                channelDetails[channel] = { error: e.message };
              }
            });

            return channelDetails;
          })();
        \`);

        // Add renderer channels to the result
        Object.assign(ipcEnumeration.channels.renderer, rendererChannels);
      } catch (e) {
        ipcEnumeration.errors.push(\`Error in window \${win.id}: \${e.message}\`);
      }
    }

    // Try to enumerate contextBridge APIs
    if (typeof contextBridge !== 'undefined') {
      try {
        // Get all exposed APIs using multiple methods
        const bridgeAPIs = new Set();

        // Method 1: Direct exposed APIs
        if (contextBridge._exposedAPIs) {
          Object.keys(contextBridge._exposedAPIs).forEach(api => bridgeAPIs.add(api));
        }

        // Method 2: Look for APIs in the prototype chain
        const prototypeProps = getObjectProperties(Object.getPrototypeOf(contextBridge));
        prototypeProps.forEach(prop => {
          if (typeof contextBridge[prop] === 'function' && prop.startsWith('expose')) {
            bridgeAPIs.add(prop);
          }
        });

        // Process all found APIs
        bridgeAPIs.forEach(api => {
          try {
            const exposedAPI = contextBridge._exposedAPIs?.[api];
            ipcEnumeration.channels.bridge[api] = {
              type: typeof exposedAPI,
              methods: getObjectProperties(exposedAPI),
              isObject: typeof exposedAPI === 'object'
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
      hasErrors: ipcEnumeration.errors.length > 0,
      windowCount: windows.length
    };

  } catch (e) {
    ipcEnumeration.errors.push(\`Error during IPC enumeration: \${e.message}\`);
  }

  return ipcEnumeration;
  `
};

export default EnumerateIPC;