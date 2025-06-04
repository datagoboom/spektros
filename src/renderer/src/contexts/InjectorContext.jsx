import React, { createContext, useContext, useState, useCallback } from 'react';

const InjectorContext = createContext(null);

export function InjectorProvider({ children }) {
  
  const [asarPath, setAsarPath] = useState('');
  const [executablePath, setExecutablePath] = useState('');
  const [selectedPayload, setSelectedPayload] = useState([]);
  const [injectionStatus, setInjectionStatus] = useState(null);
  const [isInjecting, setIsInjecting] = useState(false);

  
  const [isSetupComplete, setIsSetupComplete] = useState(false);
  const [setupStatus, setSetupStatus] = useState(null);

  
  const [payloads, setPayloads] = useState([]);
  const [isLoadingPayloads, setIsLoadingPayloads] = useState(false);

  
  const [consoleInput, setConsoleInput] = useState('');
  const [consoleOutput, setConsoleOutput] = useState([]);
  const [consoleHistory, setConsoleHistory] = useState([]);
  const [consoleHistoryIndex, setConsoleHistoryIndex] = useState(-1);
  const [selectedProcess, setSelectedProcess] = useState('renderer');

  
  const [cookiesData, setCookiesData] = useState(null);
  const [cookiesError, setCookiesError] = useState(null);
  const [cookiesIsLoading, setCookiesIsLoading] = useState(false);
  const [cookiesIsPolling, setCookiesIsPolling] = useState(false);
  const [cookiesPollInterval, setCookiesPollInterval] = useState(5);
  const [cookiesExpandedRow, setCookiesExpandedRow] = useState(null);
  const [cookiesEditValue, setCookiesEditValue] = useState('');
  const [cookiesIsSaving, setCookiesIsSaving] = useState(false);
  const [cookiesSaveStatus, setCookiesSaveStatus] = useState(null);
  const [cookiesProcess, setCookiesProcess] = useState('main');

  
  const [ipcIsUploaded, setIpcIsUploaded] = useState(false);
  const [ipcIsStreaming, setIpcIsStreaming] = useState(false);
  const [ipcTraffic, setIpcTraffic] = useState([]);
  const [ipcError, setIpcError] = useState(null);
  const [ipcIsUploading, setIpcIsUploading] = useState(false);
  const [ipcExpandedRow, setIpcExpandedRow] = useState(null);

  
  const [hookedAppSettings, setHookedAppSettings] = useState({});

  
  const getNextIpcMonitorPort = useCallback((settings) => {
    const usedPorts = new Set(Object.values(settings).map(s => s.ipc_monitor_port));
    let port = 11100;
    while (usedPorts.has(port)) {
      port++;
    }
    return port;
  }, []);

  
  const saveAppSettings = useCallback((app) => {
    if (!app?.uuid) return;
    setHookedAppSettings(prev => ({
      ...prev,
      [app.uuid]: {
        ...prev[app.uuid],
        ...app
      }
    }));
  }, []);

  
  const clearInjectionStatus = useCallback(() => setInjectionStatus(null), []);
  const clearAsarPath = useCallback(() => {
    setAsarPath('');
    setInjectionStatus(null);
  }, []);

  
  const clearCookiesData = useCallback(() => {
    setCookiesData(null);
    setCookiesError(null);
    setCookiesExpandedRow(null);
    setCookiesEditValue('');
    setCookiesSaveStatus(null);
  }, []);

  
  const clearIpcTraffic = useCallback(() => {
    setIpcTraffic([]);
    setIpcExpandedRow(null);
  }, []);

  const clearIpcState = useCallback(() => {
    setIpcIsUploaded(false);
    setIpcIsStreaming(false);
    setIpcTraffic([]);
    setIpcError(null);
    setIpcExpandedRow(null);
  }, []);

  
  const clearAll = useCallback(() => {
    
    setAsarPath('');
    setExecutablePath('');
    setSelectedPayload(null);
    setInjectionStatus(null);
    setIsInjecting(false);

    
    setIsSetupComplete(false);
    setSetupStatus(null);

    
    setPayloads([]);
    setIsLoadingPayloads(false);

    
    setConsoleInput('');
    setConsoleOutput([]);
    setConsoleHistory([]);
    setConsoleHistoryIndex(-1);
    setSelectedProcess('renderer');

    
    setCookiesIsPolling(false);
    setCookiesData(null);
    setCookiesError(null);
    setCookiesIsLoading(false);
    setCookiesPollInterval(5);
    setCookiesExpandedRow(null);
    setCookiesEditValue('');
    setCookiesIsSaving(false);
    setCookiesSaveStatus(null);
    setCookiesProcess('main');

    
    setIpcIsUploaded(false);
    setIpcIsStreaming(false);
    setIpcTraffic([]);
    setIpcError(null);
    setIpcIsUploading(false);
    setIpcExpandedRow(null);

    
    setHookedAppSettings({});
  }, []);

  const value = {
    
    asarPath, setAsarPath,
    executablePath, setExecutablePath,
    selectedPayload, setSelectedPayload,
    injectionStatus, setInjectionStatus,
    isInjecting, setIsInjecting,
    isSetupComplete, setIsSetupComplete,
    setupStatus, setSetupStatus,
    payloads, setPayloads,
    isLoadingPayloads, setIsLoadingPayloads,
    consoleInput, setConsoleInput,
    consoleOutput, setConsoleOutput,
    consoleHistory, setConsoleHistory,
    consoleHistoryIndex, setConsoleHistoryIndex,
    selectedProcess, setSelectedProcess,

    
    cookiesData, setCookiesData,
    cookiesError, setCookiesError,
    cookiesIsLoading, setCookiesIsLoading,
    cookiesIsPolling, setCookiesIsPolling,
    cookiesPollInterval, setCookiesPollInterval,
    cookiesExpandedRow, setCookiesExpandedRow,
    cookiesEditValue, setCookiesEditValue,
    cookiesIsSaving, setCookiesIsSaving,
    cookiesSaveStatus, setCookiesSaveStatus,
    cookiesProcess, setCookiesProcess,

    
    ipcIsUploaded, setIpcIsUploaded,
    ipcIsStreaming, setIpcIsStreaming,
    ipcTraffic, setIpcTraffic,
    ipcError, setIpcError,
    ipcIsUploading, setIpcIsUploading,
    ipcExpandedRow, setIpcExpandedRow,

    
    hookedAppSettings,
    getNextIpcMonitorPort,
    saveAppSettings,

    
    clearInjectionStatus,
    clearAsarPath,
    clearCookiesData,
    clearIpcTraffic,
    clearIpcState,
    clearAll,
  };

  return (
    <InjectorContext.Provider value={value}>
      {children}
    </InjectorContext.Provider>
  );
}

export function useInjector() {
  const context = useContext(InjectorContext);
  if (!context) {
    throw new Error('useInjector must be used within an InjectorProvider');
  }
  return context;
}