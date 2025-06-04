import { extractAll, createPackage } from '@electron/asar';
import { join } from 'path';
import { tmpdir } from 'os';
import { mkdtempSync, readFileSync } from 'fs';
import { promises as fs } from 'fs';
import micromatch from 'micromatch';
import { pack } from '@electron/asar';

/**
 * Extract ASAR file to a temporary directory
 * @param {string} asarPath - Path to the ASAR file
 * @returns {Promise<{tmpDir: string}>} - Object containing temp directory path
 */
async function extractAsarToTmp(asarPath) {
  // Create a unique temp directory
  const tmpDir = mkdtempSync(join(tmpdir(), 'asar-extract-'));
  
  try {
    // Extract ASAR to the temp directory
    await extractAll(asarPath.filePath, tmpDir);
    console.log(`✅ Extracted ASAR to ${tmpDir}`);
    return { tmpDir };
  } catch (error) {
    console.error('Failed to extract ASAR:', error);
    throw new Error(`ASAR extraction failed: ${error.message}`);
  }
}

/**
 * Read file content synchronously
 * @param {string} filePath - Path to the file
 * @returns {string} - File content as string
 */
function getFileContent(filePath) {
  try {
    return readFileSync(filePath, 'utf8');
  } catch (error) {
    console.error('Failed to read file:', error);
    throw new Error(`File read failed: ${error.message}`);
  }
}

/**
 * Get file tree from directory recursively
 * @param {string} tmpDir - Root directory to scan
 * @returns {Promise<Array<string>>} - Array of file paths
 */
