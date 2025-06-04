import { createTheme } from '@mui/material/styles';
import { useSettings } from './contexts/SettingsContext';
import React from 'react';


const defaultTheme = {
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


export function useTheme() {
    const { settings } = useSettings();
    const [themeData, setThemeData] = React.useState(defaultTheme);

    React.useEffect(() => {
        const loadTheme = async () => {
            try {
                const theme = await window.api.app.loadTheme(settings.theme);
                setThemeData(theme);
            } catch (error) {
                console.error('Failed to load theme:', error);
                setThemeData(defaultTheme);
            }
        };
        loadTheme();
    }, [settings.theme]);

    return createTheme(themeData);
}


export const theme = createTheme(defaultTheme);


export default theme;