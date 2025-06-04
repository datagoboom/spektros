import React, { createContext, useContext, useState, useCallback } from 'react';

const AnalysisContext = createContext(null);


const STORAGE_KEY = 'analysis-state';


const saveToStorage = (state) => {
  try {
    const serialized = {
      tmpDir: state.tmpDir,
      fileTree: state.fileTree,
      lastUpdated: Date.now()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized));
  } catch (error) {
    console.error('Failed to save analysis state to localStorage:', error);
  }
};

const loadFromStorage = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return null;
    
    const parsed = JSON.parse(saved);
    return {
      tmpDir: parsed.tmpDir || null,
      fileTree: parsed.fileTree || [],
      lastUpdated: parsed.lastUpdated || null
    };
  } catch (error) {
    console.error('Failed to load analysis state from localStorage:', error);
    return null;
  }
};

export function AnalysisProvider({ children }) {
  const savedState = loadFromStorage();
  
  const [tmpDir, setTmpDir] = useState(savedState?.tmpDir || null);
  const [fileTree, setFileTree] = useState(savedState?.fileTree || []);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  
  React.useEffect(() => {
    if (tmpDir || fileTree.length > 0) {
      saveToStorage({ tmpDir, fileTree });
    }
  }, [tmpDir, fileTree]);

  
  const initializeAnalysis = useCallback(async (newTmpDir) => {
    try {
      setIsLoading(true);
      setError(null);
      setTmpDir(newTmpDir);
      console.log(`📁 Analysis: Initialized with tmpDir ${newTmpDir}`);
    } catch (error) {
      console.error('Failed to initialize analysis:', error);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  
  const updateFileTree = useCallback((newFileTree) => {
    try {
      setFileTree(newFileTree);
      console.log(`📂 Analysis: Updated file tree with ${newFileTree.length} files`);
    } catch (error) {
      console.error('Failed to update file tree:', error);
      setError(error.message);
    }
  }, []);

  
  const clearAnalysis = useCallback(() => {
    setTmpDir(null);
    setFileTree([]);
    setError(null);
    localStorage.removeItem(STORAGE_KEY);
    console.log('🗑️  Analysis: Cleared all state');
  }, []);

  
  const getFileByPath = useCallback((filePath) => {
    return fileTree.find(file => file.path === filePath);
  }, [fileTree]);

  
  const getFilesByType = useCallback((fileType) => {
    return fileTree.filter(file => file.type === fileType);
  }, [fileTree]);

  
  const getFilesByDirectory = useCallback((directory) => {
    return fileTree.filter(file => file.relativePath.startsWith(directory));
  }, [fileTree]);

  const value = {
    tmpDir,
    fileTree,
    isLoading,
    error,
    initializeAnalysis,
    updateFileTree,
    clearAnalysis,
    getFileByPath,
    getFilesByType,
    getFilesByDirectory
  };

  return (
    <AnalysisContext.Provider value={value}>
      {children}
    </AnalysisContext.Provider>
  );
}

export function useAnalysis() {
  const context = useContext(AnalysisContext);
  if (!context) {
    throw new Error('useAnalysis must be used within an AnalysisProvider');
  }
  return context;
} 