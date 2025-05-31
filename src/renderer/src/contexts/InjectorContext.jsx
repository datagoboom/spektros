import React, { createContext, useContext, useState, useCallback } from 'react';

const InjectorContext = createContext(null);

export function InjectorProvider({ children }) {
  // Core state
  const [asarPath, setAsarPath] = useState('');
  const [executablePath, setExecutablePath] = useState('');
  const [selectedPayload, setSelectedPayload] = useState([]);
  const [injectionStatus, setInjectionStatus] = useState(null);
  const [isInjecting, setIsInjecting] = useState(false);

  // Setup state
  const [isSetupComplete, setIsSetupComplete] = useState(false);
  const [setupStatus, setSetupStatus] = useState(null);

  // Payloads
  const [payloads, setPayloads] = useState([]);
  const [isLoadingPayloads, setIsLoadingPayloads] = useState(false);

  // Console/terminal state
  const [consoleInput, setConsoleInput] = useState('');
  const [consoleOutput, setConsoleOutput] = useState([]);
  const [consoleHistory, setConsoleHistory] = useState([]);
  const [consoleHistoryIndex, setConsoleHistoryIndex] = useState(-1);
  const [selectedProcess, setSelectedProcess] = useState('renderer');

  // Cookies state
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

  // IPC Monitor state
  const [ipcIsUploaded, setIpcIsUploaded] = useState(false);
  const [ipcIsStreaming, setIpcIsStreaming] = useState(false);
  const [ipcTraffic, setIpcTraffic] = useState([]);
  const [ipcError, setIpcError] = useState(null);
  const [ipcIsUploading, setIpcIsUploading] = useState(false);
  const [ipcExpandedRow, setIpcExpandedRow] = useState(null);

  // App settings state
  const [hookedAppSettings, setHookedAppSettings] = useState({});

  // Get next available IPC monitor port
  const getNextIpcMonitorPort = useCallback((settings) => {
    const usedPorts = new Set(Object.values(settings).map(s => s.ipc_monitor_port));
    let port = 11100;
    while (usedPorts.has(port)) {
      port++;
    }
    return port;
  }, []);

  // Save app settings
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

  // Actions
  const clearInjectionStatus = useCallback(() => setInjectionStatus(null), []);
  const clearAsarPath = useCallback(() => {
    setAsarPath('');
    setInjectionStatus(null);
  }, []);

  // Cookies actions
  const clearCookiesData = useCallback(() => {
    setCookiesData(null);
    setCookiesError(null);
    setCookiesExpandedRow(null);
    setCookiesEditValue('');
    setCookiesSaveStatus(null);
  }, []);

  // IPC Monitor actions
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

  // Clear all state
  const clearAll = useCallback(() => {
    // Core state
    setAsarPath('');
    setExecutablePath('');
    setSelectedPayload(null);
    setInjectionStatus(null);
    setIsInjecting(false);

    // Setup state
    setIsSetupComplete(false);
    setSetupStatus(null);

    // Payloads
    setPayloads([]);
    setIsLoadingPayloads(false);

    // Console/terminal state
    setConsoleInput('');
    setConsoleOutput([]);
    setConsoleHistory([]);
    setConsoleHistoryIndex(-1);
    setSelectedProcess('renderer');

    // Cookies state - ensure polling is stopped first
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

    // IPC Monitor state
    setIpcIsUploaded(false);
    setIpcIsStreaming(false);
    setIpcTraffic([]);
    setIpcError(null);
    setIpcIsUploading(false);
    setIpcExpandedRow(null);

    // App settings
    setHookedAppSettings({});
  }, []);

  const value = {
    // State
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

    // Cookies state
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

    // IPC Monitor state
    ipcIsUploaded, setIpcIsUploaded,
    ipcIsStreaming, setIpcIsStreaming,
    ipcTraffic, setIpcTraffic,
    ipcError, setIpcError,
    ipcIsUploading, setIpcIsUploading,
    ipcExpandedRow, setIpcExpandedRow,

    // App settings
    hookedAppSettings,
    getNextIpcMonitorPort,
    saveAppSettings,

    // Actions
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