#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError
} from '@modelcontextprotocol/sdk/types.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import axios, { AxiosError } from 'axios';
import { spawn, exec } from 'child_process';
import * as os from 'os';
import * as path from 'path';

// Get configuration from environment
const DEBUG_PORT = process.env.DEBUG_PORT || '10100';
const DEBUG_HOST = process.env.DEBUG_HOST || 'localhost';
const BASE_URL = `http://${DEBUG_HOST}:${DEBUG_PORT}`;

// Helper to handle API errors
function handleApiError(error: unknown): never {
  if (error instanceof AxiosError) {
    if (error.response) {
      throw new McpError(
        ErrorCode.InternalError,
        `API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`
      );
    } else if (error.request) {
      throw new McpError(
        ErrorCode.InternalError,
        `No response from debug server at ${BASE_URL}. Is the Electron app running with the hook?`
      );
    }
  }
  throw new McpError(
    ErrorCode.InternalError,
    `Unknown error: ${error instanceof Error ? error.message : String(error)}`
  );
}

// Helper to execute code and wait for result
async function executeCode(code: string, process: 'main' | 'renderer', windowId?: number): Promise<any> {
  try {
    // If windowId is specified, inject it into the code for renderer process
    if (process === 'renderer' && windowId !== undefined) {
      code = `
        const targetWindow = BrowserWindow.getAllWindows().find(w => w.id === ${windowId});
        if (!targetWindow) {
          throw new Error('Window with id ${windowId} not found');
        }
        const activeWindow = targetWindow;
        ${code}
      `;
    }

    // Encode the code as base64
    const encodedCode = Buffer.from(code).toString('base64');
    
    // Submit the job
    const submitResponse = await axios.post(`${BASE_URL}/console`, {
      data: encodedCode,
      process: process
    });

    const { jobId } = submitResponse.data;

    // Poll for the result
    let attempts = 0;
    const maxAttempts = 360; // 360 seconds timeout
    
    while (attempts < maxAttempts) {
      try {
        const resultResponse = await axios.get(`${BASE_URL}/result/${jobId}`);
        const result = resultResponse.data;

        if (result.status === 'completed') {
          return result.result;
        } else if (result.status === 'error') {
          throw new Error(`Execution error: ${result.error}\n${result.stack || ''}`);
        } else if (result.status === 'timeout') {
          throw new Error('Execution timed out');
        }
      } catch (error: any) {
        if (error.response?.status !== 404) {
          throw error;
        }
        // 404 means job not ready yet, continue polling
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
    }

    throw new Error('Timeout waiting for execution result');
  } catch (error) {
    handleApiError(error);
  }
}

// Protocol Handler Testing Class
class ProtocolHandlerTester {
  private system: string;
  private testResults: Array<{url: string, result: any}> = [];

  constructor() {
    this.system = os.platform();
  }

  async openProtocolUrl(url: string): Promise<any> {
    try {
      let command: string;
      let args: string[];

      if (this.system === 'linux') {
        command = 'xdg-open';
        args = [url];
      } else if (this.system === 'darwin') {
        command = 'open';
        args = [url];
      } else if (this.system === 'win32') {
        command = 'cmd';
        args = ['/c', 'start', '', url];
      } else {
        return { error: `Unsupported system: ${this.system}` };
      }

      return new Promise((resolve) => {
        const child = spawn(command, args, {
          stdio: ['ignore', 'pipe', 'pipe']
        });

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (data) => {
          stdout += data.toString();
        });

        child.stderr.on('data', (data) => {
          stderr += data.toString();
        });

        child.on('close', (code) => {
          resolve({
            success: code === 0,
            stdout: stdout,
            stderr: stderr,
            returncode: code
          });
        });

        child.on('error', (error) => {
          resolve({
            error: error.message,
            success: false
          });
        });

        // Timeout after 5 seconds
        setTimeout(() => {
          child.kill();
          resolve({
            error: 'Command timed out',
            timeout: true
          });
        }, 5000);
      });
    } catch (error) {
      return { error: String(error) };
    }
  }

  async checkProtocolRegistration(protocol: string): Promise<boolean> {
    try {
      if (this.system === 'linux') {
        return new Promise((resolve) => {
          exec(`xdg-mime query default x-scheme-handler/${protocol}`, (error, stdout) => {
            resolve(!error && stdout.trim().length > 0);
          });
        });
      } else if (this.system === 'darwin') {
        return new Promise((resolve) => {
          exec(`open -a Finder "${protocol}://test"`, (error, stdout, stderr) => {
            // If there's no application, it will show an error
            resolve(!stderr.toLowerCase().includes('no application'));
          });
        });
      } else if (this.system === 'win32') {
        // For Windows, we'll try to open the protocol and see if it fails
        return new Promise((resolve) => {
          exec(`cmd /c start "" "${protocol}://test"`, (error) => {
            // If it doesn't fail immediately, assume it's registered
            resolve(!error);
          });
        });
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  generateTestUrls(protocol: string): string[] {
    const testCases = [
      // Basic tests
      `${protocol}://test`,
      `${protocol}://localhost`,
      `${protocol}://127.0.0.1`,
      
      // XSS attempts
      `${protocol}://test?param=<script>alert(1)</script>`,
      `${protocol}://test#<script>alert(1)</script>`,
      `${protocol}://<img src=x onerror=alert(1)>`,
      
      // Path traversal
      `${protocol}://../../../../etc/passwd`,
      `${protocol}://../../../Windows/System32/cmd.exe`,
      `${protocol}://test/../../../sensitive/file`,
      
      // Protocol confusion
      `${protocol}://javascript:alert(1)`,
      `${protocol}://file:///etc/passwd`,
      `${protocol}://http://evil.com`,
      
      // URL encoding bypass
      `${protocol}://%6A%61%76%61%73%63%72%69%70%74%3Aalert(1)`,
      `${protocol}://test%0D%0A%0D%0A<script>alert(1)</script>`,
      `${protocol}://test%00.html`,
      
      // Command injection
      `${protocol}://test;whoami;`,
      `${protocol}://test|calc|`,
      `${protocol}://test$(touch /tmp/pwned)`,
      
      // SSRF attempts
      `${protocol}://localhost:10101`,  // Spektros port
      `${protocol}://169.254.169.254`,  // AWS metadata
      `${protocol}://[::1]:22`,
      
      // Unicode/special characters
      `${protocol}://test\u0000.com`,
      `${protocol}://test\u200b.com`,  // Zero-width space
      `${protocol}://test\uffff`,
      
      // Double encoding
      `${protocol}://%252e%252e%252f%252e%252e%252fetc%252fpasswd`,
      
      // Authority confusion
      `${protocol}://google.com@evil.com`,
      `${protocol}://user:pass@evil.com`,
      `${protocol}://test@evil.com:8080`,
    ];
    
    return testCases;
  }

  getTestResults(): Array<{url: string, result: any}> {
    return this.testResults;
  }

  addTestResult(url: string, result: any): void {
    this.testResults.push({ url, result });
  }
}

// Built-in payloads
const PAYLOADS = {
    devtools: (windowId?: number) => `
      // BrowserWindow is already available in context
      if (windows.length === 0) {
        return { error: 'No windows found' };
      }
      
      const targetWindow = ${windowId !== undefined 
        ? `windows.find(w => w.id === ${windowId})` 
        : 'windows.find(w => w.isFocused()) || windows[0]'};
      
      if (!targetWindow) {
        return { error: 'Target window not found' };
      }
      
      const wasOpen = targetWindow.webContents.isDevToolsOpened();
      if (wasOpen) {
        targetWindow.webContents.closeDevTools();
      } else {
        targetWindow.webContents.openDevTools();
      }
      
      return {
        windowId: targetWindow.id,
        title: targetWindow.getTitle(),
        devToolsOpen: !wasOpen,
        action: wasOpen ? 'closed' : 'opened'
      };
    `,
  
    enableAllDevtools: () => `
      // BrowserWindow is already available in context
      const results = [];
      
      for (const window of windows) {
        try {
          const wasOpen = window.webContents.isDevToolsOpened();
          if (!wasOpen) {
            window.webContents.openDevTools();
          }
          results.push({
            windowId: window.id,
            title: window.getTitle(),
            wasAlreadyOpen: wasOpen,
            success: true
          });
        } catch (error) {
          results.push({
            windowId: window.id,
            error: error.message,
            success: false
          });
        }
      }
      
      return {
        totalWindows: windows.length,
        results: results,
        successCount: results.filter(r => r.success).length
      };
    `,
  
    getWindows: () => `
      // BrowserWindow and windows are already available in context
      return windows.map(win => ({
        id: win.id,
        title: win.getTitle(),
        url: win.webContents?.getURL() || 'unknown',
        bounds: win.getBounds(),
        visible: win.isVisible(),
        focused: win.isFocused(),
        devToolsOpen: win.webContents?.isDevToolsOpened() || false
      }));
    `,
  
    getAppInfo: () => `
      // app and BrowserWindow are already available in context
      return {
        app: {
          name: app.getName(),
          version: app.getVersion(),
          locale: app.getLocale(),
          isPackaged: app.isPackaged,
          appPath: app.getAppPath(),
          userDataPath: app.getPath('userData')
        },
        system: {
          platform: platform,
          arch: process.arch,
          versions: versions,
          pid: process.pid,
          uptime: Math.round(process.uptime())
        },
        windows: windows.map(win => ({
          id: win.id,
          title: win.getTitle(),
          url: win.webContents?.getURL() || 'Unknown'
        }))
      };
    `,
  
    getProcessInfo: () => `
      // app is already available in context
      return {
        process: {
          pid: process.pid,
          ppid: process.ppid || 'unavailable',
          platform: platform,
          arch: process.arch,
          versions: versions,
          argv: process.argv,
          execPath: process.execPath,
          cwd: process.cwd(),
          uptime: process.uptime(),
          memoryUsage: process.memoryUsage(),
          cpuUsage: process.cpuUsage()
        },
        environment: {
          NODE_ENV: process.env.NODE_ENV,
          ELECTRON_IS_DEV: process.env.ELECTRON_IS_DEV,
          appName: app.getName(),
          appVersion: app.getVersion()
        }
      };
    `,
  
    getIpcChannels: () => `
      return (async () => {
        // We need to require ipcMain since it's not in the default context
        const { ipcMain } = require('electron');
        
        const channels = {
          main: [],
          errors: []
        };
        
        // Get main process IPC channels
        if (ipcMain._events) {
          channels.main = Object.keys(ipcMain._events);
        }
        
        // Try to get renderer channels from all windows
        for (const win of windows) {
          try {
            const rendererChannels = await win.webContents.executeJavaScript(\`
              (function() {
                try {
                  const { ipcRenderer } = require('electron');
                  if (ipcRenderer && ipcRenderer._events) {
                    return Object.keys(ipcRenderer._events);
                  }
                } catch (e) {
                  // ipcRenderer might not be available in this context
                }
                return [];
              })();
            \`);
            
            channels[\`renderer_window_\${win.id}\`] = rendererChannels;
          } catch (error) {
            channels.errors.push(\`Window \${win.id}: \${error.message}\`);
          }
        }
        
        return channels;
      })();
    `,
  
    getStorage: (windowId?: number) => `
      return {
        timestamp: new Date().toISOString(),
        url: location.href,
        origin: location.origin,
        localStorage: Object.fromEntries(
          Object.keys(localStorage).map(key => {
            try {
              const value = localStorage.getItem(key);
              return [key, JSON.parse(value)];
            } catch {
              return [key, localStorage.getItem(key)];
            }
          })
        ),
        sessionStorage: Object.fromEntries(
          Object.keys(sessionStorage).map(key => {
            try {
              const value = sessionStorage.getItem(key);
              return [key, JSON.parse(value)];
            } catch {
              return [key, sessionStorage.getItem(key)];
            }
          })
        ),
        cookies: document.cookie.split(';').map(c => c.trim()).filter(c => c)
      };
    `
  };

// Create the MCP server
const server = new Server(
  {
    name: 'electron-debug-mcp',
    version: '1.0.0'
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

// Create protocol handler tester instance
const protocolTester = new ProtocolHandlerTester();

// Tool definitions
const TOOLS: Tool[] = [
  {
    name: 'get_info',
    description: 'Get basic information about the Electron app',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'get_windows',
    description: 'List all Electron windows with their properties',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'toggle_devtools',
    description: 'Toggle DevTools for a specific window or the focused window',
    inputSchema: {
      type: 'object',
      properties: {
        windowId: {
          type: 'number',
          description: 'ID of the window to toggle DevTools for. If not specified, uses the focused window.'
        }
      },
      required: []
    }
  },
  {
    name: 'enable_all_devtools',
    description: 'Enable DevTools for all windows',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'get_process_info',
    description: 'Get detailed process and environment information',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'get_ipc_channels',
    description: 'List all IPC channels in main and renderer processes',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'get_storage',
    description: 'Get localStorage, sessionStorage and cookies from a renderer process',
    inputSchema: {
      type: 'object',
      properties: {
        windowId: {
          type: 'number',
          description: 'ID of the window to get storage from. If not specified, uses the first window.'
        }
      },
      required: []
    }
  },
  {
    name: 'execute_main',
    description: 'Execute arbitrary JavaScript code in the main process',
    inputSchema: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description: 'JavaScript code to execute in the main process'
        }
      },
      required: ['code']
    }
  },
  {
    name: 'execute_renderer',
    description: 'Execute arbitrary JavaScript code in a renderer process',
    inputSchema: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description: 'JavaScript code to execute in the renderer process'
        },
        windowId: {
          type: 'number',
          description: 'ID of the window to execute code in. If not specified, uses the first window.'
        }
      },
      required: ['code']
    }
  },
  {
    name: 'check_connection',
    description: 'Check if the debug server is accessible',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'test_protocol',
    description: 'Test a protocol handler with various payloads',
    inputSchema: {
      type: 'object',
      properties: {
        protocol: {
          type: 'string',
          description: 'Protocol to test (e.g., mattermost, http)'
        },
        custom_url: {
          type: 'string',
          description: 'Optional custom URL to test'
        }
      },
      required: ['protocol']
    }
  },
  {
    name: 'check_protocol_registration',
    description: 'Check if a protocol is registered on the system',
    inputSchema: {
      type: 'object',
      properties: {
        protocol: {
          type: 'string',
          description: 'Protocol to check'
        }
      },
      required: ['protocol']
    }
  },
  {
    name: 'test_specific_url',
    description: 'Test a specific protocol URL',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'Full URL to test'
        }
      },
      required: ['url']
    }
  },
  {
    name: 'get_protocol_test_results',
    description: 'Get all protocol test results',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  }
];

