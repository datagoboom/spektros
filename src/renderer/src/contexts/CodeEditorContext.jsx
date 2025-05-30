import React from 'react';
import { createContext, useContext, useState, useCallback, useEffect } from 'react';

const CodeEditorContext = createContext(null);

// File states
const FILE_STATE = {
  UNCHANGED: 'UNCHANGED',
  UNSAVED: 'UNSAVED',
  SAVED: 'SAVED'
};

const STORAGE_KEY = 'code-editor-state';

// Utility function to generate SHA256 hash
const generateHash = async (content) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

// Save/load from localStorage
const saveToStorage = (state) => {
  try {
    const serialized = {
      originalHashes: Array.from(state.originalHashes.entries()),
      fileContents: Array.from(state.fileContents.entries()),
      currentHashes: Array.from(state.currentHashes.entries()),
      focusedFile: state.focusedFile
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized));
  } catch (error) {
    console.error('Failed to save to localStorage:', error);
  }
};

const loadFromStorage = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return null;
    
    const parsed = JSON.parse(saved);
    return {
      originalHashes: new Map(parsed.originalHashes || []),
      fileContents: new Map(parsed.fileContents || []),
      currentHashes: new Map(parsed.currentHashes || []),
      focusedFile: parsed.focusedFile || null
    };
  } catch (error) {
    console.error('Failed to load from localStorage:', error);
    return null;
  }
};

export function CodeEditorProvider({ children }) {
  const savedState = loadFromStorage();
  
  const [originalHashes, setOriginalHashes] = useState(savedState?.originalHashes || new Map());
  const [fileContents, setFileContents] = useState(savedState?.fileContents || new Map());
  const [currentHashes, setCurrentHashes] = useState(savedState?.currentHashes || new Map());
  const [focusedFile, setFocusedFile] = useState(savedState?.focusedFile || null);

  // Save to localStorage whenever state changes
  useEffect(() => {
    saveToStorage({ originalHashes, fileContents, currentHashes, focusedFile });
  }, [originalHashes, fileContents, currentHashes, focusedFile]);

  // Initialize a file
  const initializeFile = useCallback(async (filePath, content) => {
    try {
      const hash = await generateHash(content);
      
      setOriginalHashes(prev => new Map(prev).set(filePath, hash));
      setFileContents(prev => new Map(prev).set(filePath, content));
      setCurrentHashes(prev => new Map(prev).set(filePath, hash));
      
      console.log(`📁 Context: Initialized ${filePath}`);
    } catch (error) {
      console.error(`Failed to initialize file ${filePath}:`, error);
    }
  }, []);

  // Update file content and hash
  const updateFileContent = useCallback(async (filePath, newContent) => {
    try {
      const newHash = await generateHash(newContent);
      
      setFileContents(prev => new Map(prev).set(filePath, newContent));
      setCurrentHashes(prev => new Map(prev).set(filePath, newHash));
      
      // Log state change for debugging
      const originalHash = originalHashes.get(filePath);
      const state = originalHash === newHash ? 'UNCHANGED' : 'UNSAVED';
      console.log(`📝 Context: ${filePath} is now ${state}`);
    } catch (error) {
      console.error(`Failed to update file ${filePath}:`, error);
    }
  }, [originalHashes]);

  // Mark file as saved
  const saveFile = useCallback((filePath) => {
    const currentHash = currentHashes.get(filePath);
    if (currentHash) {
      setOriginalHashes(prev => new Map(prev).set(filePath, currentHash));
      console.log(`💾 Context: Saved ${filePath}`);
    }
  }, [currentHashes]);

  // Get file state
  const getFileState = useCallback((filePath) => {
    const originalHash = originalHashes.get(filePath);
    const currentHash = currentHashes.get(filePath);
    
    if (!originalHash || !currentHash) return FILE_STATE.UNCHANGED;
    return originalHash === currentHash ? FILE_STATE.UNCHANGED : FILE_STATE.UNSAVED;
  }, [originalHashes, currentHashes]);

  // Get file content
  const getFileContent = useCallback((filePath) => {
    return fileContents.get(filePath) || '';
  }, [fileContents]);

  // Check if file is tracked
  const isFileTracked = useCallback((filePath) => {
    return fileContents.has(filePath);
  }, [fileContents]);

  // Remove file from tracking
  const removeFile = useCallback((filePath) => {
    setOriginalHashes(prev => {
      const newMap = new Map(prev);
      newMap.delete(filePath);
      return newMap;
    });
    setFileContents(prev => {
      const newMap = new Map(prev);
      newMap.delete(filePath);
      return newMap;
    });
    setCurrentHashes(prev => {
      const newMap = new Map(prev);
      newMap.delete(filePath);
      return newMap;
    });
    
    if (focusedFile === filePath) {
      setFocusedFile(null);
    }
    
    console.log(`🗑️  Context: Removed ${filePath}`);
  }, [focusedFile]);

  // Focus management
  const setFocusedFilePath = useCallback((filePath) => {
    setFocusedFile(filePath);
  }, []);

  const getFocusedFilePath = useCallback(() => {
    return focusedFile;
  }, [focusedFile]);

  const getFocusedFileState = useCallback(() => {
    return focusedFile ? getFileState(focusedFile) : FILE_STATE.UNCHANGED;
  }, [focusedFile, getFileState]);

  // Check if file has unsaved changes
  const hasUnsavedChanges = useCallback((filePath) => {
    return getFileState(filePath) === FILE_STATE.UNSAVED;
  }, [getFileState]);

  // Check if file is saved
  const isFileSaved = useCallback((filePath) => {
    return getFileState(filePath) === FILE_STATE.SAVED;
  }, [getFileState]);

  // Get all files with unsaved changes
  const getUnsavedFiles = useCallback(() => {
    const unsavedFiles = [];
    for (const filePath of fileContents.keys()) {
      if (hasUnsavedChanges(filePath)) {
        unsavedFiles.push(filePath);
      }
    }
    return unsavedFiles;
  }, [fileContents, hasUnsavedChanges]);

  // Get all tracked files
  const getAllTrackedFiles = useCallback(() => {
    return Array.from(fileContents.keys());
  }, [fileContents]);

  // Clear all data
  const clearStorage = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setOriginalHashes(new Map());
    setFileContents(new Map());
    setCurrentHashes(new Map());
    setFocusedFile(null);
    console.log('🗑️  Context: Cleared all data');
  }, []);

  const value = {
    FILE_STATE,
    initializeFile,
    updateFileContent,
    saveFile,
    getFileState,
    getFileContent,
    isFileTracked,
    removeFile,
    setFocusedFilePath,
    getFocusedFilePath,
    getFocusedFileState,
    hasUnsavedChanges,
    isFileSaved,
    getUnsavedFiles,
    getAllTrackedFiles,
    clearStorage,
  };

  return (
    <CodeEditorContext.Provider value={value}>
      {children}
    </CodeEditorContext.Provider>
  );
}

export function useCodeEditor() {
  const context = useContext(CodeEditorContext);
  if (!context) {
    throw new Error('useCodeEditor must be used within a CodeEditorProvider');
  }
  return context;
}