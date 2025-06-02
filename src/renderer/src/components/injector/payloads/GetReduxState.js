export const GetReduxState = {
    name: 'Dump Redux State',
    description: 'Extracts current Redux state from all found stores',
    process: 'renderer',
    code: `
  // Dump Redux state from all available stores
  // Context variables available: location, document, localStorage, sessionStorage, navigator
  const stateDump = {
    timestamp: new Date().toISOString(),
    stores: {},
    errors: [],
    context: {
      location: typeof location !== 'undefined' ? location.href : 'unknown',
      documentTitle: typeof document !== 'undefined' ? document.title : 'unknown'
    }
  };
  
  // Common store locations
  const storeLocations = [
    'store', 'reduxStore', '_store', 'appStore', '__store__', 'globalStore',
    'window.store', 'app.store', 'application.store'
  ];
  
  storeLocations.forEach(function(storeLocation) {
    try {
      let targetStore = null;
      
      // Handle nested property access
      if (storeLocation.includes('.')) {
        const parts = storeLocation.split('.');
        targetStore = window;
        for (let i = 0; i < parts.length; i++) {
          targetStore = targetStore[parts[i]];
          if (!targetStore) break;
        }
      } else {
        targetStore = window[storeLocation];
      }
      
      if (targetStore && typeof targetStore.getState === 'function') {
        try {
          const currentState = targetStore.getState();
          stateDump.stores[storeLocation] = {
            state: currentState,
            stateKeys: Object.keys(currentState || {}),
            stateSize: JSON.stringify(currentState).length
          };
        } catch (stateError) {
          stateDump.errors.push('Error getting state from ' + storeLocation + ': ' + stateError.message);
        }
      }
    } catch (e) {
      stateDump.errors.push('Error accessing ' + storeLocation + ': ' + e.message);
    }
  });
  
  // Try to get state from Redux DevTools if available
  if (typeof window.__REDUX_DEVTOOLS_EXTENSION__ !== 'undefined') {
    try {
      const devTools = window.__REDUX_DEVTOOLS_EXTENSION__;
      stateDump.devToolsAvailable = true;
    } catch (e) {
      stateDump.errors.push('Error accessing Redux DevTools: ' + e.message);
    }
  }
  
  // Look for MobX stores as well
  const mobxLocations = ['mobxStore', '_mobxStore', 'rootStore'];
  mobxLocations.forEach(function(mobxLocation) {
    if (typeof window[mobxLocation] !== 'undefined') {
      try {
        stateDump.stores[mobxLocation + '_mobx'] = {
          type: 'mobx',
          store: window[mobxLocation],
          observable: typeof window[mobxLocation].__mobxDidRunLazyInitializers !== 'undefined'
        };
      } catch (e) {
        stateDump.errors.push('Error accessing MobX store ' + mobxLocation + ': ' + e.message);
      }
    }
  });
  
  return stateDump;
  `
  };

  export default GetReduxState;