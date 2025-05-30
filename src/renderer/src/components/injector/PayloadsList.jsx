import React, { useState, useEffect } from 'react';
import {
  Box,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemButton,
  Typography,
  IconButton,
  Collapse,
  Divider,
  Tooltip,
  CircularProgress
} from '@mui/material';
import {
  Code as CodeIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  PlayArrow as InjectIcon,
  Delete as DeleteIcon,
  Folder as FolderIcon
} from '@mui/icons-material';
import theme from '../../theme';
import { useApi } from '../../contexts/ApiContext';

export default function PayloadsList({ asarPath, onInject }) {
  const { listPayloads } = useApi();
  const [payloads, setPayloads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedCategories, setExpandedCategories] = useState({});

  useEffect(() => {
    loadPayloads();
  }, []);

  const loadPayloads = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await listPayloads();
      if (result.success) {
        setPayloads(result.payloads);
        // Expand all categories by default
        const categories = {};
        result.payloads.forEach(payload => {
          categories[payload.category] = true;
        });
        setExpandedCategories(categories);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleCategory = (category) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  const handleInject = (payload) => {
    if (!asarPath) {
      setError('Please select an ASAR file first');
      return;
    }
    onInject(payload);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography color="error">{error}</Typography>
      </Box>
    );
  }

  // Group payloads by category
  const groupedPayloads = payloads.reduce((acc, payload) => {
    if (!acc[payload.category]) {
      acc[payload.category] = [];
    }
    acc[payload.category].push(payload);
    return acc;
  }, {});

  return (
    <List sx={{ width: '100%', bgcolor: 'background.paper' }}>
      {Object.entries(groupedPayloads).map(([category, categoryPayloads]) => (
        <React.Fragment key={category}>
          <ListItem
            disablePadding
            sx={{
              backgroundColor: theme.palette.background.default,
              borderBottom: 1,
              borderColor: theme.palette.background.nav,
            }}
          >
            <ListItemButton onClick={() => toggleCategory(category)}>
              <ListItemIcon>
                <FolderIcon sx={{ color: theme.palette.text.secondary }} />
              </ListItemIcon>
              <ListItemText 
                primary={category === 'root' ? 'Root' : category}
                primaryTypographyProps={{
                  sx: { color: theme.palette.text.primary }
                }}
              />
              {expandedCategories[category] ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </ListItemButton>
          </ListItem>
          <Collapse in={expandedCategories[category]} timeout="auto" unmountOnExit>
            <List component="div" disablePadding>
              {categoryPayloads.map((payload) => (
                <ListItem
                  key={payload.path}
                  disablePadding
                  sx={{
                    '&:hover': {
                      backgroundColor: theme.palette.background.sidebar,
                    },
                  }}
                >
                  <ListItemButton
                    sx={{ pl: 4 }}
                    onClick={() => handleInject(payload)}
                  >
                    <ListItemIcon>
                      <CodeIcon sx={{ color: theme.palette.text.secondary }} />
                    </ListItemIcon>
                    <ListItemText
                      primary={payload.name}
                      secondary={`${(payload.size / 1024).toFixed(1)} KB`}
                      primaryTypographyProps={{
                        sx: { color: theme.palette.text.primary }
                      }}
                      secondaryTypographyProps={{
                        sx: { color: theme.palette.text.secondary }
                      }}
                    />
                    <Tooltip title="Inject Payload">
                      <IconButton
                        edge="end"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleInject(payload);
                        }}
                        sx={{ color: theme.palette.text.secondary }}
                      >
                        <InjectIcon />
                      </IconButton>
                    </Tooltip>
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          </Collapse>
          <Divider />
        </React.Fragment>
      ))}
    </List>
  );
} 