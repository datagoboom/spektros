import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'

const ConnectedAppContext = createContext()

export const ConnectedAppProvider = ({ children }) => {
  const [apps, setApps] = useState(new Map())
  const [latestUpdate, setLatestUpdate] = useState(null)
  const [serverStatus, setServerStatus] = useState({ isRunning: false, port: null })
  const [isListening, setIsListening] = useState(false)
  const [stats, setStats] = useState({ 
    totalUpdates: 0, 
    uniqueApps: 0,
    lastUpdateTime: null 
  })

  
  const cleanupTimerRef = useRef(null)
  const autoCleanupInterval = 5 * 60 * 1000 

  
  const checkServerStatus = useCallback(async () => {
    try {
      const result = await window.api.inject.getServerStatus()
      if (result.success) {
        setServerStatus({
          isRunning: result.isRunning,
          port: result.port
        })
        return result
      }
    } catch (error) {
      console.error('Failed to check server status:', error)
      setServerStatus({ isRunning: false, port: null })
    }
  }, [])

  
  const startListener = useCallback(async () => {
    try {
      const result = await window.api.inject.startListener()
      if (result.success) {
        setIsListening(true)
        await checkServerStatus()
        console.log('✅ Call-home listener started')
        return { success: true, port: result.port }
      }
      return result
    } catch (error) {
      console.error('Failed to start listener:', error)
      setIsListening(false)
      return { success: false, error: error.message }
    }
  }, [checkServerStatus])

  
  const stopListener = useCallback(async () => {
    try {
      const result = await window.api.inject.stopListener()
      if (result.success) {
        setIsListening(false)
        await checkServerStatus()
        console.log('🛑 Call-home listener stopped')
      }
      return result
    } catch (error) {
      console.error('Failed to stop listener:', error)
      return { success: false, error: error.message }
    }
  }, [checkServerStatus])

  
  const cleanupOldApps = useCallback(() => {
    const now = Date.now()
    const cutoff = now - autoCleanupInterval
    
    setApps(prev => {
      const newApps = new Map()
      let removedCount = 0
      
      prev.forEach((app, uuid) => {
        if (app.lastSeen > cutoff) {
          newApps.set(uuid, app)
        } else {
          removedCount++
        }
      })
      
      if (removedCount > 0) {
        console.log(`🧹 Cleaned up ${removedCount} inactive apps`)
      }
      
      return newApps
    })
  }, [autoCleanupInterval])

  
  const forceCleanup = useCallback(() => {
    cleanupOldApps()
  }, [cleanupOldApps])

  
  const clearApps = useCallback(() => {
    setApps(new Map())
    setLatestUpdate(null)
    setStats({ totalUpdates: 0, uniqueApps: 0, lastUpdateTime: null })
    console.log('🗑️ All app data cleared')
  }, [])

  
  const getApp = useCallback((uuid) => {
    return apps.get(uuid) || null
  }, [apps])

  
  const getApps = useCallback((filter) => {
    const appsArray = Array.from(apps.values())
    if (filter && typeof filter === 'function') {
      return appsArray.filter(filter)
    }
    return appsArray
  }, [apps])

  
  const getOnlineApps = useCallback(() => {
    const now = Date.now()
    const onlineThreshold = 2 * 60 * 1000 
    return getApps(app => (now - app.lastSeen) < onlineThreshold)
  }, [getApps])

  const getOfflineApps = useCallback(() => {
    const now = Date.now()
    const onlineThreshold = 2 * 60 * 1000 
    return getApps(app => (now - app.lastSeen) >= onlineThreshold)
  }, [getApps])

  
  const isAppOnline = useCallback((uuid) => {
    const app = getApp(uuid)
    if (!app) return false
    
    const now = Date.now()
    const onlineThreshold = 2 * 60 * 1000 
    return (now - app.lastSeen) < onlineThreshold
  }, [getApp])

  
  const updateAppStatuses = useCallback(() => {
    const now = Date.now()
    const onlineThreshold = 2 * 60 * 1000 
    
    setApps(prev => {
      const updated = new Map()
      let hasChanges = false
      
      prev.forEach((app, uuid) => {
        const isOnline = (now - app.lastSeen) < onlineThreshold
        if (app.isOnline !== isOnline) {
          hasChanges = true
          updated.set(uuid, { ...app, isOnline })
        } else {
          updated.set(uuid, app)
        }
      })
      
      return hasChanges ? updated : prev
    })
  }, [])

  
  useEffect(() => {
    const handleCallHomeData = (event, appInfo) => {
      console.log('📞 Call-home data received:', appInfo.name, appInfo.uuid)
      
      setLatestUpdate(appInfo)
      
      
      setApps(prev => {
        const newApps = new Map(prev)
        const isNewApp = !prev.has(appInfo.uuid)
        
        newApps.set(appInfo.uuid, {
          ...appInfo,
          isOnline: true,
          isNew: isNewApp
        })
        
        return newApps
      })

      
      setStats(prev => ({
        totalUpdates: prev.totalUpdates + 1,
        uniqueApps: prev.uniqueApps + (apps.has(appInfo.uuid) ? 0 : 1),
        lastUpdateTime: Date.now()
      }))
    }

    
    window.api.callHome.onData(handleCallHomeData)

    return () => {
      window.api.callHome.removeListeners()
    }
  }, [apps])

  
  useEffect(() => {
    
    checkServerStatus()

    
    const statusInterval = setInterval(updateAppStatuses, 30000) 

    
    cleanupTimerRef.current = setInterval(cleanupOldApps, autoCleanupInterval)

    return () => {
      clearInterval(statusInterval)
      if (cleanupTimerRef.current) {
        clearInterval(cleanupTimerRef.current)
      }
    }
  }, [checkServerStatus, updateAppStatuses, cleanupOldApps, autoCleanupInterval])

  
  const getNextAvailablePort = useCallback((startPort, field) => {
    const usedPorts = new Set();
    
    
    apps.forEach(app => {
      if (app[field]) {
        usedPorts.add(app[field]);
      }
    });
    
    
    let port = startPort;
    while (usedPorts.has(port)) {
      port++;
    }
    
    console.log(`[PORT-MANAGER] Found next available port for ${field}: ${port} (started at ${startPort})`);
    return port;
  }, [apps]);

  
  const getNextDebugPort = useCallback(() => {
    return getNextAvailablePort(10100, 'port');
  }, [getNextAvailablePort]);

  const getNextIpcMonitorPort = useCallback(() => {
    return getNextAvailablePort(11100, 'ipc_monitor_port');
  }, [getNextAvailablePort]);

  
  const contextValue = {
    
    apps: Array.from(apps.values()),
    appsMap: apps,
    latestUpdate,
    serverStatus,
    isListening,
    stats,
    
    
    appCount: apps.size,
    onlineCount: getOnlineApps().length,
    offlineCount: getOfflineApps().length,
    
    
    getApp,
    getApps,
    getOnlineApps,
    getOfflineApps,
    isAppOnline,
    clearApps,
    forceCleanup,
    
    
    startListener,
    stopListener,
    checkServerStatus,
    
    
    getNextAvailablePort,
    getNextDebugPort,
    getNextIpcMonitorPort,
    
    
    updateAppStatuses
  }

  return (
    <ConnectedAppContext.Provider value={contextValue}>
      {children}
    </ConnectedAppContext.Provider>
  )
}


