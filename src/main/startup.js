import { app } from 'electron';
import { join, dirname } from 'path';
import { promises as fs } from 'fs';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import payloadsData from './encoded-payloads.json' assert { type: 'json' };

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Get the payloads directory path
 * @returns {string} - Path to payloads directory
 */
function getPayloadsPath() {
  const appDataPath = app.getPath('userData');
  return join(appDataPath, 'payloads');
}

/**
 * Ensure a directory exists, create if it doesn't
 * @param {string} dirPath - Directory path to ensure
 * @returns {Promise<void>}
 */
async function ensureDirectory(dirPath) {
  try {
    if (!existsSync(dirPath)) {
      await fs.mkdir(dirPath, { recursive: true });
      console.log(`✅ Created directory: ${dirPath}`);
    }
  } catch (error) {
    console.error(`Failed to create directory ${dirPath}:`, error);
    throw error;
  }
}

/**
 * Decode base64 content and save to file
 * @param {string} filePath - Full path where to save the file
 * @param {string} base64Content - Base64 encoded content
 * @returns {Promise<void>}
 */
async function saveDecodedFile(filePath, base64Content) {
  try {
    // Ensure the directory exists
    const dir = dirname(filePath);
    await ensureDirectory(dir);
    
    // Decode base64 content
    const content = Buffer.from(base64Content, 'base64').toString('utf8');
    
    // Write file
    await fs.writeFile(filePath, content, 'utf8');
    console.log(`📝 Created payload: ${filePath}`);
  } catch (error) {
    console.error(`Failed to save file ${filePath}:`, error);
    throw error;
  }
}

/**
 * Initialize payloads directory with decoded files
 * @returns {Promise<void>}
 */
async function initializePayloads() {
  console.log('🚀 Initializing payloads directory...');
  
  try {
    const payloadsPath = getPayloadsPath();
    console.log(`📁 Payloads directory: ${payloadsPath}`);
    
    // Ensure main payloads directory exists
    await ensureDirectory(payloadsPath);
    
    // Process each file in the payloads data
    const fileNames = Object.keys(payloadsData);
    console.log(`📦 Processing ${fileNames.length} payload files...`);
    
    for (const fileName of fileNames) {
      const base64Content = payloadsData[fileName];
      const fullPath = join(payloadsPath, fileName);
      
      // Only create file if it doesn't exist (don't overwrite user modifications)
      if (!existsSync(fullPath)) {
        await saveDecodedFile(fullPath, base64Content);
      } else {
        console.log(`⏭️  Skipping existing file: ${fileName}`);
      }
    }
    
    console.log('✅ Payloads directory initialized successfully');
    
  } catch (error) {
    console.error('❌ Failed to initialize payloads:', error);
    // Don't throw - app should continue even if payloads fail
  }
}

export { initializePayloads, getPayloadsPath };