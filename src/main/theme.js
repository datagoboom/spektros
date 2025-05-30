const { app, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// Theme management
const THEMES_DIR = process.platform === 'linux' 
  ? path.join(app.getPath('home'), '.config', 'spektros', 'themes')
  : path.join(__dirname, '../../themes');

// Ensure themes directory exists
if (!fs.existsSync(THEMES_DIR)) {
  fs.mkdirSync(THEMES_DIR, { recursive: true });
  
  // Copy default theme if it doesn't exist
  const defaultThemePath = path.join(THEMES_DIR, 'tomorrow-night.json');
  if (!fs.existsSync(defaultThemePath)) {
    const defaultTheme = {
      name: 'Tomorrow Night',
      id: 'tomorrow-night',
      palette: {
        primary: {
          main: '#6699CC',
        },
        secondary: {
          main: '#F2777A',
        },
        background: {
          default: '#1D1F21',
          nav: '#373B41',
          sidebar: '#44474D', 
          paper: '#282A2E',
          content: '#1D1F21',
        },
        text: {
          primary: '#C5C8C6',
          secondary: '#969896',
        },
        error: {
          main: '#CC6666',
        },
        warning: {
          main: '#F99157',
        },
        info: {
          main: '#81A2BE',
        },
        success: {
          main: '#B5BD68',
        },
        color: {
          red: '#F2777A',
          green: '#B5BD68',
          blue: '#81A2BE',
          cyan: '#8ABEB7',
          yellow: '#F99157',
          purple: '#B294BB',
          orange: '#DE935F',
          gray: '#969896',
          black: '#151719',
        }
      },
      typography: {
        fontFamily: 'Roboto, sans-serif',
      },
    };
    fs.writeFileSync(defaultThemePath, JSON.stringify(defaultTheme, null, 2));
  }
}

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