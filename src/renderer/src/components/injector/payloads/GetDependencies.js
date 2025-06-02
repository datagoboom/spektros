export const GetDependencies = {
  name: 'Get Dependencies',
  description: 'Scans for installed dependencies, their versions, and potential security issues',
  process: 'main',
  code: `
  return (() => {
      const path = require('path');
      const fs = require('fs');
      const { app } = require('electron');
      
      const dependencyScan = {
          timestamp: new Date().toISOString(),
          method: 'combined',
          app: {
              name: null,
              version: null,
              electronVersion: null,
              nodeVersion: null,
              chromeVersion: null,
              appPath: null,
              isPackaged: null
          },
          dependencies: {
              production: {},
              development: {},
              optional: {}
          },
          loadedModules: {},
          versionMismatches: [],
          metadata: {
              hasPackageJson: false,
              hasNodeModules: false,
              totalDeclaredDeps: 0,
              totalLoadedModules: 0,
              packageJsonPath: null,
              nodeModulesPath: null
          },
          errors: []
      };

      try {
          // Get Electron app info
          dependencyScan.app.name = app.getName();
          dependencyScan.app.version = app.getVersion();
          dependencyScan.app.electronVersion = process.versions.electron;
          dependencyScan.app.nodeVersion = process.versions.node;
          dependencyScan.app.chromeVersion = process.versions.chrome;
          dependencyScan.app.appPath = app.getAppPath();
          dependencyScan.app.isPackaged = app.isPackaged;

          const appPath = app.getAppPath();
          
          // 1. Try to read package.json
          try {
              const packageJsonPath = path.join(appPath, 'package.json');
              dependencyScan.metadata.packageJsonPath = packageJsonPath;
              
              if (fs.existsSync(packageJsonPath)) {
                  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
                  dependencyScan.metadata.hasPackageJson = true;
                  
                  // Get dependencies from package.json
                  if (packageJson.dependencies) {
                      dependencyScan.dependencies.production = packageJson.dependencies;
                  }
                  if (packageJson.devDependencies) {
                      dependencyScan.dependencies.development = packageJson.devDependencies;
                  }
                  if (packageJson.optionalDependencies) {
                      dependencyScan.dependencies.optional = packageJson.optionalDependencies;
                  }
                  
                  dependencyScan.metadata.totalDeclaredDeps = 
                      Object.keys(dependencyScan.dependencies.production).length +
                      Object.keys(dependencyScan.dependencies.development).length +
                      Object.keys(dependencyScan.dependencies.optional).length;
              }
          } catch (e) {
              dependencyScan.errors.push(\`Package.json reading error: \${e.message}\`);
          }
          
          // 2. Analyze require.cache for actually loaded modules
          const nodeModules = new Set();
          const allCachedModules = Object.keys(require.cache);
          
          allCachedModules.forEach(modulePath => {
              if (modulePath.includes('node_modules')) {
                  const parts = modulePath.split('node_modules');
                  if (parts.length > 1) {
                      const pkgPath = parts[parts.length - 1];
                      const pkgParts = pkgPath.split(path.sep).filter(p => p);
                      
                      if (pkgParts.length > 0) {
                          let pkgName = pkgParts[0];
                          
                          // Handle scoped packages (@scope/package)
                          if (pkgName.startsWith('@') && pkgParts.length > 1) {
                              pkgName = pkgParts[0] + '/' + pkgParts[1];
                          }
                          
                          if (pkgName && !pkgName.startsWith('.')) {
                              nodeModules.add(pkgName);
                          }
                      }
                  }
              }
          });
          
          // 3. For each found module, try to get its package.json
          Array.from(nodeModules).forEach(pkg => {
              try {
                  const pkgJsonPath = require.resolve(\`\${pkg}/package.json\`);
                  const pkgJson = require(pkgJsonPath);
                  
                  dependencyScan.loadedModules[pkg] = {
                      version: pkgJson.version,
                      description: pkgJson.description || '',
                      main: pkgJson.main || '',
                      isLoaded: true,
                      resolvedPath: pkgJsonPath,
                      dependencies: pkgJson.dependencies ? Object.keys(pkgJson.dependencies) : []
                  };
                  
                  // Check if this loaded module matches declared dependencies
                  const declaredVersion = dependencyScan.dependencies.production[pkg] || 
                                        dependencyScan.dependencies.development[pkg] || 
                                        dependencyScan.dependencies.optional[pkg];
                  
                  if (declaredVersion) {
                      const cleanDeclaredVersion = declaredVersion.replace(/^[^\\d]*/, '');
                      if (cleanDeclaredVersion !== pkgJson.version) {
                          dependencyScan.versionMismatches.push({
                              name: pkg,
                              declared: cleanDeclaredVersion,
                              loaded: pkgJson.version
                          });
                      }
                  } else {
                      // Module is loaded but not declared in package.json
                      dependencyScan.undeclaredDependencies.push(pkg);
                  }
                  
              } catch (e) {
                  dependencyScan.loadedModules[pkg] = {
                      isLoaded: true,
                      error: \`Could not read package info: \${e.message}\`,
                      resolvedPath: null
                  };
              }
          });
          
          // 4. Check for node_modules directory
          const nodeModulesPath = path.join(appPath, 'node_modules');
          dependencyScan.metadata.nodeModulesPath = nodeModulesPath;
          dependencyScan.metadata.hasNodeModules = fs.existsSync(nodeModulesPath);
          dependencyScan.metadata.totalLoadedModules = Object.keys(dependencyScan.loadedModules).length;
          
          // 5. Find packages declared but not loaded
          const declaredPackages = new Set([
              ...Object.keys(dependencyScan.dependencies.production),
              ...Object.keys(dependencyScan.dependencies.development),
              ...Object.keys(dependencyScan.dependencies.optional)
          ]);
          
          const loadedPackages = new Set(Object.keys(dependencyScan.loadedModules));
          
          dependencyScan.metadata.declaredButNotLoaded = [];
          declaredPackages.forEach(pkg => {
              if (!loadedPackages.has(pkg)) {
                  dependencyScan.metadata.declaredButNotLoaded.push(pkg);
              }
          });
          
          // Additional metadata
          dependencyScan.metadata.totalCachedModules = allCachedModules.length;
          
      } catch (e) {
          dependencyScan.errors.push(\`General scanning error: \${e.message}\`);
      }

      return dependencyScan;
  })();
  `
};

export default GetDependencies;