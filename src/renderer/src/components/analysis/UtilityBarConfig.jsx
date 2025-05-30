import {
  Archive,
  FileUpload,
  Unarchive,
  NoteAdd,
  Save
} from '@mui/icons-material';

import { Container, Divider} from '@mui/material';
import UtilityBarItem from '../common/UtilityBarItem';
import { useTheme } from '../../theme';
import { useState } from 'react';
import { useCodeEditor } from '../../contexts/CodeEditorContext';
import { useApi } from '../../contexts/ApiContext';
import { useAnalysis } from '../../contexts/AnalysisContext';

export default function UtilityBarConfig({ onOpenFile }) {
  const theme = useTheme();
  const [hasOpenFile, setHasOpenFile] = useState(false);
  const { getFocusedFileState, FILE_STATE, saveFile, getFocusedFilePath } = useCodeEditor();
  const { openFileDialog, loadAsar, isLoading, error } = useApi();
  const { initializeAnalysis, updateFileTree } = useAnalysis();

  const handleOpenFile = async () => {
    try {
      // Open file dialog to select ASAR file
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
      
      // Extract ASAR and build file tree
      const result = await loadAsar(filePath);
      console.log('ASAR extracted to:', result.tmpDir);
      
      // Initialize analysis context with the new temp directory
      await initializeAnalysis(result.tmpDir);
      
      // Update the file tree in analysis context
      if (result.tree) {
        updateFileTree(result.tree);
      }
      
      setHasOpenFile(true);
    } catch (err) {
      console.error('Failed to open ASAR:', err);
      // Error is already handled by ApiContext
    }
  };

  const handleSave = () => {
    const filePath = getFocusedFilePath();
    if (filePath) {
      saveFile(filePath);
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
        title="Open File"
        icon={<FileUpload fontSize='large'/>}
        onClick={handleOpenFile}
        iconColor={theme.palette.color.cyan}
        disabled={isLoading}
      />
      <UtilityBarItem
        title="Repack ASAR"
        icon={<Archive fontSize='large' />}
        onClick={() => console.log('Archive button clicked')}
        iconColor={theme.palette.color.cyan}
        disabled={!hasOpenFile}
      />
      <Divider
        orientation="vertical"
        flexItem
        sx={{ borderWidth: 1.5, backgroundColor: theme.palette.text.secondary, height: '60px', opacity: 0.25 }}
      />
      <UtilityBarItem
        title="New File"
        icon={<NoteAdd fontSize='large' />}
        onClick={() => console.log('NewFile button clicked')}
        iconColor={theme.palette.color.purple}
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