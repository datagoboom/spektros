import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Container from '@mui/material/Container';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';

import SettingsIcon from '@mui/icons-material/Settings';
import AnalyticsIcon from '@mui/icons-material/Troubleshoot';
import HistoryIcon from '@mui/icons-material/History';
import InjectorIcon from '@mui/icons-material/Vaccines';

import { useHistory } from '../../contexts/HistoryContext';
import { useTheme } from '../../theme';

export default function Sidebar(props) {
  const theme = useTheme();
  const { addToBrowserHistory } = useHistory();
  const navigate = useNavigate();
  const location = useLocation();
  
  useEffect(() => {
    let path = location.pathname;

    if (path === '/') {
      path = '/analysis';
    }
    
    addToBrowserHistory(path);
  }, [location.pathname]);

  const pages = [
    { name: 'Analysis', slug: '/analysis', icon: <AnalyticsIcon fontSize='large' /> },
    { name: 'Injector', slug: '/injector', icon: <InjectorIcon  fontSize='large'/> },
    { name: 'History', slug: '/history', icon: <HistoryIcon fontSize='large' /> },
    { name: 'Settings', slug: '/settings', icon: <SettingsIcon  fontSize='large'/> },
  ];

  const handlePageChange = (page) => {
    console.log(page);
    navigate(page);
  }

  return (
    <Container 
      maxWidth={false}
      disableGutters
      sx={{
        backgroundColor: theme.palette.background.sidebar,
        width: '54px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        alignItems: 'center',
        height: '100vh',
        borderRight: `1px solid ${theme.palette.text.secondary}`,
        padding: 0
      }}
      id="sidebar"
    >
      <List sx={{width: '100%'}}>
        {pages.map((page) => (
          <ListItem key={page.name} disablePadding sx={{ mb: 5 }}>
            <ListItemButton
              to={page.path}
              selected={location.pathname === page.slug}
              onClick={() => handlePageChange(page.slug)}
            >
              <ListItemIcon
                sx={{ color: theme.palette.text.primary, minWidth: 0, justifyContent: 'center', mb: 0.5, width: '100%' }}
              >
                {page.icon}
              </ListItemIcon>
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Container>
  );
}