const { app, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// Always use a writable directory outside the ASAR archive
const THEMES_DIR = path.join(app.getPath('userData'), 'themes');
// Path to packaged themes (inside ASAR or unpacked dir)
const PACKAGED_THEMES_DIR = path.join(__dirname, '..', '..', 'data', 'themes');

// Helper to copy all themes from packaged dir to user dir
function copyPackagedThemesIfNeeded() {
  if (!fs.existsSync(THEMES_DIR)) {
    fs.mkdirSync(THEMES_DIR, { recursive: true });
  }
  // Copy each theme if it doesn't exist in user dir
  if (fs.existsSync(PACKAGED_THEMES_DIR)) {
    const files = fs.readdirSync(PACKAGED_THEMES_DIR);
    for (const file of files) {
      if (file.endsWith('.json')) {
        const src = path.join(PACKAGED_THEMES_DIR, file);
        const dest = path.join(THEMES_DIR, file);
        if (!fs.existsSync(dest)) {
          fs.copyFileSync(src, dest);
        }
      }
    }
  }
}

// Call this on startup
copyPackagedThemesIfNeeded();

// Get list of available themes
ipcMain.handle('app:getThemes', async () => {
  try {
    const files = fs.readdirSync(THEMES_DIR);
    const themes = [];
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        const themePath = path.join(THEMES_DIR, file);
        const themeData = JSON.parse(fs.readFileSync(themePath, 'utf8'));
        themes.push({
          id: path.basename(file, '.json'),
          name: themeData.name,
          path: themePath
        });
      }
    }
    
    return themes;
  } catch (error) {
    console.error('Failed to get themes:', error);
    throw error;
  }
});

// Load a specific theme
ipcMain.handle('app:loadTheme', async (event, themeId) => {
  try {
    const themePath = path.join(THEMES_DIR, `${themeId}.json`);
    if (!fs.existsSync(themePath)) {
      throw new Error(`Theme ${themeId} not found`);
    }
    
    const themeData = JSON.parse(fs.readFileSync(themePath, 'utf8'));
    return themeData;
  } catch (error) {
    console.error('Failed to load theme:', error);
    throw error;
  }
}); 