import React, { createContext, useContext, useState, useCallback } from 'react';

const ApiContext = createContext(null);

export function ApiProvider({ children }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentAsarInfo, setCurrentAsarInfo] = useState(null);
  const [isSetupComplete, setIsSetupComplete] = useState(false);
  const [fileTree, setFileTree] = useState([]); // Re-added fileTree state

  // Helper to handle API responses
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

  // NEW: Setup injection system
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

  // ASAR Analysis API (for advanced users)
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

  // Search API
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

  // Payload Management API
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

  // Backup Management API
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
    
    // Reset setup state after restore
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


  // File Dialog API
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

  // Complete workflow: extract ASAR and build file tree (utility function)
  const loadAsar = useCallback(async (asarPath) => {
    try {
      // Extract ASAR
      const extractResult = await extractAsar(asarPath);
      
      // Build file tree
      const treeResult = await handleApiCall(
        () => window.api.analysis.getFileTree(extractResult.tmpDir),
        `Building file tree: ${extractResult.tmpDir}`
      );
      
      // Store file tree in context state
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

  // Utility functions
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

  // New: All-in-one hook injection
  const injectHook = useCallback(async (config, targetPath) => {
    const result = await handleApiCall(
      () => window.api.inject.hook(config, targetPath),
      'Injecting main hook payload'
    );
    return result;
  }, [handleApiCall]);

  const value = {
    // State
    isLoading,
    error,
    currentAsarInfo,
    isSetupComplete,
    fileTree, // Re-added fileTree to context value
    
    // NEW: Main setup function
    setupInjection,
    
    // ASAR operations (for advanced use)
    extractAsar,
    getFileContent,
    saveFile,
    loadAsar, // Re-added loadAsar utility function
    
    // Search operations
    searchFiles,
    
    // Payload operations
    createPayload,
    injectPayload,
    
    // Backup operations
    listBackups,
    restoreBackup,
    deleteBackup,
    

    // File dialogs
    openFileDialog,
    
    // Utilities
    clearError,
    resetState,
    injectHook,
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