// Handle list tools request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: TOOLS
  };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'check_connection':
        try {
          const response = await axios.get(`${BASE_URL}/info`);
          return {
            content: [
              {
                type: 'text',
                text: `Debug server is accessible at ${BASE_URL}\n${JSON.stringify(response.data, null, 2)}`
              }
            ]
          };
        } catch (error) {
          handleApiError(error);
        }

      case 'get_info':
        const appInfo = await executeCode(PAYLOADS.getAppInfo(), 'main');
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(appInfo, null, 2)
            }
          ]
        };

      case 'get_windows':
        const windows = await executeCode(PAYLOADS.getWindows(), 'main');
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(windows, null, 2)
            }
          ]
        };

      case 'toggle_devtools':
        const devtoolsResult = await executeCode(
          PAYLOADS.devtools(args?.windowId as number | undefined),
          'main'
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(devtoolsResult, null, 2)
            }
          ]
        };

      case 'enable_all_devtools':
        const allDevtoolsResult = await executeCode(PAYLOADS.enableAllDevtools(), 'main');
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(allDevtoolsResult, null, 2)
            }
          ]
        };

      case 'get_process_info':
        const processInfo = await executeCode(PAYLOADS.getProcessInfo(), 'main');
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(processInfo, null, 2)
            }
          ]
        };

      case 'get_ipc_channels':
        const ipcChannels = await executeCode(PAYLOADS.getIpcChannels(), 'main');
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(ipcChannels, null, 2)
            }
          ]
        };

      case 'get_storage':
        const storage = await executeCode(
          PAYLOADS.getStorage(args?.windowId as number | undefined),
          'renderer',
          args?.windowId as number | undefined
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(storage, null, 2)
            }
          ]
        };

      case 'execute_main':
        if (!args?.code) {
          throw new McpError(ErrorCode.InvalidParams, 'Code parameter is required');
        }
        const mainResult = await executeCode(args.code as string, 'main');
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(mainResult, null, 2)
            }
          ]
        };

      case 'execute_renderer':
        if (!args?.code) {
          throw new McpError(ErrorCode.InvalidParams, 'Code parameter is required');
        }
        const rendererResult = await executeCode(
          args.code as string,
          'renderer',
          args.windowId as number | undefined
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(rendererResult, null, 2)
            }
          ]
        };

      case 'test_protocol':
        const protocol = args?.protocol as string;
        if (!protocol) {
          throw new McpError(ErrorCode.InvalidParams, 'Protocol parameter is required');
        }
        
        const results = [];
        
        // Check if protocol is registered
        const isRegistered = await protocolTester.checkProtocolRegistration(protocol);
        results.push(`Protocol '${protocol}' registered: ${isRegistered}`);
        
        if (args?.custom_url) {
          // Test custom URL
          const result = await protocolTester.openProtocolUrl(args.custom_url as string);
          results.push(`Custom URL test: ${JSON.stringify(result)}`);
          protocolTester.addTestResult(args.custom_url as string, result);
        } else {
          // Test all generated URLs
          const testUrls = protocolTester.generateTestUrls(protocol);
          results.push(`\nTesting ${testUrls.length} URLs for ${protocol}://`);
          
          // Limit to first 5 for safety
          for (let i = 0; i < Math.min(5, testUrls.length); i++) {
            const url = testUrls[i];
            const result = await protocolTester.openProtocolUrl(url);
            results.push(`\nURL: ${url}`);
            results.push(`Result: ${JSON.stringify(result)}`);
            
            protocolTester.addTestResult(url, result);
            
            // Add delay to avoid overwhelming the system
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
        
        return {
          content: [
            {
              type: 'text',
              text: results.join('\n')
            }
          ]
        };

      case 'check_protocol_registration':
        const checkProtocol = args?.protocol as string;
        if (!checkProtocol) {
          throw new McpError(ErrorCode.InvalidParams, 'Protocol parameter is required');
        }
        
        const isRegisteredResult = await protocolTester.checkProtocolRegistration(checkProtocol);
        
        return {
          content: [
            {
              type: 'text',
              text: `Protocol '${checkProtocol}' is ${isRegisteredResult ? 'registered' : 'not registered'} on ${protocolTester['system']}`
            }
          ]
        };

      case 'test_specific_url':
        const testUrl = args?.url as string;
        if (!testUrl) {
          throw new McpError(ErrorCode.InvalidParams, 'URL parameter is required');
        }
        
        const urlResult = await protocolTester.openProtocolUrl(testUrl);
        protocolTester.addTestResult(testUrl, urlResult);
        
        return {
          content: [
            {
              type: 'text',
              text: `URL: ${testUrl}\nResult: ${JSON.stringify(urlResult)}`
            }
          ]
        };

      case 'get_protocol_test_results':
        const testResults = protocolTester.getTestResults();
        
        return {
          content: [
            {
              type: 'text',
              text: `Total tests run: ${testResults.length}\n` + 
                    testResults.slice(-10).map(r => `${r.url}: ${r.result.success || false}`).join('\n')
            }
          ]
        };

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
  } catch (error) {
    if (error instanceof McpError) {
      throw error;
    }
    throw new McpError(
      ErrorCode.InternalError,
      `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`Electron Debug MCP Server running on ${BASE_URL}`);
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});