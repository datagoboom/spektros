import React, { createContext, useContext, useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';

const InjectorContext = createContext(null);

export function InjectorProvider({ children }) {
  // Core state
  const [asarPath, setAsarPath] = useState('');
  const [executablePath, setExecutablePath] = useState('');
  const [selectedPayload, setSelectedPayload] = useState([]);
  const [injectionStatus, setInjectionStatus] = useState(null);
  const [isInjecting, setIsInjecting] = useState(false);

  // Setup and app state
  const [isSetupComplete, setIsSetupComplete] = useState(false);
  const [setupStatus, setSetupStatus] = useState(null);
  const [hookedApps, setHookedApps] = useState([]);
  const [selectedApp, setSelectedApp] = useState(null);

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

  // Multi-app hooked app settings
  const [hookedAppSettings, setHookedAppSettings] = useState(() => {
    const saved = localStorage.getItem('hookedAppSettings');
    return saved ? JSON.parse(saved) : {};
  });

  // Helper to get next available app main port (starts at 10100)
  const getNextAppPort = (settings) => {
    const ports = Object.values(settings).map(app => app.port || 0);
    return Math.max(10099, ...ports) + 1;
  };

  // Helper to get next available ipc_monitor_port (starts at 10500)
  const getNextIpcMonitorPort = (settings) => {
    const ports = Object.values(settings).map(app => app.ipc_monitor_port || 0);
    return Math.max(10499, ...ports) + 1;
  };

  // New: Helper to get next available port from hooked apps
  const getNextAvailablePort = (startPort = 10100) => {
    const usedPorts = new Set(hookedApps.map(app => app.debugPort || app.port));
    let port = startPort;
    while (usedPorts.has(port)) {
      port++;
    }
    return port;
  };

  // Add or update app settings
  // Usage: saveAppSettings({ name, ip }) // port and ipc_monitor_port auto-assigned
  const saveAppSettings = useCallback((app) => {
    setHookedAppSettings(prev => {
      const id = app.uuid || uuidv4();
      const port = app.port || getNextAppPort(prev);
      const ipc_monitor_port = app.ipc_monitor_port || getNextIpcMonitorPort(prev);
      const updated = { ...prev, [id]: { ...app, uuid: id, port, ipc_monitor_port } };
      localStorage.setItem('hookedAppSettings', JSON.stringify(updated));
      return updated;
    });
  }, [getNextAppPort, getNextIpcMonitorPort]);

  // Remove app settings
  const removeAppSettings = useCallback((uuid) => {
    setHookedAppSettings(prev => {
      const updated = { ...prev };
      delete updated[uuid];
      localStorage.setItem('hookedAppSettings', JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Actions (examples, expand as needed)
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

    // Setup and app state
    setIsSetupComplete(false);
    setSetupStatus(null);
    setHookedApps([]);
    setSelectedApp(null);

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
    hookedApps, setHookedApps,
    selectedApp, setSelectedApp,
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

    // Multi-app hooked app settings
    hookedAppSettings,
    saveAppSettings,
    removeAppSettings,
    getNextAppPort,
    getNextIpcMonitorPort,
    getNextAvailablePort,

    // Actions
    clearInjectionStatus,
    clearAsarPath,
    clearCookiesData,
    clearIpcTraffic,
    clearIpcState,
    clearAll,
    // ...add more actions here
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