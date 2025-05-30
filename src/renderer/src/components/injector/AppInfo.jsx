import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Switch,
  FormControlLabel,
  TextField,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Tooltip,
  Divider
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  PsychologyAlt as PsychologyAltIcon
} from '@mui/icons-material';
import { useTheme } from '../../theme';
import { useInjector } from '../../contexts/InjectorContext';

export default function AppInfo({ appConfig }) {
  const { selectedApp } = useInjector();
  const [isPolling, setIsPolling] = useState(false);
  const [pollInterval, setPollInterval] = useState(5);
  const [isLoading, setIsLoading] = useState(false);
  const [appInfo, setAppInfo] = useState(null);
  const [error, setError] = useState(null);
  const theme = useTheme();

  const config = appConfig || selectedApp;

  // Use config.port (from call-home POST) for requests
  useEffect(() => {
    let intervalId;
    const fetchAppInfo = async () => {
      setIsLoading(true);
      setError(null);
      try {
        if (!config || !config.ip || !config.port) {
          setError('Selected app is missing IP or port information.');
          setIsLoading(false);
          return;
        }
        const response = await fetch(`http://${config.ip}:${config.port}/info`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Origin': `http://${config.ip}:${config.port}`
          },
          mode: 'cors',
          credentials: 'omit'
        });
        const data = await response.json();
        setAppInfo(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    if (isPolling && config && config.ip && config.port) {
      fetchAppInfo();
      intervalId = setInterval(fetchAppInfo, pollInterval * 1000);
    }
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isPolling, pollInterval, config]);

  // Helper for pretty uptime
  const formatUptime = (seconds) => {
    if (!seconds) return '0s';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return [
      h ? `${h}h` : '',
      m ? `${m}m` : '',
      `${s}s`
    ].filter(Boolean).join(' ');
  };

  // Helper for pretty date
  const formatDate = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleString();
  };

  return (
    <Box sx={{
      p: 2,
      backgroundColor: theme.palette.background.paper,
      borderRadius: 1,
      height: '100%',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        mb: 2
      }}>
        <Typography variant="subtitle2">App Info</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <FormControlLabel
            control={
              <Switch
                checked={isPolling}
                onChange={(e) => setIsPolling(e.target.checked)}
                size="small"
              />
            }
            label="Auto"
          />
          <TextField
            size="small"
            type="number"
            value={pollInterval}
            onChange={(e) => setPollInterval(Math.max(1, parseInt(e.target.value) || 1))}
            sx={{ width: '60px' }}
            InputProps={{
              endAdornment: <Typography variant="caption">s</Typography>
            }}
          />
          <IconButton
            size="small"
            onClick={() => {
              if (config && config.ip && config.port) {
                setIsLoading(true);
                setError(null);
                fetch(`http://${config.ip}:${config.port}/info`, {
                  method: 'GET',
                  headers: {
                    'Accept': 'application/json',
                    'Origin': `http://${config.ip}:${config.port}`
                  },
                  mode: 'cors',
                  credentials: 'omit'
                })
                  .then(res => res.json())
                  .then(data => setAppInfo(data))
                  .catch(err => setError(err.message))
                  .finally(() => setIsLoading(false));
              } else {
                setError('Selected app is missing IP or port information.');
              }
            }}
            disabled={isLoading}
          >
            {isLoading ? <CircularProgress size={20} /> : <RefreshIcon />}
          </IconButton>
        </Box>
      </Box>

      <Box sx={{
        flexGrow: 1,
        overflowY: 'auto',
        fontFamily: 'monospace',
        fontSize: '0.875rem',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word'
      }}>
        {!config ? (
          <Box sx={{
            p: 2,
            backgroundColor: theme.palette.background.paper,
            borderRadius: 1,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2
          }}>
            <PsychologyAltIcon sx={{ fontSize: 64, color: theme.palette.color.cyan }} />
            <Typography variant="h6" color={theme.palette.text.secondary}>
              No app selected
            </Typography>
            <Typography variant="body2" color={theme.palette.text.secondary}>
              Select a hooked app to view info
            </Typography>
          </Box>
        ) : (!config.port || !config.ip) ? (
          <Typography color="error">Selected app is missing IP or port information.</Typography>
        ) : error ? (
          <Typography color="error">{error}</Typography>
        ) : appInfo ? (
          <Box>
            {/* App Section */}
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>App</Typography>
            <Box sx={{ mb: 1 }}>
              <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>{appInfo.app?.name} v{appInfo.app?.version}</Typography><br />
              <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>Packaged: {String(appInfo.app?.isPackaged)}</Typography><br />
              <Tooltip title={appInfo.app?.appPath || ''}><Typography variant="caption" sx={{ color: theme.palette.text.secondary }} noWrap>App Path: {appInfo.app?.appPath}</Typography></Tooltip><br />
              <Tooltip title={appInfo.app?.userDataPath || ''}><Typography variant="caption" sx={{ color: theme.palette.text.secondary }} noWrap>User Data: {appInfo.app?.userDataPath}</Typography></Tooltip>
            </Box>
            <Divider sx={{ mb: 1 }} />

            {/* System Section */}
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>System</Typography>
            <Box sx={{ mb: 1 }}>
              <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>{appInfo.system?.platform} / {appInfo.system?.arch}</Typography><br />
              <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>PID: {appInfo.system?.pid} | Uptime: {formatUptime(appInfo.system?.uptime)}</Typography><br />
              <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>Node: {appInfo.system?.versions?.node} | Electron: {appInfo.system?.versions?.electron} | Chrome: {appInfo.system?.versions?.chrome}</Typography>
            </Box>
            <Divider sx={{ mb: 1 }} />

            {/* Windows Section */}
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>Windows</Typography>
            {Array.isArray(appInfo.windows) && appInfo.windows.length > 0 ? (
              <TableContainer component={Paper} sx={{ backgroundColor: theme.palette.background.nav, mb: 1, color: theme.palette.text.primary }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ color: theme.palette.text.primary }}>ID</TableCell>
                      <TableCell sx={{ color: theme.palette.text.primary }}>Title</TableCell>
                      <TableCell sx={{ color: theme.palette.text.primary }}>URL</TableCell>
                      <TableCell sx={{ color: theme.palette.text.primary }}>Focused</TableCell>
                      <TableCell sx={{ color: theme.palette.text.primary }}>Visible</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {appInfo.windows.map((win, idx) => (
                      <TableRow key={idx}>
                        <TableCell sx={{ color: theme.palette.text.primary }}>{win.id}</TableCell>
                        <TableCell sx={{ color: theme.palette.text.primary }}>{win.title}</TableCell>
                        <TableCell sx={{ color: theme.palette.text.primary }}>
                          <Tooltip title={win.url}><span>{win.url?.length > 32 ? win.url.slice(0, 32) + '...' : win.url}</span></Tooltip>
                        </TableCell>
                        <TableCell sx={{ color: theme.palette.text.primary }}>{win.focused ? 'Yes' : 'No'}</TableCell>
                        <TableCell sx={{ color: theme.palette.text.primary }}>{win.visible ? 'Yes' : 'No'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Typography variant="caption" sx={{ color: theme.palette.text.primary }}>No windows</Typography>
            )}
            <Divider sx={{ mb: 1 }} />

            {/* Debug Section */}
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>Debug</Typography>
            <Box>
              <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>Active Jobs: {appInfo.debug?.activeJobs}</Typography><br />
              <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>Tool Version: {appInfo.debug?.toolVersion}</Typography><br />
              <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>Start Time: {formatDate(appInfo.debug?.startTime)}</Typography>
            </Box>
          </Box>
        ) : (
          <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center',
            height: '100%',
            gap: 2
          }}>
            <PsychologyAltIcon 
              sx={{ 
                fontSize: 64,
                color: theme.palette.color.cyan
              }} 
            />
            <Typography variant="h6" color={theme.palette.text.secondary}>
              No Application Data Yet
            </Typography>
            <Typography variant="body2" color={theme.palette.text.secondary}>
              Enable auto refresh or click the refresh button to collect info
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
} 