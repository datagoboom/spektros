import React, { useEffect, useState, useRef } from 'react';
import { Editor } from "prism-react-editor";
import { loadTheme } from "prism-react-editor/themes";
import { BasicSetup } from "prism-react-editor/setups";
import { useCodeEditor } from '../../contexts/CodeEditorContext';
import { useApi } from '../../contexts/ApiContext';
import { Box } from '@mui/material';
import { useTheme } from '../../theme';
import { useSettings, CODE_EDITOR_THEMES } from '../../contexts/SettingsContext';


import "prism-react-editor/layout.css";
import "prism-react-editor/scrollbar.css";
import "prism-react-editor/search.css";


import "prism-react-editor/themes/github-dark.css";
import "prism-react-editor/themes/github-dark-dimmed.css";
import "prism-react-editor/themes/github-light.css";
import "prism-react-editor/themes/dracula.css";
import "prism-react-editor/themes/night-owl.css";
import "prism-react-editor/themes/night-owl-light.css";
import "prism-react-editor/themes/vs-code-dark.css";
import "prism-react-editor/themes/vs-code-light.css";
import "prism-react-editor/themes/atom-one-dark.css";
import "prism-react-editor/themes/prism.css";
import "prism-react-editor/themes/prism-okaidia.css";
import "prism-react-editor/themes/prism-solarized-light.css";
import "prism-react-editor/themes/prism-tomorrow.css";
import "prism-react-editor/themes/prism-twilight.css";


import "prism-react-editor/prism/languages/jsx";

import "prism-react-editor/languages/jsx";


import "prism-react-editor/prism/languages/bash";
import "prism-react-editor/prism/languages/markdown";
import "prism-react-editor/prism/languages/json";


import "prism-react-editor/languages/bash";
import "prism-react-editor/languages/json";

const getLanguageFromExtension = (filename) => {
  const extension = filename.split('.').pop().toLowerCase();
  switch (extension) {
    case 'js':
    case 'jsx':
      return 'jsx';
    case 'ts':
    case 'tsx':
      return 'typescript';
    case 'html':
      return 'html';
    case 'css':
      return 'css';
    case 'json':
      return 'json';
    case 'md':
      return 'markdown';
    case 'sh':
      return 'bash';
    default:
      return 'plaintext';
  }
};

export default function CodeEditor({ file }) {
  const { 
    initializeFile, 
    updateFileContent, 
    getFileContent,
    isFileTracked
  } = useCodeEditor();
  const { saveFile } = useApi();
  const theme = useTheme();
  const [editorTheme, setEditorTheme] = useState(null);
  const [language, setLanguage] = useState('plaintext');
  const [initialContent, setInitialContent] = useState('');
  const [isReady, setIsReady] = useState(false);
  const { settings } = useSettings();
  const styleRef = useRef(null);

  
  useEffect(() => {
    let mounted = true;

    const loadAndApplyTheme = async () => {
      try {
        const themeId = CODE_EDITOR_THEMES[settings.codeEditorTheme] || 'github-dark';
        
        
        const [themeCSS, themeObject] = await Promise.all([
          loadTheme(themeId),
          loadTheme(themeId)
        ]);

        if (!mounted) return;

        if (!themeCSS) {
          throw new Error(`Theme ${themeId} not found`);
        }

        
        if (styleRef.current && styleRef.current.parentNode) {
          styleRef.current.parentNode.removeChild(styleRef.current);
        }

        
        const style = document.createElement('style');
        style.textContent = themeCSS;
        document.head.appendChild(style);
        styleRef.current = style;

        
        setEditorTheme(themeObject);
      } catch (error) {
        console.error('Failed to load theme:', error);
        if (!mounted) return;
        
        
        const defaultTheme = await loadTheme('github-dark');
        if (mounted) {
          setEditorTheme(defaultTheme);
        }
      }
    };

    loadAndApplyTheme();

    
    return () => {
      mounted = false;
      if (styleRef.current && styleRef.current.parentNode) {
        styleRef.current.parentNode.removeChild(styleRef.current);
      }
    };
  }, [settings.codeEditorTheme]);

  
  useEffect(() => {
    let mounted = true;

    const loadFile = async () => {
      if (!file) {
        setIsReady(false);
        return;
      }

      setIsReady(false);

      try {
        
        setLanguage(getLanguageFromExtension(file.name));

        
        if (!isFileTracked(file.path)) {
          await initializeFile(file.path, file.content);
          if (mounted) {
            setInitialContent(file.content);
          }
        } else {
          
          const currentContent = getFileContent(file.path);
          if (mounted) {
            setInitialContent(currentContent);
          }
        }

        if (mounted) {
          setIsReady(true);
        }
      } catch (error) {
        console.error('Failed to load file:', error);
        if (mounted) {
          setIsReady(false);
        }
      }
    };

    loadFile();

    return () => {
      mounted = false;
    };
  }, [file?.path]);

  
  const handleChange = async (value) => {
    if (file && isReady) {
      try {
        
        await updateFileContent(file.path, value);
        
        
        await saveFile(file.path, value);
        
        console.log(`✏️  Content changed and saved for ${file.path}: ${value.length} chars`);
      } catch (error) {
        console.error('Failed to update file content:', error);
      }
    }
  };

  if (!file) {
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100%',
        color: theme.palette.text.secondary,
        backgroundColor: 'transparent'
      }}>
        No file selected
      </Box>
    );
  }

  if (!isReady || !editorTheme) {
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100%',
        color: theme.palette.text.secondary,
        backgroundColor: 'transparent'
      }}>
        Loading {file.name}...
      </Box>
    );
  }

  return (
    <Box sx={{
      height: '100%',
      width: '100%',
      opacity: 0.90,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      '& .prism-editor': {
        flex: 1,
        overflow: 'auto',
        '&::-webkit-scrollbar': {
          width: '8px',
          height: '8px',
        },
        '&::-webkit-scrollbar-track': {
          backgroundColor: theme.palette.background.paper,
        },
        '&::-webkit-scrollbar-thumb': {
          backgroundColor: theme.palette.text.secondary,
          borderRadius: '4px',
          '&:hover': {
            backgroundColor: theme.palette.text.primary,
          },
        },
      }
    }}>
      <Editor
        key={`${file?.path}-${settings.codeEditorTheme}`}
        style={{
          fontSize: '14px',
          lineHeight: '1.5',
          fontFamily: 'monospace',
          height: '100%',
          width: '100%'
        }}
        language={language}
        value={initialContent}
        onUpdate={handleChange}
        theme={editorTheme}
        tabSize={2}
        insertSpaces={true}
        lineNumbers={true}
        wordWrap={false}
      >
        {editor => <BasicSetup editor={editor} />}
      </Editor>
    </Box>
  );
}