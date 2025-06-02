export const GetAppInfo = {
    name: 'Get Electron App Info',
    description: 'Extracts detailed Electron application information',
    process: 'main',
    code: `
  // Get Electron app information
  // Context variables available: app, BrowserWindow, windows, versions, platform
  if (!app) {
    return { error: 'App context not available' };
  }
  
  const appInfo = {
    timestamp: new Date().toISOString(),
    app: {
      name: app.getName(),
      version: app.getVersion(),
      locale: app.getLocale(),
      isPackaged: app.isPackaged,
      isReady: app.isReady(),
      appPath: app.getAppPath(),
      userDataPath: app.getPath('userData'),
      tempPath: app.getPath('temp'),
      homePath: app.getPath('home'),
      documentsPath: app.getPath('documents'),
      downloadsPath: app.getPath('downloads'),
      desktopPath: app.getPath('desktop'),
      exePath: app.getPath('exe'),
      crashDumpsPath: app.getPath('crashDumps'),
      logsPath: app.getPath('logs')
    },
    features: {
      commandLine: app.commandLine ? {
        appendSwitch: typeof app.commandLine.appendSwitch === 'function',
        hasSwitch: typeof app.commandLine.hasSwitch === 'function'
      } : null,
      dock: platform === 'darwin' ? {
        bounce: typeof app.dock?.bounce === 'function',
        setBadge: typeof app.dock?.setBadge === 'function'
      } : null
    },
    metrics: {
      appMetrics: typeof app.getAppMetrics === 'function' ? app.getAppMetrics() : null,
      gpuFeatureStatus: typeof app.getGPUFeatureStatus === 'function' ? app.getGPUFeatureStatus() : null
    },
    contextInfo: {
      windowsCount: windows ? windows.length : 0,
      platform: platform,
      versions: versions
    }
  };
  
  return appInfo;
  `
  };

  export default GetAppInfo;