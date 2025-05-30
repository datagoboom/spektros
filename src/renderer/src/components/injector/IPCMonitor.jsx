import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { 
  Box, 
  Typography, 
  IconButton, 
  Switch, 
  FormControlLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Tooltip,
  Button,
  TextField,
  Alert,
  CircularProgress,
  Badge,
  Tabs,
  Tab,
  Collapse
} from '@mui/material';
import { 
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  Clear as ClearIcon,
  CloudUpload as UploadIcon,
  Pause as PauseIcon,
  Download as DownloadIcon,
  FilterList as FilterIcon,
  Refresh as RefreshIcon,
  Settings as SettingsIcon,
  Sensors as SensorIcon
} from '@mui/icons-material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { useTheme } from '../../theme';
import { useInjector } from '../../contexts/InjectorContext';

// Enhanced IPC Monitor with improved performance and features
export default function IPCMonitor({ selectedApp, appConfig }) {
  const theme = useTheme();
  // Get state from context
  const {
    ipcIsUploaded, setIpcIsUploaded,
    ipcIsStreaming, setIpcIsStreaming,
    ipcTraffic, setIpcTraffic,
    ipcError, setIpcError,
    ipcIsUploading, setIpcIsUploading,
    ipcExpandedRow, setIpcExpandedRow,
    clearIpcTraffic,
    hookedAppSettings,
    getNextIpcMonitorPort,
    saveAppSettings,
  } = useInjector();

  // Always define app at the top level for use throughout the component
  const app = appConfig || selectedApp;

  // Use appConfig or selectedApp for connection info
  let config = appConfig || selectedApp;
  // Default to localhost if ip is missing or is a loopback address
  if (config) {
    let ip = config.ip;
    if (!ip || ip === '::1' || ip === 'localhost') {
      ip = '127.0.0.1';
    }
    config = { ...config, ip };
  }


  useEffect(() => {
    console.log('[IPC-MONITOR] selectedApp debug:', {
      selectedApp,
      hasUuid: !!selectedApp?.uuid,
      appConfigFromProps: appConfig,
      configFromLogic: config,
      keys: selectedApp ? Object.keys(selectedApp) : 'selectedApp is null/undefined'
    });
  }, [selectedApp, appConfig, config]);

  
  // Enhanced port calculation with debugging
  const ipcMonitorPort = useMemo(() => {
    // Use appConfig (passed as prop) instead of selectedApp (which is undefined)
    const app = appConfig || selectedApp;
    
    console.log('[IPC-MONITOR] Port calculation debug:', {
      appConfig,
      selectedApp,
      app,
      uuid: app?.uuid,
      ipc_monitor_port: app?.ipc_monitor_port
    });
    
    if (!app?.uuid) {
      console.warn('[IPC-MONITOR] No app UUID found, using fallback port 10012');
      return 10012;
    }
    
    // First try to get the port directly from the app object (most reliable)
    if (app.ipc_monitor_port) {
      console.log(`[IPC-MONITOR] Using direct port ${app.ipc_monitor_port} for app ${app.uuid}`);
      return app.ipc_monitor_port;
    }
    
    // Fallback to hookedAppSettings
    const appSettings = hookedAppSettings[app.uuid];
    if (appSettings?.ipc_monitor_port) {
      console.log(`[IPC-MONITOR] Using settings port ${appSettings.ipc_monitor_port} for app ${app.uuid}`);
      return appSettings.ipc_monitor_port;
    }
    
    console.warn(`[IPC-MONITOR] No ipc_monitor_port found for app ${app.uuid}, using fallback port 10012`);
    return 10012;
  }, [appConfig, selectedApp, hookedAppSettings]);
  
  // Local state for enhanced features
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [messageCount, setMessageCount] = useState(0);
  const [filterText, setFilterText] = useState('');
  const [selectedTab, setSelectedTab] = useState(0);
  const [autoScroll, setAutoScroll] = useState(true);
  const [maxMessages, setMaxMessages] = useState(1000);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [wsLatency, setWsLatency] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [hasRetried, setHasRetried] = useState(false);

  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const tableContainerRef = useRef(null);
  const lastPingRef = useRef(null);
  const reconnectLock = useRef(false);

  // Enhanced payload with better error handling and monitoring
  const getPayloadCode = useCallback((port) => `
    (function() {
      'use strict';
      
      // Prevent multiple instances
      if (global._ipcMonitorInstance) {
        console.log('[IPC-MONITOR] Instance already exists, cleaning up...');
        if (global._ipcMonitorInstance.cleanup) {
          global._ipcMonitorInstance.cleanup();
        }
      }
      
      let server = null;
      let ipcTraffic = [];
      let isRunning = false;
      let hookInstalled = false;
      let originalMethods = {};
      let messageId = 0;
      
      // Enhanced argument serialization
      function safeSerializeArgs(args, maxDepth = 3, currentDepth = 0) {
        if (currentDepth > maxDepth) return '[Max Depth Reached]';
        
        return args.map(arg => {
          try {
            if (arg === null) return { type: 'null', value: null };
            if (arg === undefined) return { type: 'undefined', value: undefined };
            if (typeof arg === 'function') return { type: 'function', value: '[Function: ' + (arg.name || 'anonymous') + ']' };
            if (typeof arg === 'string') {
              return { 
                type: 'string', 
                value: arg.length > 500 ? arg.substring(0, 500) + '...' : arg,
                truncated: arg.length > 500
              };
            }
            if (typeof arg === 'number' || typeof arg === 'boolean') {
              return { type: typeof arg, value: arg };
            }
            if (arg instanceof Error) {
              return { 
                type: 'error', 
                value: { 
                  name: arg.name, 
                  message: arg.message, 
                  stack: arg.stack?.split('\\n').slice(0, 10).join('\\n') 
                } 
              };
            }
            
            // Safe HTMLElement check - only check if HTMLElement is defined
            if (typeof HTMLElement !== 'undefined' && arg instanceof HTMLElement) {
              return { 
                type: 'HTMLElement', 
                value: \`<\${arg.tagName.toLowerCase()}\${arg.id ? ' id="' + arg.id + '"' : ''}\${arg.className ? ' class="' + arg.className + '"' : ''}>\`
              };
            }
            
            // Check for DOM-like objects without using instanceof
            if (arg && typeof arg === 'object' && arg.nodeType && arg.nodeName) {
              return {
                type: 'DOMNode',
                value: \`<\${arg.nodeName.toLowerCase()}\${arg.id ? ' id="' + arg.id + '"' : ''}\${arg.className ? ' class="' + arg.className + '"' : ''}>\`
              };
            }
            
            if (typeof arg === 'object') {
              if (Array.isArray(arg)) {
                return {
                  type: 'array',
                  value: arg.length > 10 ? 
                    [...arg.slice(0, 10).map(item => safeSerializeArgs([item], maxDepth, currentDepth + 1)[0]), '[' + (arg.length - 10) + ' more items...]'] :
                    arg.map(item => safeSerializeArgs([item], maxDepth, currentDepth + 1)[0]),
                  length: arg.length
                };
              }
              
              // Handle common object types
              if (arg.constructor && arg.constructor.name !== 'Object') {
                return { 
                  type: 'object', 
                  constructor: arg.constructor.name,
                  value: '[' + arg.constructor.name + ' instance]'
                };
              }
              
              // Serialize plain objects with limited depth
              const keys = Object.keys(arg);
              if (keys.length > 20) {
                const limitedObj = {};
                keys.slice(0, 20).forEach(key => {
                  try {
                    limitedObj[key] = safeSerializeArgs([arg[key]], maxDepth, currentDepth + 1)[0];
                  } catch (e) {
                    limitedObj[key] = { type: 'error', value: '[Property access error: ' + e.message + ']' };
                  }
                });
                return {
                  type: 'object',
                  value: limitedObj,
                  truncated: true,
                  totalKeys: keys.length
                };
              }
              
              const serializedObj = {};
              keys.forEach(key => {
                try {
                  serializedObj[key] = safeSerializeArgs([arg[key]], maxDepth, currentDepth + 1)[0];
                } catch (e) {
                  serializedObj[key] = { type: 'error', value: '[Property access error: ' + e.message + ']' };
                }
              });
              
              return { type: 'object', value: serializedObj };
            }
            return { type: typeof arg, value: String(arg) };
          } catch (e) {
            return { type: 'error', value: '[Serialization Error: ' + e.message + ']' };
          }
        });
      }
      
      // Enhanced WebSocket server with ping/pong
      function createWebSocketServer() {
        try {
          const http = require('http');
          const crypto = require('crypto');
          const clients = new Map(); // Use Map to store client metadata
          
          const server = http.createServer();
          
          server.on('upgrade', (request, socket, head) => {
            const key = request.headers['sec-websocket-key'];
            if (!key) {
              socket.end('HTTP/1.1 400 Bad Request\\r\\n\\r\\n');
              return;
            }
            
            const acceptKey = crypto
              .createHash('sha1')
              .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
              .digest('base64');
            
            const responseHeaders = [
              'HTTP/1.1 101 Switching Protocols',
              'Upgrade: websocket',
              'Connection: Upgrade',
              \`Sec-WebSocket-Accept: \${acceptKey}\`,
              '', ''
            ].join('\\r\\n');
            
            socket.write(responseHeaders);
            
            // Store client with metadata
            const clientId = crypto.randomBytes(4).toString('hex');
            clients.set(socket, {
              id: clientId,
              connectedAt: new Date(),
              lastPing: new Date(),
              isAlive: true
            });
            
            console.log(\`[IPC-MONITOR] Client \${clientId} connected. Total clients: \${clients.size}\`);
            
            // Send initial data
            sendWebSocketMessage(socket, JSON.stringify({
              type: 'connection',
              clientId: clientId,
              status: 'connected'
            }));
            
            // Send recent IPC traffic
            if (ipcTraffic.length > 0) {
              const recentTraffic = ipcTraffic.slice(-100);
              sendWebSocketMessage(socket, JSON.stringify({
                type: 'ipc-traffic',
                data: recentTraffic,
                total: ipcTraffic.length
              }));
            }
            
            // Handle WebSocket frames
            socket.on('data', (buffer) => {
              try {
                // Simple ping frame detection (0x89)
                if (buffer.length >= 2 && buffer[0] === 0x89) {
                  // Send pong frame (0x8A)
                  const pongFrame = Buffer.from([0x8A, 0x00]);
                  socket.write(pongFrame);
                  
                  const client = clients.get(socket);
                  if (client) {
                    client.lastPing = new Date();
                    client.isAlive = true;
                  }
                }
              } catch (e) {
                console.error('[IPC-MONITOR] Error handling WebSocket data:', e);
              }
            });
            
            socket.on('close', () => {
              const client = clients.get(socket);
              console.log(\`[IPC-MONITOR] Client \${client?.id || 'unknown'} disconnected\`);
              clients.delete(socket);
            });
            
            socket.on('error', (err) => {
              const client = clients.get(socket);
              console.error(\`[IPC-MONITOR] Client \${client?.id || 'unknown'} error:\`, err.message);
              clients.delete(socket);
            });
          });
          
          function sendWebSocketMessage(socket, message) {
            try {
              const buffer = Buffer.from(message, 'utf8');
              const frameLength = buffer.length;
              
              let frame;
              if (frameLength < 126) {
                frame = Buffer.alloc(frameLength + 2);
                frame[0] = 0x81;
                frame[1] = frameLength;
                buffer.copy(frame, 2);
              } else if (frameLength < 65536) {
                frame = Buffer.alloc(frameLength + 4);
                frame[0] = 0x81;
                frame[1] = 126;
                frame.writeUInt16BE(frameLength, 2);
                buffer.copy(frame, 4);
              } else {
                frame = Buffer.alloc(frameLength + 10);
                frame[0] = 0x81;
                frame[1] = 127;
                frame.writeUInt32BE(0, 2);
                frame.writeUInt32BE(frameLength, 6);
                buffer.copy(frame, 10);
              }
              
              if (!socket.destroyed) {
                socket.write(frame);
              }
            } catch (err) {
              console.error('[IPC-MONITOR] Error sending WebSocket message:', err);
              clients.delete(socket);
            }
          }
          
          function broadcastIPCTraffic(data) {
            const message = JSON.stringify({
              type: 'ipc-message',
              data: data,
              timestamp: new Date().toISOString()
            });
            
            const deadClients = [];
            clients.forEach((clientInfo, socket) => {
              if (socket.destroyed || !clientInfo.isAlive) {
                deadClients.push(socket);
              } else {
                sendWebSocketMessage(socket, message);
              }
            });
            
            // Clean up dead clients
            deadClients.forEach(socket => clients.delete(socket));
          }
          
          // Periodic ping to check client health
          const pingInterval = setInterval(() => {
            clients.forEach((clientInfo, socket) => {
              if (Date.now() - clientInfo.lastPing.getTime() > 60000) {
                console.log(\`[IPC-MONITOR] Client \${clientInfo.id} timed out\`);
                // Use destroy() instead of terminate() for raw socket
                if (socket.destroy) {
                  socket.destroy();
                } else {
                  socket.end();
                }
                clients.delete(socket);
              }
            });
          }, 30000);
          
          server.on('close', () => {
            clearInterval(pingInterval);
          });
          
          global._broadcastIPCTraffic = broadcastIPCTraffic;
          
          server.listen(${port}, '127.0.0.1', () => {
            console.log('[IPC-MONITOR] ✓ Enhanced WebSocket server listening on port ' + ${port});
          });
          
          server.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
              console.warn('[IPC-MONITOR] Port ' + ${port} + ' already in use');
            } else {
              console.error('[IPC-MONITOR] Server error:', err);
            }
          });
          
          return server;
        } catch (err) {
          console.error('[IPC-MONITOR] Failed to create WebSocket server:', err);
          return null;
        }
      }
      
      function logIPCTraffic(data) {
        try {
          const enhancedData = {
            ...data,
            id: ++messageId,
            timestamp: new Date().toISOString(),
            pid: process.pid
          };
          
          ipcTraffic.push(enhancedData);
          
          // Keep memory usage reasonable
          if (ipcTraffic.length > 2000) {
            ipcTraffic = ipcTraffic.slice(-1500);
          }
          
          if (global._broadcastIPCTraffic) {
            global._broadcastIPCTraffic(enhancedData);
          }
        } catch (e) {
          console.error('[IPC-MONITOR] Error logging IPC traffic:', e.message);
        }
      }
      
      function setupIPCHooks() {
        if (hookInstalled) {
          console.log('[IPC-MONITOR] Hooks already installed');
          return;
        }
        
        try {
          const { ipcMain } = require('electron');
          
          // Store original methods for cleanup
          originalMethods.on = ipcMain.on.bind(ipcMain);
          originalMethods.handle = ipcMain.handle.bind(ipcMain);
          originalMethods.removeAllListeners = ipcMain.removeAllListeners.bind(ipcMain);
          
          // Enhanced hook for ipcMain.on
          ipcMain.on = function(channel, handler) {
            const wrappedHandler = (event, ...args) => {
              const startTime = Date.now();
              
              logIPCTraffic({
                type: 'ipc_on',
                channel,
                args: safeSerializeArgs(args),
                sender: {
                  id: event.sender?.id,
                  url: event.sender?.getURL?.() || 'unknown'
                },
                performance: {
                  startTime
                }
              });
              
              try {
                const result = handler(event, ...args);
                
                logIPCTraffic({
                  type: 'ipc_on_complete',
                  channel,
                  duration: Date.now() - startTime
                });
                
                return result;
              } catch (error) {
                logIPCTraffic({
                  type: 'ipc_on_error',
                  channel,
                  error: error.message,
                  stack: error.stack?.split('\\n').slice(0, 5).join('\\n'),
                  duration: Date.now() - startTime
                });
                throw error;
              }
            };
            
            return originalMethods.on(channel, wrappedHandler);
          };
          
          // Enhanced hook for ipcMain.handle
          ipcMain.handle = function(channel, handler) {
            const wrappedHandler = async (event, ...args) => {
              const startTime = Date.now();
              const requestId = crypto.randomBytes(4).toString('hex');
              
              logIPCTraffic({
                type: 'ipc_handle',
                channel,
                requestId,
                args: safeSerializeArgs(args),
                sender: {
                  id: event.sender?.id,
                  url: event.sender?.getURL?.() || 'unknown'
                },
                performance: {
                  startTime
                }
              });
              
              try {
                const result = await handler(event, ...args);
                const duration = Date.now() - startTime;
                
                logIPCTraffic({
                  type: 'ipc_result',
                  channel,
                  requestId,
                  result: safeSerializeArgs([result])[0],
                  performance: {
                    duration,
                    resultSize: JSON.stringify(result).length
                  }
                });
                
                return result;
              } catch (error) {
                logIPCTraffic({
                  type: 'ipc_handle_error',
                  channel,
                  requestId,
                  error: error.message,
                  stack: error.stack?.split('\\n').slice(0, 5).join('\\n'),
                  performance: {
                    duration: Date.now() - startTime
                  }
                });
                throw error;
              }
            };
            
            return originalMethods.handle(channel, wrappedHandler);
          };
          
          hookInstalled = true;
          console.log('[IPC-MONITOR] Enhanced IPC hooks installed successfully');
          
        } catch (hookError) {
          console.error('[IPC-MONITOR] Error installing hooks:', hookError.message);
        }
      }
      
      function cleanup() {
        try {
          if (server) {
            server.close();
            server = null;
          }
          
          // Restore original methods if hooks were installed
          if (hookInstalled && originalMethods.on && originalMethods.handle) {
            const { ipcMain } = require('electron');
            ipcMain.on = originalMethods.on;
            ipcMain.handle = originalMethods.handle;
            hookInstalled = false;
            console.log('[IPC-MONITOR] IPC hooks restored');
          }
          
          isRunning = false;
          ipcTraffic = [];
          delete global._broadcastIPCTraffic;
          
          console.log('[IPC-MONITOR] Cleanup complete');
        } catch (err) {
          console.error('[IPC-MONITOR] Cleanup error:', err);
        }
      }
      
      function initialize() {
        if (isRunning) {
          console.log('[IPC-MONITOR] Already running');
          return { success: true, message: 'Already running' };
        }
        
        try {
          server = createWebSocketServer();
          isRunning = !!server;
          
          const { app } = require('electron');
          if (app.isReady()) {
            setupIPCHooks();
          } else {
            app.whenReady().then(setupIPCHooks);
          }
          
          console.log('[IPC-MONITOR] === ENHANCED INITIALIZATION COMPLETE ===');
          console.log('[IPC-MONITOR] WebSocket endpoint: ws://127.0.0.1:${port}');
          
          return { 
            success: true, 
            message: 'Initialized successfully',
            port: ${port},
            features: ['enhanced-serialization', 'performance-tracking', 'client-management']
          };
        } catch (err) {
          console.error('[IPC-MONITOR] Initialization failed:', err);
          return { success: false, error: err.message };
        }
      }
      
      // Store instance globally for cleanup
      global._ipcMonitorInstance = {
        initialize,
        cleanup,
        getStatus: () => ({
          isRunning,
          messageCount: ipcTraffic.length,
          hookInstalled,
          port: ${port}
        })
      };
      
      // Enhanced control function
      global.ipcMonitorPayload = function(action, options = {}) {
        switch (action) {
          case 'start':
            return initialize();
          case 'stop':
            cleanup();
            return { success: true, message: 'Stopped successfully' };
          case 'status':
            return global._ipcMonitorInstance.getStatus();
          case 'clear':
            ipcTraffic = [];
            return { success: true, message: 'Traffic cleared' };
          default:
            console.log('[IPC-MONITOR] Unknown action:', action);
            return { success: false, error: 'Unknown action' };
        }
      };
      
      // Auto-start
      const result = initialize();
      console.log('[IPC-MONITOR] Auto-start result:', result);
      
    })();
  `, []);

  
  
  // Enhanced WebSocket connection with better port resolution
  
  const connectWebSocket = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      return;
    }
  
    // Use appConfig (passed as prop) or fallback to selectedApp
    const app = appConfig || selectedApp;
    
    // Get the port - prefer direct from app object, fallback to settings
    let portToUse = 10012; // default fallback
    
    if (app?.ipc_monitor_port) {
      portToUse = app.ipc_monitor_port;
    } else if (app?.uuid && hookedAppSettings[app.uuid]?.ipc_monitor_port) {
      portToUse = hookedAppSettings[app.uuid].ipc_monitor_port;
    }
    
    console.log(`[IPC-MONITOR] connectWebSocket called with:`, {
      app,
      portToUse,
      ipcMonitorPort,
      appConfig,
      selectedApp
    });

  
    setConnectionStatus('connecting');
    
    try {
      const wsUrl = `ws://127.0.0.1:${portToUse}`;
      console.log(`[IPC-MONITOR] Connecting to WebSocket at: ${wsUrl}`);
      
      wsRef.current = new WebSocket(wsUrl);
      
      wsRef.current.onopen = () => {
        setConnectionStatus('connected');
        setIpcIsStreaming(true);
        setReconnectAttempts(0);
        setIpcError(null);
        setHasRetried(false);
        reconnectLock.current = false;
        lastPingRef.current = Date.now();
        console.log(`[IPC-MONITOR] WebSocket connected to port ${portToUse}`);
      };
      
      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'ipc-message') {
            setIpcTraffic(prev => {
              const newTraffic = [...prev, data.data];
              return newTraffic.slice(-maxMessages);
            });
            setMessageCount(prev => prev + 1);
          } else if (data.type === 'ipc-traffic') {
            setIpcTraffic(data.data);
            setMessageCount(data.total);
          } else if (data.type === 'connection') {
            console.log('[IPC-MONITOR] Connection confirmed:', data.clientId);
          }
          
          if (lastPingRef.current) {
            setWsLatency(Date.now() - lastPingRef.current);
            lastPingRef.current = null;
          }
        } catch (err) {
          console.error('[IPC-MONITOR] WebSocket message error:', err);
          setIpcError('Failed to parse WebSocket message');
        }
      };
      
      wsRef.current.onerror = (error) => {
        console.error('[IPC-MONITOR] WebSocket error:', error);
        setConnectionStatus('error');
        setIpcError(`WebSocket connection error to port ${portToUse}`);
      };
      
      wsRef.current.onclose = (event) => {
        console.log('[IPC-MONITOR] WebSocket closed:', event.code, event.reason);
        setConnectionStatus('disconnected');
        setIpcIsStreaming(false);
        if (event.code === 1006 && !hasRetried && !reconnectLock.current) {
          setHasRetried(true);
          reconnectLock.current = true;
          setTimeout(() => {
            connectWebSocket();
          }, 1000);
        } else {
          setReconnectAttempts(0);
        }
      };
    } catch (err) {
      console.error('[IPC-MONITOR] Failed to create WebSocket:', err);
      setConnectionStatus('error');
      setIpcError(`Failed to create WebSocket connection to port ${portToUse}`);
    }
  }, [maxMessages, reconnectAttempts, hasRetried, appConfig, selectedApp, hookedAppSettings, ipcMonitorPort]);
  

  // Enhanced upload function that ensures port is saved before connecting
  const handleUpload = async () => {
    setIpcIsUploading(true);
    setIpcError(null);
    
    try {
      // Use appConfig (passed as prop) or fallback to selectedApp
      const app = appConfig || selectedApp;
      
      if (!app || !app.ip) {
        throw new Error('Selected app is missing IP information');
      }
  
      if (!app.port) {
        throw new Error('Selected app is missing port configuration');
      }
  
      if (!app.uuid) {
        throw new Error('Selected app is missing UUID');
      }
  
      // Use the app's assigned main debug port for payload upload
      const debugPort = app.port;
      
      // Get the IPC monitor port (should already be assigned)
      let monitorPort = app.ipc_monitor_port;
      if (!monitorPort) {
        monitorPort = getNextIpcMonitorPort(hookedAppSettings);
        console.log(`[IPC-MONITOR] Assigning new monitor port ${monitorPort} to app ${app.uuid}`);
        // Save the new port to the app's settings
        saveAppSettings({ ...app, ipc_monitor_port: monitorPort });
        // Update the local reference
        monitorPort = monitorPort;
      }
  
      console.log(`[IPC-MONITOR] Upload starting - Debug port: ${debugPort}, Monitor port: ${monitorPort}`);
  
      const code = getPayloadCode(monitorPort);
      const encodedData = window.btoa(unescape(encodeURIComponent(code)));
      
      // Send payload to the app's main debug port
      const response = await fetch(`http://${app.ip}:${debugPort}/console`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Origin': `http://${app.ip}:${debugPort}`
        },
        body: JSON.stringify({
          data: encodedData,
          process: 'main'
        }),
        mode: 'cors',
        credentials: 'omit'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      if (!result.jobId) {
        throw new Error('No job ID received from server');
      }
      
      // Enhanced polling with exponential backoff
      const maxAttempts = 10;
      let attempt = 0;
      let delay = 500;
      
      while (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, delay));
        
        const resultResponse = await fetch(`http://${app.ip}:${debugPort}/result/${result.jobId}`);
        if (!resultResponse.ok) {
          throw new Error(`Failed to check job status: ${resultResponse.status}`);
        }
        
        const resultData = await resultResponse.json();
        
        if (resultData.error) {
          throw new Error(`Payload execution error: ${resultData.error}`);
        }
        
        if (resultData.status === 'completed') {
          setIpcIsUploaded(true);
          console.log(`[IPC-MONITOR] Payload uploaded successfully to ${app.ip}:${debugPort}, WebSocket will be on port ${monitorPort}`);
          break;
        }
        
        attempt++;
        delay = Math.min(delay * 1.5, 3000);
      }
      
      if (attempt >= maxAttempts) {
        throw new Error('Timeout waiting for payload execution');
      }
      
    } catch (err) {
      console.error('[IPC-MONITOR] Upload error:', err);
      setIpcError(`Upload failed: ${err.message}`);
      setIpcIsUploaded(false);
    } finally {
      setIpcIsUploading(false);
    }
  };
  

  // Connect WebSocket after upload and port assignment
  useEffect(() => {
    if (ipcIsUploaded && connectionStatus === 'disconnected' && ipcMonitorPort !== 10012) {
      connectWebSocket();
    }
    // eslint-disable-next-line
  }, [ipcIsUploaded, ipcMonitorPort]);

  // Enhanced disconnect function
  const handleDisconnect = useCallback(() => {
    // Stop auto-reconnect attempts
    setHasRetried(false); // Reset retry flag on manual disconnect
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close(1000, 'Manual disconnect');
      wsRef.current = null;
    }
    setConnectionStatus('disconnected');
    setIpcIsStreaming(false);
    setReconnectAttempts(0);
  }, []);

  // Reset payload state to allow re-upload
  const handleResetPayload = useCallback(() => {
    handleDisconnect();
    setIpcIsUploaded(false);
    clearIpcTraffic();
    setMessageCount(0);
  }, [handleDisconnect, clearIpcTraffic]);

  // Filter messages based on search text
  const filteredTraffic = useMemo(() => {
    if (!filterText.trim()) return ipcTraffic;
    
    const searchTerm = filterText.toLowerCase();
    return ipcTraffic.filter(item => 
      item.channel?.toLowerCase().includes(searchTerm) ||
      item.type?.toLowerCase().includes(searchTerm) ||
      JSON.stringify(item.args || '').toLowerCase().includes(searchTerm)
    );
  }, [ipcTraffic, filterText]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (autoScroll && tableContainerRef.current) {
      tableContainerRef.current.scrollTop = tableContainerRef.current.scrollHeight;
    }
  }, [filteredTraffic, autoScroll]);

  // Export function
  const handleExport = useCallback(() => {
    const exportData = {
      exported: new Date().toISOString(),
      app: selectedApp,
      messageCount: ipcTraffic.length,
      messages: ipcTraffic
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ipc-traffic-' + new Date().toISOString().slice(0, 19).replace(/:/g, '-') + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [ipcTraffic, selectedApp]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      handleDisconnect();
    };
  }, [handleDisconnect]);

  // Connection status indicator
  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'success';
      case 'connecting': return 'warning';
      case 'error': return 'error';
      default: return 'default';
    }
  };

  // Reset monitor when selected app changes
  useEffect(() => {
    handleResetPayload();
    // eslint-disable-next-line
  }, [config?.uuid]);

  return (
    <Box sx={{ 
      p: 2, 
      backgroundColor: theme.palette.background.paper,
      borderRadius: 1,
      height: '100%',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header */}
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        mb: 2 
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="subtitle2">IPC Monitor</Typography>
          <Chip 
            size="small" 
            label={connectionStatus}
            color={getStatusColor()}
            variant="outlined"
          />
          {wsLatency && (
            <Typography variant="caption" color={theme.palette.text.secondary}>
              {wsLatency}ms
            </Typography>
          )}
        </Box>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Tooltip title="Upload payload">
            <span>
              <IconButton
                size="small"
                onClick={handleUpload}
                color="primary"
                disabled={ipcIsUploading}
              >
                {ipcIsUploading ? <CircularProgress size={20} /> : <UploadIcon />}
              </IconButton>
            </span>
          </Tooltip>
          
          <Tooltip title="Connect to WebSocket">
            <span>
              <IconButton
                size="small"
                onClick={connectWebSocket}
                color="success"
                disabled={!app?.ipc_monitor_port || connectionStatus === 'connected' || connectionStatus === 'connecting'}
              >
                <PlayIcon />
              </IconButton>
            </span>
          </Tooltip>
          
          <Tooltip title="Disconnect">
            <span>
              <IconButton
                size="small"
                onClick={handleDisconnect}
                color="warning"
                disabled={connectionStatus === 'disconnected'}
              >
                <StopIcon />
              </IconButton>
            </span>
          </Tooltip>
          
          <Tooltip title="Reset payload (allows re-upload)">
            <span>
              <IconButton
                size="small"
                onClick={handleResetPayload}
                color="warning"
                disabled={ipcIsUploading}
              >
                <RefreshIcon />
              </IconButton>
            </span>
          </Tooltip>
          
          <Tooltip title="Clear traffic">
            <span>
              <IconButton
                color="error"
                size="small"
                onClick={clearIpcTraffic}
                disabled={!ipcTraffic.length}
              >
                <ClearIcon />
              </IconButton>
            </span>
          </Tooltip>
          
          <Tooltip title="Export data">
            <span>
              <IconButton
                color="success"
                size="small"
                onClick={handleExport}
                disabled={!ipcTraffic.length}
              >
                <DownloadIcon />
              </IconButton>
            </span>
          </Tooltip>
          
          <Tooltip title="Settings">
            <IconButton
              color="info"
              size="small"
              onClick={() => setShowSettings(!showSettings)}
            >
              <SettingsIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Error Alert */}
      {ipcError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setIpcError(null)}>
          {ipcError}
        </Alert>
      )}

      {/* Settings Panel */}
      <Collapse in={showSettings}>
        <Paper sx={{ p: 2, mb: 2, backgroundColor: theme.palette.background.paper }}>
          <Typography variant="subtitle2" gutterBottom>Settings</Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <FormControlLabel
              control={
                <Switch
                  checked={autoScroll}
                  onChange={(e) => setAutoScroll(e.target.checked)}
                  size="small"
                />
              }
              label="Auto-scroll"
            />
            <TextField
              label="Max Messages"
              type="number"
              value={maxMessages}
              onChange={(e) => setMaxMessages(Math.max(100, Math.min(5000, parseInt(e.target.value) || 1000)))}
              size="small"
              sx={{ width: 120 }}
            />
            <Typography variant="body2" color={theme.palette.text.secondary}>
              Total: {messageCount} | Filtered: {filteredTraffic.length}
            </Typography>
          </Box>
        </Paper>
      </Collapse>

      {/* Filter and Tabs */}
      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 1 }}>
          <TextField
            size="small"
            placeholder="Filter by channel, type, or content..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            sx={{ flexGrow: 1 }}
            InputProps={{
              startAdornment: <FilterIcon sx={{ mr: 1, color: theme.palette.text.secondary }} />
            }}
          />
          <Badge badgeContent={filteredTraffic.length} color="primary" max={9999}>
            <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
              Messages
            </Typography>
          </Badge>
        </Box>
        
        <Tabs 
          value={selectedTab} 
          onChange={(_, newValue) => setSelectedTab(newValue)}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab label="All Messages" />
          <Tab label="Requests" />
          <Tab label="Responses" />
          <Tab label="Errors" />
        </Tabs>
      </Box>

      {/* Traffic Table */}
      <Box sx={{ 
        flexGrow: 1,
        overflowY: 'auto',
        fontFamily: 'monospace',
        fontSize: '0.875rem'
      }}>
        {filteredTraffic.length > 0 ? (
          <TableContainer 
            component={Paper} 
            sx={{ backgroundColor: theme.palette.background.nav, maxHeight: '100%' }}
            ref={tableContainerRef}
          >
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: 40 }} />
                  <TableCell sx={{ width: 100 }}>Time</TableCell>
                  <TableCell sx={{ width: 120 }}>Type</TableCell>
                  <TableCell sx={{ width: 200 }}>Channel</TableCell>
                  <TableCell sx={{ width: 80 }}>Sender</TableCell>
                  <TableCell>Details</TableCell>
                  <TableCell sx={{ width: 80 }}>Duration</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredTraffic
                  .filter(item => {
                    if (selectedTab === 0) return true;
                    if (selectedTab === 1) return item.type.includes('handle') || item.type.includes('on');
                    if (selectedTab === 2) return item.type.includes('result') || item.type.includes('complete');
                    if (selectedTab === 3) return item.type.includes('error');
                    return true;
                  })
                  .map((item, index) => [
                    <TableRow
                      key={item.id || index}
                      hover
                      sx={{ 
                        cursor: 'pointer',
                        '&:hover': { backgroundColor: theme.palette.background.nav }
                      }}
                      onClick={() => setIpcExpandedRow(ipcExpandedRow === index ? null : index)}
                    >
                      <TableCell>
                        {ipcExpandedRow === index ? 
                          <ExpandLessIcon fontSize="small" /> : 
                          <ExpandMoreIcon fontSize="small" />
                        }
                      </TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem', color: theme.palette.text.primary }}>
                        {new Date(item.timestamp).toLocaleTimeString()}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={item.type.replace('ipc_', '')}
                          size="small"
                          color={
                            item.type.includes('error') ? 'error' :
                            item.type.includes('result') || item.type.includes('complete') ? 'success' :
                            item.type.includes('handle') ? 'info' :
                            'primary'
                          }
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell sx={{ 
                        color: theme.palette.text.primary, 
                        fontFamily: 'monospace',
                        fontSize: '0.8rem',
                        maxWidth: 200,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {item.channel}
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.75rem', color: theme.palette.text.primary }}>
                        {item.sender?.id || '-'}
                      </TableCell>
                      <TableCell sx={{ 
                        maxWidth: 300,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {item.error ? (
                          <Typography color="error" variant="body2">
                            {item.error}
                          </Typography>
                        ) : item.args ? (
                          <Typography sx={{ 
                            color: theme.palette.text.primary, 
                            fontFamily: 'monospace',
                            fontSize: '0.75rem'
                          }}>
                            {JSON.stringify(item.args).length > 100 ? 
                              JSON.stringify(item.args).substring(0, 100) + '...' :
                              JSON.stringify(item.args)
                            }
                          </Typography>
                        ) : item.result ? (
                          <Typography sx={{ 
                            color: theme.palette.text.primary,
                            fontFamily: 'monospace',
                            fontSize: '0.75rem'
                          }}>
                            {typeof item.result === 'string' ? item.result : JSON.stringify(item.result)}
                          </Typography>
                        ) : null}
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.75rem' }}>
                        {item.performance?.duration ? `${item.performance.duration}ms` : '-'}
                      </TableCell>
                    </TableRow>,
                    
                    // Expanded row
                    ipcExpandedRow === index && (
                      <TableRow key={`${item.id || index}-expanded`}>
                        <TableCell colSpan={7} sx={{ backgroundColor: theme.palette.background.terminal, p: 2 }}>
                          <Box sx={{ 
                            fontSize: '0.8em', 
                            color: theme.palette.text.primary, 
                            fontFamily: 'monospace',
                            whiteSpace: 'pre-wrap', 
                            wordBreak: 'break-all',
                            maxHeight: 400,
                            overflow: 'auto',
                            backgroundColor: theme.palette.background.terminal,
                            p: 2,
                            borderRadius: 1
                          }}>
                            <Typography variant="subtitle2" sx={{ color: theme.palette.text.primary, mb: 1 }}>
                              Full Message Details
                            </Typography>
                            {JSON.stringify(item, null, 2)}
                          </Box>
                        </TableCell>
                      </TableRow>
                    )
                  ])}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center',
            height: '100%',
            gap: 2
          }}>
            <Typography color={theme.palette.text.secondary} variant="h6">
              {!app?.ipc_monitor_port ? 'Upload payload to start monitoring' :
               connectionStatus === 'disconnected' ? 'Connect to start streaming' :
               connectionStatus === 'connecting' ? 'Connecting to WebSocket...' :
               'Waiting for IPC traffic'}
            </Typography>
            
            {connectionStatus === 'connecting' && (
              <CircularProgress size={24} />
            )}
            
            {connectionStatus === 'connected' && (
              <>
                <SensorIcon 
                  sx={{ 
                    fontSize: 48,
                    color: theme.palette.text.primary,
                    animation: 'spin 1s linear infinite',
                    '@keyframes spin': {
                      '0%': { transform: 'rotate(0deg)' },
                      '100%': { transform: 'rotate(360deg)' }
                    }
                  }} 
                />
                <Typography variant="body2" color={theme.palette.text.secondary}>
                  The monitor is active. IPC traffic will appear here as it occurs.
                </Typography>
              </>
            )}
            
            {!app?.ipc_monitor_port && (
              <Button 
                variant="contained" 
                startIcon={<UploadIcon />}
                onClick={handleUpload}
                disabled={ipcIsUploading || !selectedApp}
              >
                Upload Monitor Payload
              </Button>
            )}
          </Box>
        )}
      </Box>
      
      {/* Status Bar */}
      <Box sx={{ 
        mt: 1, 
        pt: 1, 
        borderTop: 1, 
        borderColor: 'divider',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <Typography variant="caption" color={theme.palette.text.secondary}>
          Status: {connectionStatus} | 
          Messages: {filteredTraffic.length}/{messageCount} | 
          {reconnectAttempts > 0 && `Reconnect attempts: ${reconnectAttempts} | `}
          {hasRetried && connectionStatus !== 'connected' && 'Auto-reconnect: ATTEMPTED'}
        </Typography>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {wsLatency && (
            <Typography variant="caption" color={theme.palette.text.secondary}>
              Latency: {wsLatency}ms
            </Typography>
          )}
          <Typography variant="caption" color={theme.palette.text.secondary}>
            Port: {ipcMonitorPort}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}