import React from 'react';
import { AppBar, Toolbar, Box } from '@mui/material';
import { useTheme } from '../../theme';

export default function UtilityBar({ children }) {
  const theme = useTheme();
  
  return (
    <AppBar 
      position="static" 
      elevation={0}
      sx={{ 
        backgroundColor: theme.palette.background.content,
        borderBottom: 1,
        borderColor: theme.palette.background.nav,
        height: '64px',
        minHeight: '64px'
      }}
    >
      <Toolbar 
        variant="dense" 
        sx={{ 
          minHeight: '64px !important',
          padding: '0 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {children}
        </Box>
      </Toolbar>
    </AppBar>
  );
}