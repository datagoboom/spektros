import { extractAll, createPackage } from '@electron/asar';
import { join } from 'path';
import { tmpdir } from 'os';
import { mkdtempSync, readFileSync } from 'fs';
import { promises as fs } from 'fs';
import micromatch from 'micromatch';
import { pack } from '@electron/asar';


async function extractAsarToTmp(asarPath) {
  
  const tmpDir = mkdtempSync(join(tmpdir(), 'asar-extract-'));
  
  try {
    
    await extractAll(asarPath.filePath, tmpDir);
    console.log(`✅ Extracted ASAR to ${tmpDir}`);
    return { tmpDir };
  } catch (error) {
    console.error('Failed to extract ASAR:', error);
    throw new Error(`ASAR extraction failed: ${error.message}`);
  }
}


function getFileContent(filePath) {
  try {
    return readFileSync(filePath, 'utf8');
  } catch (error) {
    console.error('Failed to read file:', error);
    throw new Error(`File read failed: ${error.message}`);
  }
}


async function getFileTree(tmpDir) {
  const fileTree = [];
  
  async function readDir(dir, relativePath = '') {
    try {
      const files = await fs.readdir(dir, { withFileTypes: true });
      
      await Promise.all(files.map(async file => {
        const fullPath = join(dir, file.name);
        const relativeFilePath = join(relativePath, file.name);
        
        if (file.isDirectory()) {
          
          await readDir(fullPath, relativeFilePath);
        } else {
          
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


async function saveFileContent(filePath, content) {
  try {
    await fs.writeFile(filePath, content, 'utf8');
    console.log(`✅ Saved file: ${filePath}`);
  } catch (error) {
    console.error('Failed to save file:', error);
    throw new Error(`File save failed: ${error.message}`);
  }
}


function getFileType(fileName) {
  const ext = fileName.split('.').pop()?.toLowerCase();
  
  const typeMap = {
    
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
    
    
    'html': 'html',
    'css': 'css',
    'scss': 'scss',
    'sass': 'sass',
    'vue': 'vue',
    
    
    'json': 'json',
    'xml': 'xml',
    'yaml': 'yaml',
    'yml': 'yaml',
    'toml': 'toml',
    'ini': 'ini',
    'env': 'env',
    
    
    'md': 'markdown',
    'txt': 'text',
    'rst': 'restructuredtext',
    
    
    'png': 'image',
    'jpg': 'image',
    'jpeg': 'image',
    'gif': 'image',
    'svg': 'image',
    'ico': 'image',
    
    
    'pdf': 'pdf',
    'zip': 'archive',
    'tar': 'archive',
    'gz': 'archive'
  };
  
  return typeMap[ext] || 'unknown';
}


async function cleanupTmpDir(tmpDir) {
  try {
    await fs.rm(tmpDir, { recursive: true, force: true });
    console.log(`🗑️  Cleaned up temp directory: ${tmpDir}`);
  } catch (error) {
    console.error('Failed to cleanup temp directory:', error);
    
  }
}


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
    
    const allFiles = await getAllSearchableFiles(tmpDir, includePatterns, excludePatterns);
    
    
    const searchPattern = createSearchPattern(searchQuery, { matchCase, matchWholeWord, useRegex });
    
    
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


async function getAllSearchableFiles(tmpDir, includePatterns, excludePatterns) {
  const files = [];
  
  async function scanDirectory(dir, relativePath = '') {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      await Promise.all(entries.map(async (entry) => {
        const fullPath = join(dir, entry.name);
        const relativeFilePath = join(relativePath, entry.name).replace(/\\/g, '/'); 
        
        
        if (excludePatterns.some(pattern => micromatch.isMatch(relativeFilePath, pattern))) {
          return;
        }
        
        if (entry.isDirectory()) {
          await scanDirectory(fullPath, relativeFilePath);
        } else {
          
          if (includePatterns.length === 0 || includePatterns.some(pattern => micromatch.isMatch(relativeFilePath, pattern))) {
            
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
    
    let escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    if (matchWholeWord) {
      escapedQuery = `\\b${escapedQuery}\\b`;
    }
    
    pattern = new RegExp(escapedQuery, flags);
  }
  
  return pattern;
}


async function searchInFile(fileInfo, pattern, { maxResults, contextLines, matchCase }) {
  const matches = [];
  
  
  if (fileInfo.size > 10 * 1024 * 1024) { 
    return matches;
  }
  
  try {
    const content = await fs.readFile(fileInfo.path, 'utf8');
    const lines = content.split('\n');
    
    lines.forEach((line, lineIndex) => {
      if (matches.length >= maxResults) return;
      
      const lineMatches = [];
      let match;
      
      
      pattern.lastIndex = 0;
      
      while ((match = pattern.exec(line)) !== null && lineMatches.length < 10) {
        const startCol = match.index;
        const endCol = match.index + match[0].length;
        
        lineMatches.push({
          text: match[0],
          startCol,
          endCol
        });
        
        
        if (match.index === pattern.lastIndex) {
          pattern.lastIndex++;
        }
      }
      
      if (lineMatches.length > 0) {
        const matchInfo = {
          line: lineIndex + 1, 
          content: line,
          matches: lineMatches,
          highlighted: highlightMatches(line, lineMatches)
        };
        
        
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
    
    throw new Error(`Cannot read file: ${error.message}`);
  }
  
  return matches;
}


function highlightMatches(line, matches) {
  if (!matches.length) return line;
  
  let highlighted = '';
  let lastIndex = 0;
  
  
  const sortedMatches = matches.sort((a, b) => a.startCol - b.startCol);
  
  sortedMatches.forEach(match => {
    
    highlighted += line.slice(lastIndex, match.startCol);
    
    
    highlighted += `<mark>${line.slice(match.startCol, match.endCol)}</mark>`;
    
    lastIndex = match.endCol;
  });
  
  
  highlighted += line.slice(lastIndex);
  
  return highlighted;
}


function isTextFile(fileName) {
  const textExtensions = [
    
    'js', 'jsx', 'ts', 'tsx', 'py', 'java', 'cpp', 'c', 'cs', 'php', 'rb', 'go', 'rs', 'sh', 'bash',
    
    'html', 'htm', 'css', 'scss', 'sass', 'vue', 'svelte',
    
    'json', 'xml', 'yaml', 'yml', 'toml', 'ini', 'env', 'config', 'conf',
    
    'md', 'txt', 'rst', 'adoc',
    
    'dockerfile', 'makefile', 'cmake',
    
    'log', 'sql', 'graphql', 'gql'
  ];
  
  const ext = fileName.split('.').pop()?.toLowerCase();
  return textExtensions.includes(ext) || !fileName.includes('.'); 
}


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


async function repackAsar(sourceDir, outputPath) {
  try {
    
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