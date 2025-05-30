import React, { useEffect } from 'react';
import { Container, Typography, Box, FormControl, InputLabel, Select, MenuItem, Divider } from '@mui/material';
import { useSettings, CODE_EDITOR_THEMES } from '../contexts/SettingsContext';
import { useTheme } from '../theme';

export default function Settings() {
  const { settings, updateSettings, availableThemes } = useSettings();
  const theme = useTheme();

  useEffect(() => {
    console.log('Current settings:', settings);
    console.log('Available code editor themes:', Object.keys(CODE_EDITOR_THEMES));
  }, [settings]);

  const handleThemeChange = (event) => {
    updateSettings({ theme: event.target.value });
  };

  const handleCodeEditorThemeChange = (event) => {
    console.log('Changing code editor theme to:', event.target.value);
    updateSettings({ codeEditorTheme: event.target.value });
  };

  const handleCodeFontSizeChange = (event) => {
    updateSettings({ codeFontSize: event.target.value });
  };

  const handleUiFontSizeChange = (event) => {
    updateSettings({ uiFontSize: event.target.value });
  };

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Settings
      </Typography>
      
      <Box sx={{ mt: 4 }}>
        <Typography variant="h6" gutterBottom>
          Appearance
        </Typography>
        
        <FormControl fullWidth sx={{ mb: 3 }}>
          <InputLabel>Theme</InputLabel>
          <Select
            value={settings.theme}
            label="Theme"
            onChange={handleThemeChange}
          >
            {availableThemes.map((theme) => (
              <MenuItem key={theme.id} value={theme.id}>
                {theme.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl fullWidth sx={{ mb: 3 }}>
          <InputLabel>Code Editor Theme</InputLabel>
          <Select
            value={settings.codeEditorTheme || 'GitHub Dark'}
            label="Code Editor Theme"
            onChange={handleCodeEditorThemeChange}
          >
            {Object.keys(CODE_EDITOR_THEMES).map((themeName) => (
              <MenuItem key={themeName} value={themeName}>
                {themeName}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Divider sx={{ my: 3 }} />

        <Typography variant="h6" gutterBottom>
          Font Sizes
        </Typography>

        <FormControl fullWidth sx={{ mb: 3 }}>
          <InputLabel>Code Editor Font Size</InputLabel>
          <Select
            value={settings.codeFontSize}
            label="Code Editor Font Size"
            onChange={handleCodeFontSizeChange}
          >
            <MenuItem value="small">Small</MenuItem>
            <MenuItem value="medium">Medium</MenuItem>
            <MenuItem value="large">Large</MenuItem>
          </Select>
        </FormControl>

        <FormControl fullWidth sx={{ mb: 3 }}>
          <InputLabel>UI Font Size</InputLabel>
          <Select
            value={settings.uiFontSize}
            label="UI Font Size"
            onChange={handleUiFontSizeChange}
          >
            <MenuItem value="small">Small</MenuItem>
            <MenuItem value="medium">Medium</MenuItem>
            <MenuItem value="large">Large</MenuItem>
          </Select>
        </FormControl>
      </Box>
    </Container>
  );
} 