async function getFileTree(tmpDir) {
  const fileTree = [];
  
  async function readDir(dir, relativePath = '') {
    try {
      const files = await fs.readdir(dir, { withFileTypes: true });
      
      await Promise.all(files.map(async file => {
        const fullPath = join(dir, file.name);
        const relativeFilePath = join(relativePath, file.name);
        
        if (file.isDirectory()) {
          // Recursively read subdirectories
          await readDir(fullPath, relativeFilePath);
        } else {
          // Add file to tree with both absolute and relative paths
          fileTree.push({
            name: file.name,
            path: fullPath,
            relativePath: relativeFilePath,
            size: (await fs.stat(fullPath)).size,
            type: getFileType(file.name)
          });
        }
      }));
    } catch (error) {
      console.error(`Failed to read directory ${dir}:`, error);
      throw new Error(`Directory read failed: ${error.message}`);
    }
  }
  
  await readDir(tmpDir);
  return fileTree.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

/**
 * Save content to a file
 * @param {string} filePath - Path where to save the file
 * @param {string} content - Content to save
 * @returns {Promise<void>}
 */
async function saveFileContent(filePath, content) {
  try {
    await fs.writeFile(filePath, content, 'utf8');
    console.log(`✅ Saved file: ${filePath}`);
  } catch (error) {
    console.error('Failed to save file:', error);
    throw new Error(`File save failed: ${error.message}`);
  }
}

/**
 * Get file type based on extension
 * @param {string} fileName - Name of the file
 * @returns {string} - File type category
 */
function getFileType(fileName) {
  const ext = fileName.split('.').pop()?.toLowerCase();
  
  const typeMap = {
    // Code files
    'js': 'javascript',
    'jsx': 'javascript',
    'ts': 'typescript',
    'tsx': 'typescript',
    'py': 'python',
    'java': 'java',
    'cpp': 'cpp',
    'c': 'c',
    'cs': 'csharp',
    'php': 'php',
    'rb': 'ruby',
    'go': 'go',
    'rs': 'rust',
    'sh': 'bash',
    
    // Web files
    'html': 'html',
    'css': 'css',
    'scss': 'scss',
    'sass': 'sass',
    'vue': 'vue',
    
    // Data files
    'json': 'json',
    'xml': 'xml',
    'yaml': 'yaml',
    'yml': 'yaml',
    'toml': 'toml',
    'ini': 'ini',
    'env': 'env',
    
    // Documentation
    'md': 'markdown',
    'txt': 'text',
    'rst': 'restructuredtext',
    
    // Images
    'png': 'image',
    'jpg': 'image',
    'jpeg': 'image',
    'gif': 'image',
    'svg': 'image',
    'ico': 'image',
    
    // Other
    'pdf': 'pdf',
    'zip': 'archive',
    'tar': 'archive',
    'gz': 'archive'
  };
  
  return typeMap[ext] || 'unknown';
}

/**
 * Clean up temporary directory
 * @param {string} tmpDir - Temporary directory to clean up
 * @returns {Promise<void>}
 */
async function cleanupTmpDir(tmpDir) {
  try {
    await fs.rm(tmpDir, { recursive: true, force: true });
    console.log(`🗑️  Cleaned up temp directory: ${tmpDir}`);
  } catch (error) {
    console.error('Failed to cleanup temp directory:', error);
    // Don't throw - cleanup errors shouldn't break the app
  }
}

/**
 * Search for text across files in a directory
 * @param {string} tmpDir - Directory to search in
 * @param {string} searchQuery - Text to search for
 * @param {Object} options - Search options
 * @param {boolean} options.matchCase - Case sensitive search
 * @param {boolean} options.matchWholeWord - Match whole words only
 * @param {boolean} options.useRegex - Use regular expressions
 * @param {Array<string>} options.includePatterns - File patterns to include (e.g., ['*.js', '*.jsx'])
 * @param {Array<string>} options.excludePatterns - File patterns to exclude (e.g., ['node_modules/**', '*.min.js'])
 * @param {number} options.maxResults - Maximum number of results per file (default: 100)
 * @param {number} options.contextLines - Number of context lines around matches (default: 0)
 * @returns {Promise<Object>} - Search results grouped by file
 */
async function searchFiles(tmpDir, searchQuery, options = {}) {
  const {
    matchCase = false,
    matchWholeWord = false,
    useRegex = false,
    includePatterns = [],
    excludePatterns = ['node_modules/**', '.git/**', '*.min.js', '*.bundle.js'],
    maxResults = 100,
    contextLines = 0
  } = options;

  if (!searchQuery.trim()) {
    return { results: {}, totalMatches: 0, searchTime: 0 };
  }

  const startTime = Date.now();
  const results = {};
  let totalMatches = 0;

  try {
    // Get all files in the directory
    const allFiles = await getAllSearchableFiles(tmpDir, includePatterns, excludePatterns);
    
    // Create search pattern
    const searchPattern = createSearchPattern(searchQuery, { matchCase, matchWholeWord, useRegex });
    
    // Search each file
    await Promise.all(allFiles.map(async (fileInfo) => {
      try {
        const matches = await searchInFile(fileInfo, searchPattern, { maxResults, contextLines, matchCase });
        
        if (matches.length > 0) {
          results[fileInfo.relativePath] = {
            ...fileInfo,
            matches,
            matchCount: matches.length
          };
          totalMatches += matches.length;
        }
      } catch (error) {
        // Skip files that can't be read (binary files, permission issues, etc.)
        console.warn(`Skipping file ${fileInfo.path}: ${error.message}`);
      }
    }));

    const searchTime = Date.now() - startTime;
    
    return {
      results,
      totalMatches,
      fileCount: Object.keys(results).length,
      searchTime,
      query: searchQuery,
      options
    };

  } catch (error) {
    console.error('Search failed:', error);
    throw new Error(`Search failed: ${error.message}`);
  }
}

/**
 * Get all searchable files in directory with pattern filtering
 */
async function getAllSearchableFiles(tmpDir, includePatterns, excludePatterns) {
  const files = [];
  
  async function scanDirectory(dir, relativePath = '') {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      await Promise.all(entries.map(async (entry) => {
        const fullPath = join(dir, entry.name);
        const relativeFilePath = join(relativePath, entry.name).replace(/\\/g, '/'); // Normalize path separators
        
        // Skip excluded patterns
        if (excludePatterns.some(pattern => micromatch.isMatch(relativeFilePath, pattern))) {
          return;
        }
        
        if (entry.isDirectory()) {
          await scanDirectory(fullPath, relativeFilePath);
        } else {
          // Check if file matches include patterns (if specified)
          if (includePatterns.length === 0 || includePatterns.some(pattern => micromatch.isMatch(relativeFilePath, pattern))) {
            // Only include text files
            if (isTextFile(entry.name)) {
              const stats = await fs.stat(fullPath);
              files.push({
                name: entry.name,
                path: fullPath,
                relativePath: relativeFilePath,
                size: stats.size,
                type: getFileType(entry.name)
              });
            }
          }
        }
      }));
    } catch (error) {
      console.warn(`Cannot read directory ${dir}: ${error.message}`);
    }
  }
  
  await scanDirectory(tmpDir);
  return files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

/**
 * Create search pattern based on options
 */
function createSearchPattern(query, { matchCase, matchWholeWord, useRegex }) {
  let pattern;
  let flags = matchCase ? 'g' : 'gi';
  
  if (useRegex) {
    try {
      pattern = new RegExp(query, flags);
    } catch (error) {
      throw new Error(`Invalid regular expression: ${error.message}`);
    }
  } else {
    // Escape special regex characters
    let escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    if (matchWholeWord) {
      escapedQuery = `\\b${escapedQuery}\\b`;
    }
    
    pattern = new RegExp(escapedQuery, flags);
  }
  
  return pattern;
}

/**
 * Search within a single file
 */
async function searchInFile(fileInfo, pattern, { maxResults, contextLines, matchCase }) {
  const matches = [];
  
  // Skip large files to prevent memory issues
  if (fileInfo.size > 10 * 1024 * 1024) { // 10MB limit
    return matches;
  }
  
  try {
    const content = await fs.readFile(fileInfo.path, 'utf8');
    const lines = content.split('\n');
    
    lines.forEach((line, lineIndex) => {
      if (matches.length >= maxResults) return;
      
      const lineMatches = [];
      let match;
      
      // Reset regex lastIndex for global patterns
      pattern.lastIndex = 0;
      
      while ((match = pattern.exec(line)) !== null && lineMatches.length < 10) {
        const startCol = match.index;
        const endCol = match.index + match[0].length;
        
        lineMatches.push({
          text: match[0],
          startCol,
          endCol
        });
        
        // Prevent infinite loop with zero-width matches
        if (match.index === pattern.lastIndex) {
          pattern.lastIndex++;
        }
      }
      
      if (lineMatches.length > 0) {
        const matchInfo = {
          line: lineIndex + 1, // 1-based line numbers
          content: line,
          matches: lineMatches,
          highlighted: highlightMatches(line, lineMatches)
        };
        
        // Add context lines if requested
        if (contextLines > 0) {
          matchInfo.context = {
            before: lines.slice(Math.max(0, lineIndex - contextLines), lineIndex),
            after: lines.slice(lineIndex + 1, Math.min(lines.length, lineIndex + 1 + contextLines))
          };
        }
        
        matches.push(matchInfo);
      }
    });
    
  } catch (error) {
    // File might be binary or have encoding issues
    throw new Error(`Cannot read file: ${error.message}`);
  }
  
  return matches;
}

/**
 * Highlight matches in a line of text
 */
function highlightMatches(line, matches) {
  if (!matches.length) return line;
  
  let highlighted = '';
  let lastIndex = 0;
  
  // Sort matches by start position
  const sortedMatches = matches.sort((a, b) => a.startCol - b.startCol);
  
  sortedMatches.forEach(match => {
    // Add text before match
    highlighted += line.slice(lastIndex, match.startCol);
    
    // Add highlighted match
    highlighted += `<mark>${line.slice(match.startCol, match.endCol)}</mark>`;
    
    lastIndex = match.endCol;
  });
  
  // Add remaining text
  highlighted += line.slice(lastIndex);
  
  return highlighted;
}

/**
 * Check if file is likely a text file based on extension
 */
function isTextFile(fileName) {
  const textExtensions = [
    // Code files
    'js', 'jsx', 'ts', 'tsx', 'py', 'java', 'cpp', 'c', 'cs', 'php', 'rb', 'go', 'rs', 'sh', 'bash',
    // Web files  
    'html', 'htm', 'css', 'scss', 'sass', 'vue', 'svelte',
    // Data files
    'json', 'xml', 'yaml', 'yml', 'toml', 'ini', 'env', 'config', 'conf',
    // Documentation
    'md', 'txt', 'rst', 'adoc',
    // Build files
    'dockerfile', 'makefile', 'cmake',
    // Other text files
    'log', 'sql', 'graphql', 'gql'
  ];
  
  const ext = fileName.split('.').pop()?.toLowerCase();
  return textExtensions.includes(ext) || !fileName.includes('.'); // Files without extension are often text
}

/**
 * Replace text in files (for find/replace functionality)
 * @param {string} tmpDir - Directory to search in
 * @param {string} searchQuery - Text to find
 * @param {string} replaceText - Text to replace with
 * @param {Object} options - Same options as searchFiles
 * @param {Array<string>} targetFiles - Specific files to replace in (optional, defaults to all matches)
 * @returns {Promise<Object>} - Replace results
 */
async function replaceInFiles(tmpDir, searchQuery, replaceText, options = {}, targetFiles = null) {
  const searchResults = await searchFiles(tmpDir, searchQuery, options);
  const replaceResults = {
    filesModified: 0,
    totalReplacements: 0,
    modifiedFiles: []
  };
  
  const filesToProcess = targetFiles || Object.keys(searchResults.results);
  
  for (const relativePath of filesToProcess) {
    const fileResult = searchResults.results[relativePath];
    if (!fileResult) continue;
    
    try {
      const content = await fs.readFile(fileResult.path, 'utf8');
      const pattern = createSearchPattern(searchQuery, options);
      
      // Count matches before replacement
      const matchCount = (content.match(pattern) || []).length;
      
      if (matchCount > 0) {
        const newContent = content.replace(pattern, replaceText);
        await fs.writeFile(fileResult.path, newContent, 'utf8');
        
        replaceResults.filesModified++;
        replaceResults.totalReplacements += matchCount;
        replaceResults.modifiedFiles.push({
          path: relativePath,
          replacements: matchCount
        });
        
        console.log(`✅ Replaced ${matchCount} occurrences in ${relativePath}`);
      }
    } catch (error) {
      console.error(`Failed to replace in ${relativePath}:`, error);
    }
  }
  
  return replaceResults;
}

/**
 * Repack a directory into an ASAR file
 * @param {string} sourceDir - Directory to pack
 * @param {string} outputPath - Path where to save the ASAR file
 * @returns {Promise<{success: boolean, outputPath: string}>}
 */
async function repackAsar(sourceDir, outputPath) {
  try {
    // Pack the directory into an ASAR file
    await createPackage(sourceDir, outputPath);
    console.log(`✅ Repacked ASAR to ${outputPath}`);
    return { success: true, outputPath };
  } catch (error) {
    console.error('Failed to repack ASAR:', error);
    throw new Error(`ASAR repacking failed: ${error.message}`);
  }
}

export { 
  extractAsarToTmp, 
  getFileContent, 
  getFileTree, 
  saveFileContent,
  cleanupTmpDir,
  getFileType,
  searchFiles,
  replaceInFiles,
  repackAsar
};