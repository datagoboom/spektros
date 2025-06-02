export const GetProcessInfo = {
    name: 'Get Process Info',
    description: 'Dumps detailed process and environment information',
    process: 'main',
    code: `
  // Get comprehensive process information
  // Context variables available: app, BrowserWindow, windows, versions, platform
  const processInfo = {
    timestamp: new Date().toISOString(),
    process: {
      pid: process.pid,
      ppid: process.ppid || 'unavailable',
      platform: platform || process.platform,
      arch: process.arch,
      versions: versions || process.versions,
      argv: process.argv,
      argv0: process.argv0,
      execPath: process.execPath,
      execArgv: process.execArgv,
      cwd: process.cwd(),
      title: process.title,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      resourceUsage: typeof process.resourceUsage === 'function' ? process.resourceUsage() : null
    },
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      HOME: process.env.HOME,
      USER: process.env.USER,
      PATH: process.env.PATH ? process.env.PATH.split(':').slice(0, 10) : null,
      ELECTRON_IS_DEV: process.env.ELECTRON_IS_DEV,
      ELECTRON_RUN_AS_NODE: process.env.ELECTRON_RUN_AS_NODE
    },
    windows: windows ? windows.map(win => ({
      id: win.id,
      title: win.getTitle(),
      bounds: win.getBounds(),
      isVisible: win.isVisible(),
      isFocused: win.isFocused()
    })) : [],
    features: {
      hasUncaughtExceptionCaptureCallback: typeof process.hasUncaughtExceptionCaptureCallback === 'function',
      allowedNodeEnvironmentFlags: process.allowedNodeEnvironmentFlags ? Array.from(process.allowedNodeEnvironmentFlags) : null
    }
  };
  
  return processInfo;
  `
  };

  export default GetProcessInfo;