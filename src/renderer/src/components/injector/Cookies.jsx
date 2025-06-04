import React, { useEffect } from 'react';
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
  Button,
  Snackbar,
  Alert
} from '@mui/material';
import { 
  Refresh as RefreshIcon,
  Lock as LockIcon,
  Http as HttpIcon,
  Security as SecurityIcon,
  Timer as TimerIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Save as SaveIcon,
  Cookie as CookieIcon
} from '@mui/icons-material';
import { useTheme } from '../../theme';
import { useInjector } from '../../contexts/InjectorContext';

export default function Cookies({ appConfig }) {
  const theme = useTheme();
  const { selectedApp } = useInjector();
  
  const {
    cookiesData, setCookiesData,
    cookiesError, setCookiesError,
    cookiesIsLoading, setCookiesIsLoading,
    cookiesIsPolling, setCookiesIsPolling,
    cookiesPollInterval, setCookiesPollInterval,
    cookiesExpandedRow, setCookiesExpandedRow,
    cookiesEditValue, setCookiesEditValue,
    cookiesIsSaving, setCookiesIsSaving,
    cookiesSaveStatus, setCookiesSaveStatus
  } = useInjector();

  
  const config = appConfig || selectedApp;

  
  const fetchCookies = async () => {
    if (!config || !config.ip || !config.port) {
      setCookiesError('Selected app is missing IP or port information.');
      return;
    }
    
    setCookiesIsLoading(true);
    setCookiesError(null);
    
    try {
      
      const code = `
        const cookieData = {
          source: 'main-process',
          timestamp: Date.now(),
          cookies: []
        };
        
        try {
          const { session } = require('electron');
          const defaultSession = session.defaultSession;
          
          // Get all cookies
          const cookies = await defaultSession.cookies.get({});
          
          cookieData.cookies = cookies.map(cookie => ({
            name: cookie.name,
            value: cookie.value,
            domain: cookie.domain,
            path: cookie.path,
            secure: cookie.secure,
            httpOnly: cookie.httpOnly,
            expirationDate: cookie.expirationDate,
            sameSite: cookie.sameSite,
            session: cookie.session
          }));
          
        } catch (err) {
          cookieData.error = err.message;
        }
        
        return cookieData;
      `;
      const encodedData = btoa(code);

      const response = await fetch(`http://${config.ip}:${config.port}/console`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Origin': `http://${config.ip}:${config.port}`
        },
        body: JSON.stringify({
          data: encodedData,
          process: 'main'
        }),
        mode: 'cors',
        credentials: 'omit'
      });

      const result = await response.json();
      
      if (!result.jobId) {
        throw new Error('No job ID received');
      }

      
      const maxAttempts = 5;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const resultResponse = await fetch(`http://${config.ip}:${config.port}/result/${result.jobId}`);
        const resultData = await resultResponse.json();

        if (resultData.error) {
          throw new Error(resultData.error);
        }

        if (resultData.status === 'completed') {
          setCookiesData(resultData.result);
          break;
        }

        if (attempt < maxAttempts - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    } catch (err) {
      setCookiesError(err.message);
    } finally {
      setCookiesIsLoading(false);
    }
  };

  useEffect(() => {
    let intervalId;
    
    if (cookiesIsPolling && config && config.ip && config.port) {
      fetchCookies();
      intervalId = setInterval(fetchCookies, cookiesPollInterval * 1000);
    }
    
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [cookiesIsPolling, cookiesPollInterval, config]);

  
  useEffect(() => {
    
    if (!cookiesIsPolling) {
      setCookiesData(null);
      setCookiesError(null);
    }
  }, [cookiesIsPolling]);

  
  useEffect(() => {
    if (cookiesExpandedRow !== null && cookiesData && cookiesData.cookies[cookiesExpandedRow]) {
      setCookiesEditValue(cookiesData.cookies[cookiesExpandedRow].value);
    } else {
      setCookiesEditValue('');
    }
  }, [cookiesExpandedRow, cookiesData, setCookiesEditValue]);

  
  const getCookieUrl = (cookie) => {
    const protocol = cookie.secure ? 'https://' : 'http://';
    const domain = (cookie.domain || '').replace(/^\./, '');
    const path = cookie.path || '/';
    return `${protocol}${domain}${path}`;
  };

  
  const handleSave = async (cookie, newValue) => {
    if (!config || !config.ip || !config.port) {
      setCookiesSaveStatus({ type: 'error', message: 'Selected app is missing IP or port information.' });
      return;
    }

    setCookiesIsSaving(true);
    setCookiesSaveStatus(null);
    try {
      
      const updatePayload = `
        async function(cookie) {
          try {
            const { session } = require('electron');
            await session.defaultSession.cookies.set(cookie);
            return { success: true, cookie };
          } catch (err) {
            return { success: false, error: err.message };
          }
        }
      `;
      
      const cookieToSet = { ...cookie, value: newValue, url: getCookieUrl(cookie) };
      
      const code = `(${updatePayload})(${JSON.stringify(cookieToSet)})`;
      const encodedData = window.btoa(unescape(encodeURIComponent(code)));
      const response = await fetch(`http://${config.ip}:${config.port}/console`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Origin': `http://${config.ip}:${config.port}`
        },
        body: JSON.stringify({
          data: encodedData,
          process: 'main'
        }),
        mode: 'cors',
        credentials: 'omit'
      });
      const result = await response.json();
      if (!result.jobId) throw new Error('No job ID received');
      
      const maxAttempts = 5;
      let resultData = null;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const resultResponse = await fetch(`http://${config.ip}:${config.port}/result/${result.jobId}`);
        resultData = await resultResponse.json();
        if (resultData.status === 'completed') break;
        if (attempt < maxAttempts - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      if (resultData && resultData.error) {
        setCookiesSaveStatus({ type: 'error', message: resultData.error });
      } else if (resultData && resultData.status === 'completed') {
        setCookiesSaveStatus({ type: 'success', message: 'Cookie updated successfully!' });
      } else {
        setCookiesSaveStatus({ type: 'error', message: 'Failed to update cookie.' });
      }
    } catch (err) {
      setCookiesSaveStatus({ type: 'error', message: err.message });
    } finally {
      setCookiesIsSaving(false);
    }
  };

  return (
    <Box sx={{ 
      p: 2, 
      backgroundColor: theme.palette.background.paper,
      borderRadius: 1,
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0
    }}>
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        mb: 2 
      }}>
        <Typography variant="subtitle2">Cookies</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <FormControlLabel
            control={
              <Switch
                checked={cookiesIsPolling}
                onChange={(e) => setCookiesIsPolling(e.target.checked)}
                size="small"
              />
            }
            label="Auto"
          />
          <TextField
            size="small"
            type="number"
            value={cookiesPollInterval}
            onChange={(e) => setCookiesPollInterval(Math.max(1, parseInt(e.target.value) || 1))}
            sx={{ width: '60px' }}
            InputProps={{
              endAdornment: <Typography variant="caption">s</Typography>
            }}
          />
          <IconButton 
            size="small" 
            onClick={fetchCookies}
            disabled={cookiesIsLoading || !config || !config.ip || !config.port}
          >
            {cookiesIsLoading ? <CircularProgress size={20} /> : <RefreshIcon />}
          </IconButton>
        </Box>
      </Box>

      <Box sx={{ 
        flexGrow: 1,
        minHeight: 0,
        height: 0,
        overflowY: 'auto',
        fontFamily: 'monospace',
        fontSize: '0.875rem'
      }}>
        {!config ? (
          <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center',
            height: '100%',
            gap: 2
          }}>
            <CookieIcon 
              sx={{ 
                fontSize: 64,
                color: theme.palette.color.orange,
              }} 
            />
            <Typography variant="h6" color={theme.palette.text.secondary}>
              No App Selected
            </Typography>
            <Typography variant="body2" color={theme.palette.text.secondary}>
              Select a hooked app to view cookies
            </Typography>
          </Box>
        ) : (!config.port || !config.ip) ? (
          <Typography color="error">Selected app is missing IP or port information.</Typography>
        ) : cookiesError ? (
          <Typography color="error">{cookiesError}</Typography>
        ) : cookiesData ? (
          <Box>
            <Typography variant="caption" color={theme.palette.text.secondary} sx={{ display: 'block', mb: 1}}>
              Source: {cookiesData.source} | Timestamp: {new Date(cookiesData.timestamp).toLocaleString()}
            </Typography>
            {cookiesData.error ? (
              <Typography color="error">{cookiesData.error}</Typography>
            ) : cookiesData.cookies.length > 0 ? (
              <TableContainer component={Paper} sx={{ backgroundColor: theme.palette.background.nav, height: '100%', overflowY: 'auto', mb: 5 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell />
                      <TableCell>Name</TableCell>
                      <TableCell>Value</TableCell>
                      <TableCell>Domain</TableCell>
                      <TableCell>Path</TableCell>
                      <TableCell>Attributes</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {cookiesData.cookies.map((cookie, index) => [
                      <TableRow
                        key={index}
                        hover
                        sx={{ cursor: 'pointer' }}
                        onClick={() => setCookiesExpandedRow(cookiesExpandedRow === index ? null : index)}
                      >
                        <TableCell sx={{ width: 32 }}>
                          {cookiesExpandedRow === index ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                        </TableCell>
                        <TableCell sx={{ color: theme.palette.text.primary }}>{cookie.name}</TableCell>
                        <TableCell sx={{ color: theme.palette.text.primary }}>{cookie.value.length > 24 ? `${cookie.value.substring(0, 24)}...` : cookie.value}</TableCell>
                        <TableCell sx={{ color: theme.palette.text.primary }}>{cookie.domain}</TableCell>
                        <TableCell sx={{ color: theme.palette.text.primary }}>{cookie.path}</TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                            {cookie.secure && (
                              <Chip
                                icon={<LockIcon />}
                                label="Secure"
                                size="small"
                                color="success"
                                variant="outlined"
                              />
                            )}
                            {cookie.httpOnly && (
                              <Chip
                                icon={<HttpIcon />}
                                label="HttpOnly"
                                size="small"
                                color="info"
                                variant="outlined"
                              />
                            )}
                            {cookie.sameSite && (
                              <Chip
                                icon={<SecurityIcon />}
                                label={`SameSite=${cookie.sameSite}`}
                                size="small"
                                color="warning"
                                variant="outlined"
                              />
                            )}
                            {cookie.session ? (
                              <Chip
                                icon={<TimerIcon />}
                                label="Session"
                                size="small"
                                color="secondary"
                                variant="outlined"
                              />
                            ) : cookie.expirationDate && (
                              <Chip
                                icon={<TimerIcon />}
                                label={`Expires: ${new Date(cookie.expirationDate).toLocaleString()}`}
                                size="small"
                                color="default"
                                variant="outlined"
                              />
                            )}
                          </Box>
                        </TableCell>
                      </TableRow>,
                      cookiesExpandedRow === index && (
                        <TableRow key={index + '-expanded'}>
                          <TableCell colSpan={6} sx={{ backgroundColor: theme.palette.background.terminal, p: 2 }}>
                            <Box sx={{ fontSize: '0.85em', color: '#d4d4d4', whiteSpace: 'pre-wrap', wordBreak: 'break-all', mb: 2 }}>
                              {JSON.stringify(cookie, null, 2)}
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <TextField
                                label="Value"
                                size="small"
                                value={cookiesEditValue}
                                onChange={e => setCookiesEditValue(e.target.value)}
                                fullWidth
                                sx={{ minWidth: 200, backgroundColor: theme.palette.background.nav, input: { color: '#d4d4d4' } }}
                                InputProps={{
                                  readOnly: cookiesIsSaving
                                }}
                              />
                              <Button
                                variant="contained"
                                color="primary"
                                size="small"
                                startIcon={<SaveIcon />}
                                disabled={cookiesIsSaving || cookiesEditValue === cookie.value}
                                onClick={() => handleSave(cookie, cookiesEditValue)}
                              >
                                Save
                              </Button>
                              {cookiesIsSaving && <CircularProgress size={20} />}
                            </Box>
                            {cookiesSaveStatus && (
                              <Alert severity={cookiesSaveStatus.type} sx={{ mt: 1 }}>{cookiesSaveStatus.message}</Alert>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    ])}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Typography color={theme.palette.text.secondary}>No cookies found</Typography>
            )}
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
            <CookieIcon 
              sx={{ 
                fontSize: 64,
                color: theme.palette.color.orange,
              }} 
            />
            <Typography variant="h6" color={theme.palette.text.secondary}>
              No Cookies :(
            </Typography>
            <Typography variant="body2" color={theme.palette.text.secondary}>
              Enable auto-refresh or click the refresh button to fetch cookies
            </Typography>
          </Box>
        )}
      </Box>
      <Snackbar
        open={!!cookiesSaveStatus}
        autoHideDuration={4000}
        onClose={() => setCookiesSaveStatus(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {cookiesSaveStatus && (
          <Alert severity={cookiesSaveStatus.type} sx={{ width: '100%' }}>
            {cookiesSaveStatus.message}
          </Alert>
        )}
      </Snackbar>
    </Box>
  );
}