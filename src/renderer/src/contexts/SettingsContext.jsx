// react context boilerplate
import React, { createContext, useContext, useState, useEffect } from 'react';

const STORAGE_KEY = 'spektros-settings';

// Map of user-friendly theme names to CSS file names
export const CODE_EDITOR_THEMES = {
  'GitHub Dark': 'github-dark',
  'GitHub Dark Dimmed': 'github-dark-dimmed',
  'GitHub Light': 'github-light',
  'Dracula': 'dracula',
  'Night Owl': 'night-owl',
  'Night Owl Light': 'night-owl-light',
  'VS Code Dark': 'vs-code-dark',
  'VS Code Light': 'vs-code-light',
  'Atom One Dark': 'atom-one-dark',
  'Prism': 'prism',
  'Prism Okaidia': 'prism-okaidia',
  'Prism Solarized Light': 'prism-solarized-light',
  'Prism Tomorrow': 'prism-tomorrow',
  'Prism Twilight': 'prism-twilight'
};

const SettingsContext = createContext();

const SettingsProvider = ({ children }) => {
  // Load settings from localStorage on mount
  const loadSettings = () => {
    try {
      const savedSettings = localStorage.getItem(STORAGE_KEY);
      return savedSettings ? JSON.parse(savedSettings) : {
        theme: 'tomorrow-night', // Default theme
        themeType: 'dark', // Default theme type
        codeFontSize: 'medium', // Default code editor font size
        uiFontSize: 'medium', // Default UI font size
        codeEditorTheme: 'GitHub Dark', // Default code editor theme
      };
    } catch (error) {
      console.error('Failed to load settings:', error);
      return {
        theme: 'tomorrow-night',
        themeType: 'dark',
        codeFontSize: 'medium',
        uiFontSize: 'medium',
        codeEditorTheme: 'GitHub Dark',
      };
    }
  };

  const [settings, setSettings] = useState(loadSettings);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [availableThemes, setAvailableThemes] = useState([]);

  // Load available themes on mount
  useEffect(() => {
    const loadThemes = async () => {
      try {
        const themes = await window.api.app.getThemes();
        setAvailableThemes(themes);
      } catch (error) {
        console.error('Failed to load themes:', error);
        setAvailableThemes([]);
      }
    };
    loadThemes();
  }, []);

  // Update theme type when theme changes
  useEffect(() => {
    const updateThemeType = async () => {
      try {
        const themeData = await window.api.app.loadTheme(settings.theme);
        setSettings(prev => ({
          ...prev,
          themeType: themeData.type
        }));
      } catch (error) {
        console.error('Failed to load theme type:', error);
      }
    };
    updateThemeType();
  }, [settings.theme]);

  // Save settings to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  }, [settings]);

  const toggleSettings = () => {
    setIsSettingsOpen(!isSettingsOpen);
  };

  const updateSettings = (newSettings) => {
    setSettings((prevSettings) => ({ ...prevSettings, ...newSettings }));
  };

  const value = {
    settings,
    isSettingsOpen,
    availableThemes,
    toggleSettings,
    updateSettings,
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};

const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};

export { SettingsProvider, useSettings };