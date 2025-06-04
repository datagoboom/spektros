import { app } from 'electron';
import { join, dirname, basename } from 'path';
import { promises as fs } from 'fs';
import { existsSync } from 'fs';
import { createHash } from 'crypto';
import { tmpdir } from 'os';
import { extractAll, createPackage } from '@electron/asar';
import { createServer } from 'http';


function getAppDataPath() {
  return app.getPath('userData');
}

function getPayloadsPath() {
  return join(getAppDataPath(), 'payloads');
}

function getBackupsPath() {
  return join(getAppDataPath(), 'backups');
}


async function ensureDirectory(dirPath) {
  if (!existsSync(dirPath)) {
    await fs.mkdir(dirPath, { recursive: true });
  }
}


function hashPath(filePath) {
  return createHash('md5').update(filePath).digest('hex').substring(0, 8);
}


async function extractAsar(asarPath) {
  const extractDir = join(tmpdir(), `asar_extract_${Date.now()}_${Math.random().toString(36).substring(7)}`);
  
  try {
    await fs.mkdir(extractDir, { recursive: true });
    
    console.log(`📂 Extracting ASAR file: ${asarPath}`);
    
    
    await extractAll(asarPath, extractDir);
    
    
    const files = await fs.readdir(extractDir);
    if (files.length === 0) {
      throw new Error('ASAR extraction failed - no files found');
    }
    
    console.log(`✅ Extraction completed, found ${files.length} items`);
    return extractDir;
    
  } catch (error) {
    try {
      await fs.rm(extractDir, { recursive: true, force: true });
    } catch (cleanupError) {
      
    }
    throw new Error(`Failed to extract ASAR: ${error.message}`);
  }
}


async function repackAsar(extractDir, outputPath) {
  try {
    console.log(`📦 Repacking ASAR file: ${outputPath}`);
    await createPackage(extractDir, outputPath);
    console.log(`✅ ASAR repacked successfully`);
  } catch (error) {
    throw new Error(`Failed to repack ASAR: ${error.message}`);
  }
}


async function findMainScript(extractDir) {
  try {
    
    const commonMainFiles = [
      'main.js',
      'index.js',
      'app.js',
      'electron.js',
      'main.bundle.js',
      'main.bundle.cjs',
      'dist/main/index.js',
      'src/main/index.js'
    ];

    for (const file of commonMainFiles) {
      const filePath = join(extractDir, file);
      if (existsSync(filePath)) {
        console.log(`✅ Found main script: ${file}`);
        return file;
      }
    }

    
    const packagePath = join(extractDir, 'package.json');
    if (existsSync(packagePath)) {
      try {
        const packageData = JSON.parse(await fs.readFile(packagePath, 'utf8'));
        if (packageData.main) {
          const mainPath = join(extractDir, packageData.main);
          if (existsSync(mainPath)) {
            console.log(`✅ Found main script from package.json: ${packageData.main}`);
            return packageData.main;
          }
        }
      } catch (error) {
        console.warn('Failed to parse package.json:', error.message);
      }
    }

    
    const jsFiles = await findJavaScriptFiles(extractDir);
    if (jsFiles.length > 0) {
      console.log(`✅ Found JavaScript file: ${jsFiles[0]}`);
      return jsFiles[0];
    }

    throw new Error('No suitable script found in ASAR');
  } catch (error) {
    console.error('Failed to find main script:', error);
    throw error;
  }
}


async function findJavaScriptFiles(dir, relativePath = '') {
  const jsFiles = [];
  
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      const relativeFilePath = join(relativePath, entry.name);
      
      if (entry.isDirectory()) {
        
        if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'build') {
          continue;
        }
        const subDirFiles = await findJavaScriptFiles(fullPath, relativeFilePath);
        jsFiles.push(...subDirFiles);
      } else if (entry.name.endsWith('.js')) {
        jsFiles.push(relativeFilePath);
      }
    }
  } catch (error) {
    console.warn(`Failed to read directory ${dir}:`, error.message);
  }
  
  return jsFiles;
}


async function injectPayloadIntoScript(scriptPath, payload) {
  try {
    const originalContent = await fs.readFile(scriptPath, 'utf8');
    
    
    const cleanPayload = payload.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    
    const injectedContent = `${cleanPayload}\n\n${originalContent}`;
    
    await fs.writeFile(scriptPath, injectedContent, 'utf8');
  } catch (error) {
    throw new Error(`Failed to inject payload: ${error.message}`);
  }
}