export const useConnectedApps = () => {
  const context = useContext(ConnectedAppContext)
  if (!context) {
    throw new Error('useConnectedApps must be used within a ConnectedAppProvider')
  }
  return context
}


export const useAppMonitor = (targetUUIDs = []) => {
  const { apps, getApp, latestUpdate, isAppOnline, ...rest } = useConnectedApps()

  const targetApps = targetUUIDs.length > 0 
    ? apps.filter(app => targetUUIDs.includes(app.uuid))
    : apps

  const isTargetUpdate = latestUpdate && 
    (targetUUIDs.length === 0 || targetUUIDs.includes(latestUpdate.uuid))

  return {
    apps: targetApps,
    latestUpdate: isTargetUpdate ? latestUpdate : null,
    getApp,
    isAppOnline,
    ...rest
  }
}

export const useServerControl = () => {
  const { 
    serverStatus, 
    isListening, 
    startListener, 
    stopListener, 
    checkServerStatus 
  } = useConnectedApps()
  
  return {
    serverStatus,
    isListening,
    startListener,
    stopListener,
    checkServerStatus
  }
}

export const useAppStats = () => {
  const { 
    stats, 
    appCount, 
    onlineCount, 
    offlineCount,
    apps
  } = useConnectedApps()
  
  
  const avgJobsPerApp = apps.length > 0 
    ? apps.reduce((sum, app) => sum + (app.active_jobs || 0), 0) / apps.length 
    : 0

  const recentlyActive = apps.filter(app => 
    Date.now() - app.lastSeen < 60000 
  ).length

  return {
    ...stats,
    appCount,
    onlineCount,
    offlineCount,
    avgJobsPerApp: Math.round(avgJobsPerApp * 100) / 100,
    recentlyActive
  }
}

export default ConnectedAppContext