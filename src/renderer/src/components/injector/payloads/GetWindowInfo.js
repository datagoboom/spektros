export const GetWindowInfo = {
    name: 'Get Window Info',
    description: 'Dumps information about Electron windows and browser context',
    process: 'renderer',
    code: `
  // Get comprehensive window and context information
  // Context variables available: location, document, localStorage, sessionStorage, navigator
  const windowInfo = {
    timestamp: new Date().toISOString(),
    location: typeof location !== 'undefined' ? {
      href: location.href,
      protocol: location.protocol,
      host: location.host,
      pathname: location.pathname,
      search: location.search,
      hash: location.hash
    } : { error: 'location not available' },
    navigator: typeof navigator !== 'undefined' ? {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      languages: navigator.languages,
      cookieEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine,
      hardwareConcurrency: navigator.hardwareConcurrency
    } : { error: 'navigator not available' },
    screen: typeof window !== 'undefined' && window.screen ? {
      width: window.screen.width,
      height: window.screen.height,
      availWidth: window.screen.availWidth,
      availHeight: window.screen.availHeight,
      colorDepth: window.screen.colorDepth,
      pixelDepth: window.screen.pixelDepth
    } : { error: 'screen not available' },
    window: typeof window !== 'undefined' ? {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      outerWidth: window.outerWidth,
      outerHeight: window.outerHeight,
      devicePixelRatio: window.devicePixelRatio,
      isSecureContext: window.isSecureContext
    } : { error: 'window not available' },
    document: typeof document !== 'undefined' ? {
      title: document.title,
      domain: document.domain,
      readyState: document.readyState,
      characterSet: document.characterSet,
      contentType: document.contentType,
      lastModified: document.lastModified
    } : { error: 'document not available' },
    storage: {
      localStorage: typeof localStorage !== 'undefined' ? {
        available: true,
        length: localStorage.length,
        keys: Array.from({length: localStorage.length}, (_, i) => localStorage.key(i))
      } : { available: false },
      sessionStorage: typeof sessionStorage !== 'undefined' ? {
        available: true,
        length: sessionStorage.length,
        keys: Array.from({length: sessionStorage.length}, (_, i) => sessionStorage.key(i))
      } : { available: false }
    },
    electron: {
      nodeIntegration: typeof require !== 'undefined',
      contextIsolation: typeof window.electronAPI !== 'undefined',
      webSecurity: typeof window.webSecurity !== 'undefined' ? window.webSecurity : 'unknown'
    }
  };
  
  // Try to get additional Electron-specific info
  try {
    if (typeof require !== 'undefined') {
      const { remote } = require('electron');
      if (remote) {
        const currentWindow = remote.getCurrentWindow();
        windowInfo.electronWindow = {
          id: currentWindow.id,
          title: currentWindow.getTitle(),
          bounds: currentWindow.getBounds(),
          isVisible: currentWindow.isVisible(),
          isFocused: currentWindow.isFocused(),
          isMaximized: currentWindow.isMaximized(),
          isMinimized: currentWindow.isMinimized(),
          isFullScreen: currentWindow.isFullScreen(),
          isAlwaysOnTop: currentWindow.isAlwaysOnTop(),
          isResizable: currentWindow.isResizable()
        };
      }
    }
  } catch (e) {
    windowInfo.electron.remoteError = e.message;
  }
  
  return windowInfo;
  `
  };

  export default GetWindowInfo;