async function createBackup(asarPath) {
  try {
    console.log(`📦 Creating backup for: ${asarPath}`);
    
    
    if (!existsSync(asarPath)) {
      throw new Error(`Cannot create backup: ASAR file not found at ${asarPath}`);
    }
    
    await ensureDirectory(getBackupsPath());
    
    const hash = hashPath(asarPath);
    const timestamp = Date.now();
    const backupName = `${basename(asarPath)}_${hash}_${timestamp}.backup`;
    const backupPath = join(getBackupsPath(), backupName);
    
    console.log(`📋 Backup will be created at: ${backupPath}`);
    
    
    await fs.copyFile(asarPath, backupPath);
    console.log(`✅ Created backup from ASAR file`);
    
    return backupPath;
  } catch (error) {
    console.error(`❌ Backup creation failed: ${error.message}`);
    throw new Error(`Failed to create backup: ${error.message}`);
  }
}


async function resolveAsarPath(asarPath) {
  try {
    console.log(`🔍 Resolving ASAR path: ${asarPath}`);
    
    
    if (existsSync(asarPath)) {
      const stats = await fs.stat(asarPath);
      
      
      if (stats.isFile() && stats.size > 0) {
        console.log(`✅ Using selected file directly: ${asarPath} (${stats.size} bytes)`);
        return asarPath;
      }
      
      
      console.log(`⚠️  Selected file appears to be ${stats.isDirectory() ? 'a directory' : 'empty'} (${stats.size} bytes)`);
      console.log(`🔍 This might be a mounted ASAR file`);
      
      
      if (asarPath.endsWith('.asar')) {
        console.log(`🔄 Attempting to use mounted ASAR directly...`);
        
        
        try {
          await fs.access(asarPath, fs.constants.R_OK);
          console.log(`✅ Mounted ASAR is accessible, trying to use it directly`);
          return asarPath;
        } catch (accessError) {
          console.log(`❌ Cannot access mounted ASAR: ${accessError.message}`);
        }
      }
      
      
      throw new Error(`
Selected ASAR file cannot be used directly:
- Path: ${asarPath}
- Size: ${stats.size} bytes
- Type: ${stats.isDirectory() ? 'directory (mounted)' : 'file'}

This appears to be a mounted ASAR file. Try one of these alternatives:
1. Close any application using this ASAR file
2. Select a different ASAR file in the same directory
3. Use the original AppImage file instead

The file must be unmounted and accessible for injection to work.
      `);
    }
    
    throw new Error(`Selected ASAR file does not exist: ${asarPath}`);
    
  } catch (error) {
    console.error(`❌ Failed to resolve ASAR path: ${error.message}`);
    throw error;
  }
}


async function getPassthroughPayload() {
  const payloadsPath = getPayloadsPath();
  const passthroughPath = join(payloadsPath, 'passthrough.js');
  
  if (!existsSync(passthroughPath)) {
    throw new Error('Passthrough payload not found. Please ensure passthrough.js exists in the payloads directory.');
  }
  
  return fs.readFile(passthroughPath, 'utf8');
}


async function setupInjection(asarPath) {
  let extractDir = null;
  
  try {
    console.log(`🚀 Starting injection setup for: ${asarPath}`);
    
    
    if (!existsSync(asarPath)) {
      throw new Error(`Selected ASAR file does not exist: ${asarPath}`);
    }
    
    
    extractDir = await extractAsar(asarPath);
    console.log(`📂 Extracted ASAR to: ${extractDir}`);
    
    
    const files = await fs.readdir(extractDir);
    console.log('📋 ASAR contents:', files);
    
    
    const mainScript = await findMainScript(extractDir);
    const scriptPath = join(extractDir, mainScript);
    console.log(`🎯 Found main script: ${mainScript}`);
    
    
    const payload = await getPassthroughPayload();
    console.log('📜 Loaded passthrough payload');
    
    
    await injectPayloadIntoScript(scriptPath, payload);
    console.log(`💉 Injected payload into: ${mainScript}`);
    
    
    await repackAsar(extractDir, asarPath);
    console.log(`📦 Repacked ASAR: ${asarPath}`);
    
    return {
      success: true,
      asarPath,
      injectedFile: mainScript,
      message: 'ASAR extracted and payload injected successfully'
    };
    
  } catch (error) {
    console.error(`❌ Injection setup failed: ${error.message}`);
    throw error;
  } finally {
    
    if (extractDir) {
      try {
        await fs.rm(extractDir, { recursive: true, force: true });
      } catch (cleanupError) {
        console.warn(`Warning: Could not cleanup temp directory: ${extractDir}`);
      }
    }
  }
}

