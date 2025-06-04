import React, { useState, useEffect } from 'react';
import { Container, Box, IconButton, Typography } from '@mui/material';
import {Panel, PanelGroup, PanelResizeHandle} from 'react-resizable-panels';
import CloseIcon from '@mui/icons-material/Close';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import { useTheme } from '../theme';
import { js as beautifyJs } from 'js-beautify';


import FileTree from '../components/analysis/FileTree';
import CodeEditor from '../components/analysis/CodeEditor';
import SearchTools from '../components/analysis/SearchTools';
import UtilityBar from '../components/common/UtilityBar';
import AnalysisBar from '../components/analysis/UtilityBarConfig';
import { useCodeEditor } from '../contexts/CodeEditorContext';
import { useApi } from '../contexts/ApiContext';
import { useAnalysis } from '../contexts/AnalysisContext';

const TABS_STORAGE_KEY = 'analysis-open-tabs';


const EDITABLE_FILE_TYPES = [
  
  'javascript', 'typescript', 'python', 'java', 'cpp', 'c', 'csharp', 
  'php', 'ruby', 'go', 'rust', 'bash',
  
  'html', 'css', 'scss', 'sass', 'vue',
  
  'json', 'xml', 'yaml', 'toml', 'ini', 'env',
  
  'markdown', 'text', 'restructuredtext'
];


const BEAUTIFY_FILE_TYPES = {
  'javascript': true,
  'html': true,
  'css': true
};


const JS_EXTENSIONS = ['js', 'cjs', 'mjs'];


const SHELL_EXTENSIONS = ['sh', 'bash'];


const saveOpenTabs = (openFiles, selectedTab, focusedPath) => {
  try {
    const tabData = {
      openFiles: openFiles.map(file => ({
        name: file.name,
        path: file.path,
        content: file.content
      })),
      selectedTab,
      focusedPath,
      timestamp: Date.now()
    };
    localStorage.setItem(TABS_STORAGE_KEY, JSON.stringify(tabData));
    console.log(`💾 Saved ${openFiles.length} open tabs`);
  } catch (error) {
    console.error('Failed to save open tabs:', error);
  }
};


const loadOpenTabs = () => {
  try {
    const saved = localStorage.getItem(TABS_STORAGE_KEY);
    if (!saved) return null;
    
    const tabData = JSON.parse(saved);
    console.log(`📂 Loaded ${tabData.openFiles?.length || 0} tabs from storage`);
    return tabData;
  } catch (error) {
    console.error('Failed to load open tabs:', error);
    return null;
  }
};

