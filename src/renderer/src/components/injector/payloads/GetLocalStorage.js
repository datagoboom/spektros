export const GetLocalStorage = {
    name: 'Dump All Storage',
    description: 'Extracts and formats all storage contents (localStorage, sessionStorage, IndexedDB)',
    process: 'renderer',
    code: `
  // Dump all storage contents
  const storageDump = {
    timestamp: new Date().toISOString(),
    context: {
      url: typeof location !== 'undefined' ? location.href : 'unknown',
      origin: typeof location !== 'undefined' ? location.origin : 'unknown',
      protocol: typeof location !== 'undefined' ? location.protocol : 'unknown',
      hostname: typeof location !== 'undefined' ? location.hostname : 'unknown',
      pathname: typeof location !== 'undefined' ? location.pathname : 'unknown',
      hasWindow: typeof window !== 'undefined',
      hasDocument: typeof document !== 'undefined',
      hasNavigator: typeof navigator !== 'undefined'
    },
    storage: {
      localStorage: {},
      sessionStorage: {},
      indexedDB: null
    },
    errors: []
  };

  // Helper to safely get storage contents
  function getStorageContents(storage, storageName) {
    if (!storage) {
      storageDump.errors.push(\`\${storageName} is not available in this context\`);
      return;
    }

    try {
      // Get all keys
      const keys = Object.keys(storage);
      
      // Get values for each key
      keys.forEach(key => {
        try {
          const value = storage.getItem(key);
          // Try to parse JSON values
          try {
            storageDump.storage[storageName][key] = JSON.parse(value);
          } catch {
            // If not JSON, store as is
            storageDump.storage[storageName][key] = value;
          }
        } catch (e) {
          storageDump.errors.push(\`Error getting \${storageName} value for key "\${key}": \${e.message}\`);
        }
      });
    } catch (e) {
      storageDump.errors.push(\`Error accessing \${storageName}: \${e.message}\`);
    }
  }

  // Helper to safely get IndexedDB contents
  async function getIndexedDBContents() {
    if (typeof indexedDB === 'undefined') {
      storageDump.errors.push('IndexedDB is not available in this context');
      return;
    }

    try {
      const databases = await indexedDB.databases();
      storageDump.storage.indexedDB = {
        databases: databases.map(db => ({
          name: db.name,
          version: db.version
        }))
      };

      // Try to get contents of each database
      for (const db of databases) {
        try {
          const request = indexedDB.open(db.name);
          request.onerror = () => {
            storageDump.errors.push(\`Error opening IndexedDB database "\${db.name}"\`);
          };
          request.onsuccess = (event) => {
            const database = event.target.result;
            const objectStores = Array.from(database.objectStoreNames);
            storageDump.storage.indexedDB.databases.find(d => d.name === db.name).objectStores = objectStores;
            database.close();
          };
        } catch (e) {
          storageDump.errors.push(\`Error accessing IndexedDB database "\${db.name}": \${e.message}\`);
        }
      }
    } catch (e) {
      storageDump.errors.push(\`Error listing IndexedDB databases: \${e.message}\`);
    }
  }

  // Get localStorage contents
  getStorageContents(localStorage, 'localStorage');

  // Get sessionStorage contents
  getStorageContents(sessionStorage, 'sessionStorage');

  // Get IndexedDB contents
  await getIndexedDBContents();

  // Add metadata
  storageDump.metadata = {
    totalLocalStorageKeys: Object.keys(storageDump.storage.localStorage).length,
    totalSessionStorageKeys: Object.keys(storageDump.storage.sessionStorage).length,
    totalIndexedDBDatabases: storageDump.storage.indexedDB?.databases?.length || 0,
    totalSize: new Blob([JSON.stringify(storageDump.storage)]).size,
    hasErrors: storageDump.errors.length > 0
  };

  return storageDump;
  `
};

export default GetLocalStorage;