async function injectPayload(payloadPath, asarPath, customTarget = null) {
  let extractDir = null;
  
  try {
    console.log(`🚀 Starting injection: ${payloadPath} -> ${asarPath}`);
    
    
    if (!existsSync(payloadPath)) {
      throw new Error(`Payload file not found: ${payloadPath}`);
    }
    
    if (!existsSync(asarPath)) {
      throw new Error(`ASAR file not found: ${asarPath}`);
    }
    
    
    const payloadContent = await fs.readFile(payloadPath, 'utf8');
    if (!payloadContent.trim()) {
      throw new Error('Payload file is empty');
    }
    
    
    extractDir = await extractAsar(asarPath);
    console.log(`📂 Extracted ASAR to: ${extractDir}`);
    
    let mainScript
    if(customTarget) { 
      
      mainScript = customTarget;
      console.log(`🔍 Using custom target path: ${mainScript}`);
    }else{
      mainScript = await findMainScript(extractDir);
      console.log(`🎯 Found main script: ${mainScript}`);
    }
    
    const scriptPath = join(extractDir, mainScript);
    
    
    await injectPayloadIntoScript(scriptPath, payloadContent);
    console.log(`💉 Injected payload into: ${mainScript}`);
    
    
    await repackAsar(extractDir, asarPath);
    console.log(`📦 Repacked ASAR: ${asarPath}`);
    
    return {
      success: true,
      injectedFile: mainScript,
      message: 'Payload injected successfully'
    };
    
  } catch (error) {
    console.error(`❌ Injection failed: ${error.message}`);
    throw error;
  } finally {
    
    if (extractDir) {
      try {
        await fs.rm(extractDir, { recursive: true, force: true });
      } catch (cleanupError) {
        console.warn(`Warning: Could not cleanup temp directory: ${extractDir}`);
      }
    }
  }
}


async function createPayload(name, content, category = 'custom') {
  try {
    await ensureDirectory(getPayloadsPath());
    
    const categoryDir = join(getPayloadsPath(), category);
    await ensureDirectory(categoryDir);
    
    
    const fileName = name.endsWith('.js') ? name : `${name}.js`;
    const payloadPath = join(categoryDir, fileName);
    
    if (existsSync(payloadPath)) {
      throw new Error(`Payload already exists: ${fileName}`);
    }
    
    await fs.writeFile(payloadPath, content, 'utf8');
    
    return {
      success: true,
      path: payloadPath,
      relativePath: join(category, fileName),
      message: 'Payload created successfully'
    };
  } catch (error) {
    throw new Error(`Failed to create payload: ${error.message}`);
  }
}


async function listPayloads() {
  try {
    const payloadsPath = getPayloadsPath();
    
    if (!existsSync(payloadsPath)) {
      return { payloads: [], count: 0 };
    }
    
    const payloads = [];
    
    async function scanDirectory(dir, relativePath = '') {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        const relativeFilePath = relativePath ? join(relativePath, entry.name) : entry.name;
        
        if (entry.isDirectory()) {
          await scanDirectory(fullPath, relativeFilePath);
        } else {
          const stats = await fs.stat(fullPath);
          payloads.push({
            name: entry.name,
            path: fullPath,
            relativePath: relativeFilePath,
            category: relativePath || 'root',
            size: stats.size,
            modified: stats.mtime,
            isJavaScript: entry.name.endsWith('.js')
          });
        }
      }
    }
    
    await scanDirectory(payloadsPath);
    
    
    payloads.sort((a, b) => {
      if (a.category !== b.category) {
        return a.category.localeCompare(b.category);
      }
      return a.name.localeCompare(b.name);
    });
    
    return {
      success: true,
      payloads,
      count: payloads.length
    };
  } catch (error) {
    throw new Error(`Failed to list payloads: ${error.message}`);
  }
}


async function listBackups(asarPath = null) {
  try {
    const backupsPath = getBackupsPath();
    
    if (!existsSync(backupsPath)) {
      return { backups: [], count: 0 };
    }
    
    const entries = await fs.readdir(backupsPath);
    const backups = [];
    
    for (const entry of entries) {
      if (!entry.endsWith('.backup')) continue;
      
      const fullPath = join(backupsPath, entry);
      const stats = await fs.stat(fullPath);
      
      
      const parts = entry.replace('.backup', '').split('_');
      if (parts.length >= 3) {
        const timestamp = parseInt(parts[parts.length - 1]);
        const hash = parts[parts.length - 2];
        const originalName = parts.slice(0, -2).join('_');
        
        const backup = {
          name: entry,
          path: fullPath,
          originalName,
          hash,
          timestamp,
          created: new Date(timestamp),
          size: stats.size
        };
        
        
        if (!asarPath || hash === hashPath(asarPath)) {
          backups.push(backup);
        }
      }
    }
    
    
    backups.sort((a, b) => b.timestamp - a.timestamp);
    
    return {
      success: true,
      backups,
      count: backups.length
    };
  } catch (error) {
    throw new Error(`Failed to list backups: ${error.message}`);
  }
}


