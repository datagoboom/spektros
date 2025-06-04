import React, { createContext, useContext, useState, useCallback } from 'react';

const ApiContext = createContext(null);

export function ApiProvider({ children }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentAsarInfo, setCurrentAsarInfo] = useState(null);
  const [isSetupComplete, setIsSetupComplete] = useState(false);
  const [fileTree, setFileTree] = useState([]); 

  
  const handleApiCall = useCallback(async (apiCall, loadingMessage = 'Processing...') => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log(`🔄 ${loadingMessage}`);
      const result = await apiCall();
      
      if (!result.success) {
        throw new Error(result.error || 'API call failed');
      }
      
      return result;
    } catch (err) {
      const errorMessage = err.message || 'Unknown error occurred';
      console.error('API Error:', errorMessage);
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  
  const setupInjection = useCallback(async (asarPath) => {
    const result = await handleApiCall(
      () => window.api.inject.setup(asarPath),
      `Setting up injection system for: ${asarPath}`
    );
    
    setCurrentAsarInfo({
      originalPath: asarPath,
      backupPath: result.backupPath,
      injectedFile: result.injectedFile,
      setupAt: new Date().toISOString()
    });
    
    setIsSetupComplete(true);
    
    return result;
  }, [handleApiCall]);

  
  const extractAsar = useCallback(async (asarPath) => {
    const result = await handleApiCall(
      () => window.api.analysis.extractAsar(asarPath),
      `Extracting ASAR: ${asarPath}`
    );
    
    return result;
  }, [handleApiCall]);

  const getFileContent = useCallback(async (filePath) => {
    const result = await handleApiCall(
      () => window.api.analysis.getFileContent(filePath),
      `Reading file: ${filePath}`
    );
    
    return result.content;
  }, [handleApiCall]);

  const saveFile = useCallback(async (filePath, content) => {
    const result = await handleApiCall(
      () => window.api.analysis.saveFile(filePath, content),
      `Saving file: ${filePath}`
    );
    
    return result;
  }, [handleApiCall]);

  
  const searchFiles = useCallback(async (tmpDir, searchQuery, options = {}) => {
    const result = await handleApiCall(
      () => window.api.analysis.search(tmpDir, searchQuery, options),
      `Searching for: ${searchQuery}`
    );
    
    return {
      results: result.results,
      totalMatches: result.totalMatches,
      fileCount: result.fileCount,
      searchTime: result.searchTime,
      query: result.query,
      options: result.options
    };
  }, [handleApiCall]);

  
  const createPayload = useCallback(async (name, content, category = 'custom') => {
    const result = await handleApiCall(
      () => window.api.inject.createPayload(name, content, category),
      `Creating payload: ${name}`
    );
    
    return result;
  }, [handleApiCall]);

  const injectPayload = useCallback(async (payloadPath, asarPath) => {
    const result = await handleApiCall(
      () => window.api.inject.injectPayload(payloadPath, asarPath),
      `Injecting additional payload`
    );
    
    return result;
  }, [handleApiCall]);

  
  const listBackups = useCallback(async (asarPath = null) => {
    const result = await handleApiCall(
      () => window.api.inject.listBackups(asarPath),
      'Loading backups'
    );
    
    return result;
  }, [handleApiCall]);

  const restoreBackup = useCallback(async (backupPath, asarPath) => {
    const result = await handleApiCall(
      () => window.api.inject.restoreBackup(backupPath, asarPath),
      'Restoring from backup'
    );
    
    
    setIsSetupComplete(false);
    setCurrentAsarInfo(null);
    
    return result;
  }, [handleApiCall]);

  const deleteBackup = useCallback(async (backupPath) => {
    const result = await handleApiCall(
      () => window.api.inject.deleteBackup(backupPath),
      'Deleting backup'
    );
    
    return result;
  }, [handleApiCall]);


  
  const openFileDialog = useCallback(async (options = {}) => {
    try {      
      const result = await window.api.fileDialog.openFile(options);
      console.log('📁 File dialog raw result:', result);
      if (result){
        return result;
      }
    } catch (err) {
      console.error('File dialog error:', err);
      setError(err.message || 'Failed to open file dialog');
      throw err;
    }
  }, []);

  const saveFileDialog = useCallback(async (options = {}) => {
    try {
      const result = await window.api.fileDialog.saveFile(options);
      console.log('💾 Save dialog result:', result);
      if (result.success) {
        return result;
      }
      return null;
    } catch (err) {
      console.error('Save dialog error:', err);
      setError(err.message || 'Failed to open save dialog');
      throw err;
    }
  }, []);

  
  const loadAsar = useCallback(async (asarPath) => {
    try {
      
      const extractResult = await extractAsar(asarPath);
      
      
      const treeResult = await handleApiCall(
        () => window.api.analysis.getFileTree(extractResult.tmpDir),
        `Building file tree: ${extractResult.tmpDir}`
      );
      
      
      setFileTree(treeResult.tree);
      
      return {
        ...extractResult,
        tree: treeResult.tree
      };
    } catch (error) {
      console.error('Failed to load ASAR:', error);
      throw error;
    }
  }, [extractAsar, handleApiCall]);

  
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const resetState = useCallback(() => {
    setCurrentAsarInfo(null);
    setIsSetupComplete(false);
    setFileTree([]);
    setError(null);
    setIsLoading(false);
  }, []);

  
  const injectHook = useCallback(async (config, customTarget = null) => {
    const result = await handleApiCall(
      () => window.api.inject.hook(config, customTarget),
      'Injecting main hook payload'
    );
    return result;
  }, [handleApiCall]);

  const value = {
    
    isLoading,
    error,
    currentAsarInfo,
    isSetupComplete,
    fileTree, 
    
    
    setupInjection,
    
    
    extractAsar,
    getFileContent,
    saveFile,
    loadAsar, 
    
    
    searchFiles,
    
    
    createPayload,
    injectPayload,
    
    
    listBackups,
    restoreBackup,
    deleteBackup,
    

    
    openFileDialog,
    saveFileDialog,
    
    
    clearError,
    resetState,
    injectHook,

    
    repackAsar: async (sourceDir, outputPath) => {
      const result = await handleApiCall(
        () => window.api.analysis.repack(sourceDir, outputPath),
        `Repacking ASAR to ${outputPath}`
      );
      return result;
    },
  };

  return (
    <ApiContext.Provider value={value}>
      {children}
    </ApiContext.Provider>
  );
}

export function useApi() {
  const context = useContext(ApiContext);
  if (!context) {
    throw new Error('useApi must be used within an ApiProvider');
  }
  return context;
}