export default function Analysis() {
  const theme = useTheme();
  const [selectedFile, setSelectedFile] = useState(null);
  const [openFiles, setOpenFiles] = useState([]);
  const [fileTab, setFileTab] = useState(0);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [fileError, setFileError] = useState(null);
  
  const { 
    getFileState, 
    setFocusedFilePath, 
    removeFile,
    hasUnsavedChanges,
    getFocusedFileState,
    getFocusedFilePath,
    getAllTrackedFiles,
    getFileContent,
    FILE_STATE 
  } = useCodeEditor();

  const { getFileContent: apiGetFileContent } = useApi();
  const { fileTree, isLoading: isAnalysisLoading } = useAnalysis();

  
  useEffect(() => {
    if (!hasInitialized) {
      const savedTabs = loadOpenTabs();
      
      if (savedTabs && savedTabs.openFiles && savedTabs.openFiles.length > 0) {
        console.log('🔄 Restoring tabs:', savedTabs.openFiles.map(f => f.path));
        
        
        const restoredFiles = savedTabs.openFiles.map(file => ({
          ...file,
          content: getFileContent(file.path) || file.content
        }));
        
        setOpenFiles(restoredFiles);
        setFileTab(savedTabs.selectedTab || 0);
        
        
        const selectedIndex = Math.min(savedTabs.selectedTab || 0, restoredFiles.length - 1);
        setSelectedFile(restoredFiles[selectedIndex]);
        setFocusedFilePath(restoredFiles[selectedIndex].path);
      }
      
      setHasInitialized(true);
    }
  }, [hasInitialized, getFileContent, setFocusedFilePath]);

  
  useEffect(() => {
    if (hasInitialized && openFiles.length > 0) {
      saveOpenTabs(openFiles, fileTab, getFocusedFilePath());
    }
  }, [openFiles, fileTab, hasInitialized, getFocusedFilePath]);

  const beautifyContent = (content, fileType, fileName) => {
    
    if (!BEAUTIFY_FILE_TYPES[fileType]) {
      return content;
    }

    try {
      
      if (fileType === 'javascript') {
        return beautifyJs(content, {
          indent_size: 2,
          space_in_empty_paren: true,
          preserve_newlines: true,
          max_preserve_newlines: 2,
          keep_array_indentation: true,
          break_chained_methods: true,
          indent_scripts: 'normal',
          unescape_strings: false,
          jslint_happy: false,
          end_with_newline: true,
          wrap_line_length: 0,
          indent_inner_html: true,
          comma_first: false,
          e4x: false,
          indent_empty_lines: false
        });
      }

      
      if (fileType === 'html') {
        return beautifyJs.html(content, {
          indent_size: 2,
          indent_char: ' ',
          max_preserve_newlines: 2,
          preserve_newlines: true,
          keep_array_indentation: false,
          break_chained_methods: false,
          indent_scripts: 'normal',
          brace_style: 'collapse',
          space_before_conditional: true,
          unescape_strings: false,
          jslint_happy: false,
          end_with_newline: true,
          wrap_line_length: 0,
          indent_inner_html: false,
          comma_first: false,
          e4x: false,
          indent_empty_lines: false
        });
      }

      
      if (fileType === 'css') {
        return beautifyJs.css(content, {
          indent_size: 2,
          indent_char: ' ',
          max_preserve_newlines: 2,
          preserve_newlines: true,
          keep_array_indentation: false,
          break_chained_methods: false,
          indent_scripts: 'normal',
          brace_style: 'collapse',
          space_before_conditional: true,
          unescape_strings: false,
          jslint_happy: false,
          end_with_newline: true,
          wrap_line_length: 0,
          indent_inner_html: false,
          comma_first: false,
          e4x: false,
          indent_empty_lines: false
        });
      }

      return content;
    } catch (error) {
      console.error('Beautification failed:', error);
      return content; 
    }
  };

  const handleFileSelect = async (filePath) => {
    console.log('Analysis: handleFileSelect called with path:', filePath);
    setFileError(null);
    
    
    const existingFileIndex = openFiles.findIndex(f => f.path === filePath);
    console.log('Existing file index:', existingFileIndex);
    
    if (existingFileIndex !== -1) {
      console.log('File already open, switching to tab:', existingFileIndex);
      setFileTab(existingFileIndex);
      setSelectedFile(openFiles[existingFileIndex]);
      setFocusedFilePath(filePath);
      return;
    }

    try {
      
      const fileInfo = fileTree.find(f => f.path === filePath);
      if (!fileInfo) {
        throw new Error('File not found in file tree');
      }

      
      const extension = filePath.split('.').pop().toLowerCase();
      
      
      let fileType = fileInfo.type;
      if (JS_EXTENSIONS.includes(extension)) {
        fileType = 'javascript';
      } else if (SHELL_EXTENSIONS.includes(extension)) {
        fileType = 'bash';
      }

      console.log('File type determined:', fileType);

      
      if (!EDITABLE_FILE_TYPES.includes(fileType)) {
        setFileError(`Cannot open ${fileType} files in the editor`);
        console.log('File type not supported:', fileType);
        return;
      }

      
      console.log('Fetching file content from API:', filePath);
      const content = await apiGetFileContent(filePath);
      console.log('File content received:', !!content);
      
      if (!content) {
        console.log('No content received for file:', filePath);
        return;
      }

      
      const beautifiedContent = beautifyContent(content, fileType, filePath);
      console.log('Content beautified:', content !== beautifiedContent);

      const newFile = {
        name: filePath.split('/').pop(),
        path: filePath,
        content: beautifiedContent,
        type: fileType,
        originalContent: content 
      };
      console.log('Creating new file object:', newFile);

      setSelectedFile(newFile);
      setOpenFiles([...openFiles, newFile]);
      setFileTab(openFiles.length);
      setFocusedFilePath(filePath);
    } catch (error) {
      console.error('Failed to get file content:', error);
      setFileError(error.message);
    }
  };

  const handleTabChange = (index) => {
    setFileTab(index);
    setSelectedFile(openFiles[index]);
    setFocusedFilePath(openFiles[index].path);
  };

  const handleCloseTab = (event, index) => {
    event.stopPropagation();
    const fileToClose = openFiles[index];
    
    console.log(`🚪 Closing tab: ${fileToClose.path}`);
    
    
    removeFile(fileToClose.path);
    
    const newOpenFiles = openFiles.filter((_, i) => i !== index);
    setOpenFiles(newOpenFiles);
    
    if (newOpenFiles.length === 0) {
      setSelectedFile(null);
      setFileTab(0);
      setFocusedFilePath(null);
      
      localStorage.removeItem(TABS_STORAGE_KEY);
    } else if (index <= fileTab) {
      const newTabIndex = Math.max(0, fileTab - 1);
      setFileTab(newTabIndex);
      setSelectedFile(newOpenFiles[newTabIndex]);
      setFocusedFilePath(newOpenFiles[newTabIndex].path);
    }
  };

  const getTabIndicator = (filePath) => {
    const fileState = getFileState(filePath);
    
    switch (fileState) {
      case FILE_STATE.UNSAVED:
        return (
          <FiberManualRecordIcon 
            sx={{ 
              fontSize: 8, 
              color: theme.palette.warning.main,
              ml: 0.5
            }} 
          />
        );
      case FILE_STATE.SAVED:
        return (
          <FiberManualRecordIcon 
            sx={{ 
              fontSize: 8, 
              color: theme.palette.success.main,
              ml: 0.5
            }} 
          />
        );
      default:
        return null;
    }
  };

  const getTabTextColor = (filePath) => {
    const fileState = getFileState(filePath);
    
    switch (fileState) {
      case FILE_STATE.UNCHANGED:
        return theme.palette.text.secondary; 
      case FILE_STATE.UNSAVED:
        return theme.palette.warning.main; 
      case FILE_STATE.SAVED:
        return theme.palette.success.main; 
      default:
        return theme.palette.text.secondary; 
    }
  };

  return (
    <Container
      maxWidth={false}
      disableGutters
      id="analysis-main"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        backgroundColor: theme.palette.background.default,
        overflow: 'hidden'
      }}
    >
      <UtilityBar>
        <AnalysisBar />
      </UtilityBar>
      <Box sx={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        <PanelGroup direction="horizontal">
          <Panel 
            defaultSize={20} 
            minSize={10} 
            maxSize={30}
          >
            <FileTree onFileSelect={handleFileSelect} />
          </Panel>
          <PanelResizeHandle style={{
            width: 10,
            backgroundColor: theme.palette.background.nav,
          }}/>
          <Panel minSize={30}>
            <Box sx={{ 
              width: '100%', 
              height: '100%',
              display: 'flex', 
              flexDirection: 'column',
              overflow: 'hidden'
            }}>
              {openFiles.length > 0 && (
                <Box 
                  sx={{ 
                    display: 'flex',
                    alignItems: 'center',
                    borderBottom: 1,
                    borderColor: theme.palette.background.nav,
                    backgroundColor: theme.palette.background.paper,
                    height: '35px',
                    minHeight: '35px',
                    overflowX: 'auto',
                    '&::-webkit-scrollbar': {
                      height: '4px',
                    },
                    '&::-webkit-scrollbar-thumb': {
                      backgroundColor: theme.palette.text.secondary,
                      borderRadius: '4px',
                    },
                  }}
                >
                  {openFiles.map((file, index) => (
                    <Box
                      key={index}
                      onClick={() => handleTabChange(index)}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '0 8px',
                        height: '100%',
                        minWidth: '120px',
                        maxWidth: '200px',
                        borderRight: 1,
                        borderColor: theme.palette.background.nav,
                        backgroundColor: fileTab === index ? theme.palette.background.content : 'transparent',
                        cursor: 'pointer',
                        '&:hover': {
                          backgroundColor: fileTab === index 
                            ? theme.palette.background.content 
                            : theme.palette.background.sidebar,
                        },
                      }}
                    >
                      <InsertDriveFileIcon sx={{ 
                        fontSize: 16, 
                        mr: 1, 
                        color: theme.palette.text.secondary 
                      }} />
                      <Box
                        sx={{
                          flexGrow: 1,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          fontSize: '13px',
                          color: getTabTextColor(file.path),
                          display: 'flex',
                          alignItems: 'center',
                          gap: 0.5,
                        }}
                      >
                        {file.name}
                        {getTabIndicator(file.path)}
                      </Box>
                      <IconButton
                        size="small"
                        onClick={(e) => handleCloseTab(e, index)}
                        sx={{
                          padding: '2px',
                          color: theme.palette.text.secondary,
                          '&:hover': {
                            backgroundColor: theme.palette.background.sidebar,
                            color: theme.palette.text.primary,
                          },
                        }}
                      >
                        <CloseIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Box>
                  ))}
                </Box>
              )}
              <Box sx={{ flex: 1, overflow: 'hidden' }}>
                {fileError ? (
                  <Box
                    sx={{
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      alignItems: 'center',
                      backgroundColor: theme.palette.background.paper,
                      color: theme.palette.error.main,
                    }}
                  >
                    <Typography variant="body1">
                      {fileError}
                    </Typography>
                  </Box>
                ) : selectedFile ? (
                  <CodeEditor key={selectedFile.path} file={selectedFile} />
                ) : (
                  <Box
                    sx={{
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      alignItems: 'center',
                      backgroundColor: theme.palette.background.paper,
                      color: theme.palette.text.secondary,
                    }}
                  >
                    <Typography variant="body1">
                      Please open a file to begin editing or create a new file
                    </Typography>
                  </Box>
                )}
              </Box>
            </Box>
          </Panel>
          <PanelResizeHandle style={{
            width: 10,
            backgroundColor: theme.palette.background.nav,
          }}/>
          <Panel 
            defaultSize={30} 
            minSize={20}
            maxSize={50}
          >
            <SearchTools />
          </Panel>
        </PanelGroup>
      </Box>
    </Container>
  );
}