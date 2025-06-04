import {
  FileUpload,
  Save,
  Download
} from '@mui/icons-material';

import { Container, Divider } from '@mui/material';
import UtilityBarItem from '../common/UtilityBarItem';
import { useTheme } from '../../theme';
import { useState } from 'react';
import { useCodeEditor } from '../../contexts/CodeEditorContext';
import { useApi } from '../../contexts/ApiContext';
import { useAnalysis } from '../../contexts/AnalysisContext';

export default function UtilityBarConfig() {
  const theme = useTheme();
  const [hasOpenFile, setHasOpenFile] = useState(false);
  const { getFocusedFileState, FILE_STATE, saveFile, getFocusedFilePath, getFileContent } = useCodeEditor();
  const { openFileDialog, saveFileDialog, loadAsar, isLoading, repackAsar } = useApi();
  const { initializeAnalysis, updateFileTree, tmpDir } = useAnalysis();

  const handleOpenFile = async () => {
    try {
      
      const filePath = await openFileDialog({
        filters: [
          { name: 'ASAR Files', extensions: ['asar'] }
        ]
      });

      if (!filePath) {
        console.log('File selection canceled');
        return;
      }

      console.log('Selected ASAR file:', filePath);
      
      
      const result = await loadAsar(filePath);
      console.log('ASAR extracted to:', result.tmpDir);
      
      
      await initializeAnalysis(result.tmpDir);
      
      
      if (result.tree) {
        updateFileTree(result.tree);
      }
      
      setHasOpenFile(true);
    } catch (err) {
      console.error('Failed to open ASAR:', err);
      
    }
  };

  const handleExport = async () => {
    if (!tmpDir) {
      console.log('No ASAR file is currently loaded');
      return;
    }

    try {
      
      const result = await saveFileDialog({
        filters: [
          { name: 'ASAR Files', extensions: ['asar'] }
        ]
      });

      if (!result || !result.filePath) {
        console.log('Export canceled');
        return;
      }

      
      const repackResult = await repackAsar(tmpDir, result.filePath);
      
      if (repackResult.success) {
        console.log('Successfully repacked ASAR to:', result.filePath);
      } else {
        throw new Error(repackResult.error || 'Failed to repack ASAR');
      }
    } catch (err) {
      console.error('Failed to export ASAR:', err);
    }
  };

  const handleSave = async () => {
    const filePath = getFocusedFilePath();
    if (filePath) {
      try {
        
        const content = getFileContent(filePath);
        
        
        await saveFile(filePath, content);
        
        
        saveFile(filePath);
        
        console.log(`💾 Saved file: ${filePath}`);
      } catch (err) {
        console.error('Failed to save file:', err);
      }
    }
  };

  const hasUnsavedChanges = () => {
    return getFocusedFileState() === FILE_STATE.UNSAVED;
  };

  return (
    <Container
      maxWidth={false}
      disableGutters
      id="analysis-utility-bar"
      sx={{
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'flex-start',
        alignItems: 'center',
        height: '64px',
        width: '100%',
      }}
    >
      <UtilityBarItem
        title="Open ASAR"
        icon={<FileUpload fontSize='large'/>}
        onClick={handleOpenFile}
        iconColor={theme.palette.color.cyan}
        disabled={isLoading}
      />
      <UtilityBarItem
        title="Export ASAR"
        icon={<Download fontSize='large' />}
        onClick={handleExport}
        iconColor={theme.palette.color.cyan}
        disabled={!hasOpenFile}
      />
      <Divider
        orientation="vertical"
        flexItem
        sx={{ borderWidth: 1.5, backgroundColor: theme.palette.text.secondary, height: '60px', opacity: 0.25 }}
      />
      <UtilityBarItem
        title="Save File"
        icon={<Save fontSize='large' />}
        onClick={handleSave}
        iconColor={theme.palette.color.purple}
        disabled={!hasUnsavedChanges()}
      />
    </Container>
  );
}