import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'


const api = {
  
  analysis: {
    extractAsar: (asarPath) => ipcRenderer.invoke('analysis:extract', asarPath),
    getFileContent: (filePath) => ipcRenderer.invoke('analysis:getFileContent', filePath),
    getFileTree: (tmpDir) => ipcRenderer.invoke('analysis:getFileTree', tmpDir),
    saveFile: (filePath, content) => ipcRenderer.invoke('analysis:saveFile', filePath, content),
    search: (tmpDir, searchQuery, options) => ipcRenderer.invoke('analysis:search', tmpDir, searchQuery, options),
    replace: (tmpDir, searchQuery, replaceText, options, targetFiles) => 
      ipcRenderer.invoke('analysis:replace', tmpDir, searchQuery, replaceText, options, targetFiles),
    repack: (sourceDir, outputPath) => ipcRenderer.invoke('analysis:repack', sourceDir, outputPath)
  },
  
  
  app: {
    getThemes: () => ipcRenderer.invoke('app:getThemes'),
    loadTheme: (themeId) => ipcRenderer.invoke('app:loadTheme', themeId),
  },
  
  
  inject: {
    setup: (asarPath) => ipcRenderer.invoke('inject:setup', asarPath),
    injectPayload: (payloadPath, asarPath) => ipcRenderer.invoke('inject:payload', payloadPath, asarPath),
    createPayload: (name, content, category) => ipcRenderer.invoke('inject:createPayload', name, content, category),
    listBackups: (asarPath) => ipcRenderer.invoke('inject:listBackups', asarPath),
    restoreBackup: (backupPath, asarPath) => ipcRenderer.invoke('inject:restoreBackup', backupPath, asarPath),
    deleteBackup: (backupPath) => ipcRenderer.invoke('inject:deleteBackup', backupPath),
    startListener: () => ipcRenderer.invoke('inject:startListener'),
    stopListener: () => ipcRenderer.invoke('inject:stopListener'),
    getServerStatus: () => ipcRenderer.invoke('inject:getServerStatus'),
    sendPayload: (appPort, payload, options) => ipcRenderer.invoke('inject:sendPayload', appPort, payload, options),
    getPayloadStatus: (appPort, jobId) => ipcRenderer.invoke('inject:getPayloadStatus', appPort, jobId),
    hook: (config, customTarget = null) => ipcRenderer.invoke('inject:hook', config, customTarget)
  },
  
  
  callHome: {
    onData: (callback) => ipcRenderer.on('call-home-data', callback),
    removeListeners: () => ipcRenderer.removeAllListeners('call-home-data')
  },
  
  
  fileDialog: {
    openFile: (options) => ipcRenderer.invoke('file-dialog:get-path', options),
    saveFile: (options) => ipcRenderer.invoke('file-dialog:save', options)
  }
}


if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error('Failed to expose APIs:', error)
  }
} else {
  
  window.electron = electronAPI
  window.api = api
}