async function restoreBackup(backupPath, asarPath) {
  try {
    if (!existsSync(backupPath)) {
      throw new Error(`Backup file not found: ${backupPath}`);
    }
    
    
    const backupName = basename(backupPath);
    const parts = backupName.replace('.backup', '').split('_');
    if (parts.length >= 3) {
      const backupHash = parts[parts.length - 2];
      const asarHash = hashPath(asarPath);
      
      if (backupHash !== asarHash) {
        throw new Error('Backup does not match target ASAR file');
      }
    } else {
      throw new Error('Invalid backup file format');
    }
    
    
    await fs.copyFile(backupPath, asarPath);
    
    return {
      success: true,
      message: 'ASAR restored from backup successfully'
    };
  } catch (error) {
    throw new Error(`Failed to restore backup: ${error.message}`);
  }
}


async function deleteBackup(backupPath) {
  try {
    if (!existsSync(backupPath)) {
      throw new Error(`Backup file not found: ${backupPath}`);
    }
    
    await fs.unlink(backupPath);
    
    return {
      success: true,
      message: 'Backup deleted successfully'
    };
  } catch (error) {
    throw new Error(`Failed to delete backup: ${error.message}`);
  }
}


const connectedApps = new Map();


let callHomeServer = null;
const CALL_HOME_PORT = 5666;


async function startCallHomeListener() {
  if (callHomeServer) {
    console.log('Call-home listener already running');
    return;
  }

  try {
    callHomeServer = createServer(async (req, res) => {
      if (req.method === 'POST' && req.url === '/call-home') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
          try {
            const data = JSON.parse(body);
            console.log(`📱 Call-home from: ${data.app_name}`);
            console.log(data);
            if (!data.uuid) {
              res.writeHead(400);
              res.end(JSON.stringify({ error: 'Missing uuid in call-home' }));
              return;
            }
            
            const appInfo = {
              uuid: data.uuid,
              name: data.app_name,
              lastSeen: Date.now(),
              timestamp: data.timestamp,
              active_jobs: data.active_jobs,
              ip: req.socket.remoteAddress,
              port: data.port
            };
            connectedApps.set(data.uuid, appInfo);
            res.writeHead(200);
            res.end(JSON.stringify({ status: 'ok' }));
          } catch (error) {
            console.error('Failed to process call-home:', error);
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'Invalid request' }));
          }
        });
      } else {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Not found' }));
      }
    });
    callHomeServer.listen(CALL_HOME_PORT, '127.0.0.1', () => {
      console.log(`📱 Call-home listener running on port ${CALL_HOME_PORT}`);
    });
    callHomeServer.on('error', (error) => {
      console.error('Call-home server error:', error);
      callHomeServer = null;
    });
  } catch (error) {
    console.error('Failed to start call-home listener:', error);
    callHomeServer = null;
  }
}


async function stopCallHomeListener() {
  if (callHomeServer) {
    try {
      await new Promise((resolve, reject) => {
        callHomeServer.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });
      console.log('Call-home listener stopped');
    } catch (error) {
      console.error('Failed to stop call-home listener:', error);
    }
    callHomeServer = null;
  }
}


async function sendPayload(appPort, payload, options = {}) {
  const {
    windowId = null,
    context = 'renderer',
    base64 = true
  } = options;

  try {
    
    if (!appPort || typeof appPort !== 'number') {
      throw new Error('Invalid port number');
    }

    
    if (!payload || typeof payload !== 'string') {
      throw new Error('Invalid payload content');
    }

    const endpoint = windowId ? `/execute/${windowId}` : '/execute';
    const url = `http://127.0.0.1:${appPort}${endpoint}`;
    
    console.log(`Sending payload to ${url}`);
    
    const postData = JSON.stringify({
      code: base64 ? Buffer.from(payload).toString('base64') : payload,
      base64,
      context
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      body: postData
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Failed to send payload:', error);
    throw error;
  }
}


async function getPayloadStatus(appPort, jobId) {
  try {
    const url = `http://127.0.0.1:${appPort}/status/${jobId}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to get payload status:', error);
    throw error;
  }
}


async function getHookedApps() {
  return { apps: Array.from(connectedApps.values()) };
}


function templatePayload(template, variables) {
  return template.replace(/\{\{\s*([\w_]+)\s*\}\}/g, (match, key) => {
    return Object.prototype.hasOwnProperty.call(variables, key) ? variables[key] : match;
  });
}

export { 
  setupInjection,  
  injectPayload,
  createPayload,
  listPayloads,
  listBackups,
  restoreBackup,
  deleteBackup,
  getPayloadsPath,
  getBackupsPath,
  startCallHomeListener,
  stopCallHomeListener,
  sendPayload,
  getPayloadStatus,
  getHookedApps,
  templatePayload  
};