import React, { useCallback, useEffect, useState } from 'react';
import { 
  Container, 
  Box, 
  TextField, 
  Button, 
  Typography, 
  Alert, 
  Snackbar,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Chip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControlLabel,
  Switch
} from '@mui/material';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { 
  FolderOpen as FolderIcon, 
  PlayArrow as InjectIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Refresh as RefreshIcon,
  Send as SendIcon,
  Wifi as WifiIcon,
  WifiOff as WifiOffIcon,
  Pending as PendingIcon
} from '@mui/icons-material';
import { useTheme } from '../theme';
import AppInfo from '../components/injector/AppInfo';
import Cookies from '../components/injector/Cookies';
import IPCMonitor from '../components/injector/IPCMonitor';
import { useInjector } from '../contexts/InjectorContext';
import { useSettings } from '../contexts/SettingsContext';
import payloads from '../components/injector/Payloads';
import { useApi } from '../contexts/ApiContext';
import { v4 as uuidv4 } from 'uuid';

export default function Injector() {
  const theme = useTheme();
  const { settings } = useSettings();
  const backgroundColor = settings.themeType === 'light' ? theme.palette.background.paper : theme.palette.color.black;
  // Get all state and actions from context
  const {
    // State
    asarPath, setAsarPath,
    selectedPayload, setSelectedPayload,
    injectionStatus, setInjectionStatus,
    isInjecting, setIsInjecting,
    isSetupComplete, setIsSetupComplete,
    setupStatus, setSetupStatus,
    hookedApps, setHookedApps,
    selectedApp, setSelectedApp,
    payloads: contextPayloads, setPayloads,
    isLoadingPayloads, setIsLoadingPayloads,
    consoleInput, setConsoleInput,
    consoleOutput, setConsoleOutput,
    consoleHistory, setConsoleHistory,
    consoleHistoryIndex, setConsoleHistoryIndex,
    selectedProcess, setSelectedProcess,
    hookedAppSettings,
    // Actions
    clearInjectionStatus,
    clearAsarPath,
    clearAll,
    getNextAvailablePort,
    saveAppSettings,
  } = useInjector();

  const { injectHook } = useApi();

  // Local state that doesn't need to persist between page changes
  const [isSetupLoading, setIsSetupLoading] = React.useState(false);
  const [isListenerRunning, setIsListenerRunning] = React.useState(false);
  const [activeJobs, setActiveJobs] = React.useState(new Map());
  const [resetKey, setResetKey] = React.useState(0);
  const [preparedPayloadPath, setPreparedPayloadPath] = useState(null);
  const [showAdvancedConfig, setShowAdvancedConfig] = useState(false);
  const [asarUuid, setAsarUuid] = useState(null);
  const [asarConfig, setAsarConfig] = useState({
    debugPort: 10100,
    debugHost: '127.0.0.1',
    callHomeHost: '127.0.0.1',
    callHomePort: 5666,
    callHomeInterval: 60000,
    jobTimeout: 10000,
    enableCallHome: true
  });
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [pendingConfig, setPendingConfig] = useState(asarConfig);

  // Get the selected app's config from hookedAppSettings
  const selectedAppConfig = selectedApp?.uuid ? hookedAppSettings[selectedApp.uuid] : null;

  // Update the payload selection handler
  const handlePayloadSelect = (event) => {
    setSelectedPayload(event.target.value);
  };

  // Update the send payload handler to use the static payloads only
  const handleSendPayload = async () => {
    if (selectedPayload) {
      const payload = payloads.find(p => p.name === selectedPayload);
      if (payload) {
        // Set the process type based on the payload
        setSelectedProcess(payload.process);
        // Wait for selectedProcess to match payload.process
        await new Promise(resolve => {
          const checkProcess = () => {
            setSelectedProcess(currentProcess => {
              if (currentProcess === payload.process) {
                resolve();
                return currentProcess;
              }
              setTimeout(checkProcess, 50);
              return currentProcess;
            });
          };
          checkProcess();
        });
        // Execute the static payload code (no templating)
        handleExecuteCode(payload.code);
      }
    }
  };

  // File selection
  const handleSelectAsar = useCallback(async () => {
    try {
      console.log('🔄 Opening ASAR file dialog...');
      const result = await window.api.fileDialog.openFile({
        filters: [
          { name: 'ASAR Files', extensions: ['asar'] },
          { name: 'All Files', extensions: ['*'] }
        ],
        properties: ['openFile']
      });
      console.log('📁 File dialog result:', result);
      if (result && result.success && result.filePath) {
        console.log('✅ Selected ASAR file:', result.filePath);
        setAsarPath(result.filePath);
        setIsSetupComplete(false); // Reset setup status
        setSetupStatus(null);
        setAsarUuid(uuidv4());
        // Use the next available port from context
        const nextPort = getNextAvailablePort(10100);
        setAsarConfig(prev => ({
          ...prev,
          debugPort: nextPort
        }));
      }
    } catch (error) {
      console.error('❌ Failed to select ASAR file:', error);
      setSetupStatus({
        type: 'error',
        message: `Failed to select ASAR file: ${error.message}`
      });
    }
  }, [setAsarPath, setIsSetupComplete, setSetupStatus, getNextAvailablePort]);


  // Inject Hook handler
  const handleInjectHook = async () => {
    if (!asarPath || !asarUuid) {
      setSetupStatus({
        type: 'error',
        message: 'Please select an ASAR file.'
      });
      return;
    }
    try {
      setIsSetupLoading(true);
      setSetupStatus(null);
      const config = {
        asarPath,
        uuid: asarUuid,
        ...asarConfig
      };
      const result = await injectHook(config);
      if (result.success) {
        setIsSetupComplete(true);
        setSetupStatus({
          type: 'success',
          message: `Setup completed! Hook payload injected.`
        });
        setTimeout(() => setSetupStatus(null), 3000);
        setHookedApps(prev => [
          ...prev,
          {
            uuid: asarUuid,
            asarPath,
            ...asarConfig,
            lastSeen: new Date().toISOString(),
            name: asarPath.split('/').pop()
          }
        ]);
        setAsarPath(''); // Clear file input
      } else {
        throw new Error(result.error || 'Injection failed');
      }
    } catch (error) {
      setSetupStatus({
        type: 'error',
        message: error.message
      });
      setIsSetupComplete(false);
    } finally {
      setIsSetupLoading(false);
    }
  };

  // Load hooked apps
  const loadHookedApps = useCallback(async () => {
    try {
      const result = await window.api.inject.getHookedApps();
      if (result && result.success) {
        const now = Date.now();
        const apps = Array.isArray(result.apps.apps) ? result.apps.apps : [];
        // Only keep apps seen in the last 5 minutes
        const filteredApps = apps.filter(app => {
          if (!app.lastSeen) return false;
          const lastSeen = new Date(app.lastSeen).getTime();
          return now - lastSeen <= 5 * 60 * 1000;
        });
        // Update hookedAppSettings with latest info from call-home, but only if changed
        filteredApps.forEach(app => {
          const current = hookedAppSettings[app.uuid];
          if (
            !current ||
            current.ip !== app.ip ||
            current.port !== app.port ||
            current.name !== app.name
          ) {
            saveAppSettings(app);
          }
        });
        setHookedApps(filteredApps);
        setIsListenerRunning(filteredApps.length > 0);
        if (filteredApps.length > 0 && !selectedApp) {
          setSelectedApp(filteredApps[0]);
        } else if (filteredApps.length === 0) {
          setSelectedApp(null);
        }
      } else {
        setHookedApps([]);
        setIsListenerRunning(false);
        setSelectedApp(null);
      }
    } catch (error) {
      setHookedApps([]);
      setIsListenerRunning(false);
      setSelectedApp(null);
    }
  }, [setHookedApps, setSelectedApp, selectedApp, saveAppSettings]);

  // Poll for job status
  useEffect(() => {
    if (activeJobs.size === 0) return;

    const pollInterval = setInterval(async () => {
      for (const [jobId, jobInfo] of activeJobs.entries()) {
        try {
          const status = await window.api.inject.getPayloadStatus(10101, jobId);
          
          if (status.success) {
            // Update console output with job status
            setConsoleOutput(prev => [...prev, {
              type: status.status === 'completed' ? 'success' : 'info',
              output: status.output || `Job ${jobId}: ${status.status}`
            }]);

            // If job is complete or failed, remove from active jobs
            if (status.status === 'completed' || status.status === 'failed') {
              setActiveJobs(prev => {
                const next = new Map(prev);
                next.delete(jobId);
                return next;
              });
            }
          }
        } catch (error) {
          console.error(`Failed to get status for job ${jobId}:`, error);
          // Remove failed job from active jobs
          setActiveJobs(prev => {
            const next = new Map(prev);
            next.delete(jobId);
            return next;
          });
        }
      }
    }, 1000); // Poll every second

    return () => clearInterval(pollInterval);
  }, [activeJobs, setConsoleOutput]);

  const fetchResult = async (jobId, maxAttempts = 5) => {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        console.log(`🔍 Debug - Fetching result for job ${jobId} (attempt ${attempt + 1}/${maxAttempts})`);
        const resultResponse = await fetch(`http://127.0.0.1:10101/result/${jobId}`);
        const resultText = await resultResponse.text();
        console.log('🔍 Debug - Raw result response:', resultText);

        if (!resultText) {
          console.log('🔍 Debug - Empty result, waiting before retry...');
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }

        let resultData;
        try {
          resultData = JSON.parse(resultText);
        } catch (parseError) {
          console.error('🔍 Debug - Failed to parse result as JSON:', parseError);
          throw new Error(`Invalid result JSON: ${resultText}`);
        }

        // If we got a valid response with error or result, return it immediately
        if (resultData.error || resultData.result !== undefined) {
          return resultData;
        }

        // Only continue polling if the status is pending
        if (resultData.status === 'pending') {
          console.log('🔍 Debug - Job still pending, waiting before retry...');
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }

        // If we get here, we have a completed status
        return resultData;
      } catch (error) {
        if (attempt === maxAttempts - 1) {
          throw error;
        }
        console.log('🔍 Debug - Error fetching result, retrying...', error);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    throw new Error('Failed to fetch result after maximum attempts');
  };

  const handleExecuteCode = useCallback(async (code) => {
    if (!selectedApp) {
      setConsoleOutput(prev => [...prev, {
        type: 'error',
        command: code,
        output: 'Please select an app first'
      }]);
      return;
    }

    try {
      // Add to history
      const newHistory = [code, ...consoleHistory.filter(cmd => cmd !== code)].slice(0, 100);
      setConsoleHistory(newHistory);
      setConsoleHistoryIndex(-1);
      localStorage.setItem('consoleHistory', JSON.stringify(newHistory));

      // Add command to output with pending status
      setConsoleOutput(prev => [...prev, { 
        command: code,
        status: 'pending',
        output: 'Executing...'
      }]);

      // Encode code in base64
      const encodedData = btoa(code);

      console.log('🔍 Debug - Sending code via direct fetch:', {
        url: 'http://127.0.0.1:10101/console',
        codeLength: code.length,
        encodedLength: encodedData.length
      });

      const response = await fetch('http://127.0.0.1:10101/console', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Origin': 'http://127.0.0.1:10101'
        },
        body: JSON.stringify({
          data: encodedData,
          process: selectedProcess
        }),
        mode: 'cors',
        credentials: 'omit'
      });

      console.log('🔍 Debug - Response status:', response.status);
      const responseText = await response.text();
      console.log('🔍 Debug - Raw response:', responseText);

      let result;
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        console.error('🔍 Debug - Failed to parse response as JSON:', parseError);
        throw new Error(`Invalid JSON response: ${responseText}`);
      }

      if (!result.jobId) {
        throw new Error('No job ID received from server');
      }

      // Get the result using the job ID with polling
      const resultData = await fetchResult(result.jobId);

      // Update the last output entry with the result
      setConsoleOutput(prev => {
        const newOutput = [...prev];
        const lastEntry = newOutput[newOutput.length - 1];
        if (lastEntry && lastEntry.command === code) {
          if (resultData.error) {
            lastEntry.status = 'error';
            // Format error with message and stack trace
            lastEntry.output = `${resultData.error}\n\n${resultData.stack || ''}`;
          } else {
            lastEntry.status = 'success';
            lastEntry.output = JSON.stringify(resultData.result, null, 2);
          }
        }
        return newOutput;
      });
    } catch (error) {
      console.error('Failed to execute code:', error);
      // Update the last output entry with the error
      setConsoleOutput(prev => {
        const newOutput = [...prev];
        const lastEntry = newOutput[newOutput.length - 1];
        if (lastEntry && lastEntry.command === code) {
          lastEntry.status = 'error';
          lastEntry.output = error.message || 'An unknown error occurred';
        }
        return newOutput;
      });
    }
  }, [selectedApp, consoleHistory, selectedProcess, setConsoleHistory, setConsoleHistoryIndex, setConsoleOutput]);

  // Load hooked apps on mount and periodically
  useEffect(() => {
    loadHookedApps();
    const interval = setInterval(loadHookedApps, 5000);
    return () => clearInterval(interval);
  }, [loadHookedApps]);

  // Load console history from localStorage on mount
  useEffect(() => {
    const savedHistory = localStorage.getItem('consoleHistory');
    if (savedHistory) {
      try {
        setConsoleHistory(JSON.parse(savedHistory));
      } catch (error) {
        console.error('Failed to load console history:', error);
      }
    }
  }, [setConsoleHistory]);

  // Modal for configuring injection params
  const openConfigModal = () => {
    setPendingConfig({
      ...asarConfig,
      debugPort: getNextAvailablePort(10100)
    });
    setShowConfigModal(true);
  };
  const handleConfigFieldChange = (key, value) => {
    setPendingConfig(prev => ({ ...prev, [key]: value }));
  };
  const handleConfigSave = () => {
    setAsarConfig(pendingConfig);
    setShowConfigModal(false);
  };
  const handleConfigCancel = () => {
    setShowConfigModal(false);
  };

  return (
    <Container
      maxWidth={false}
      disableGutters
      id="injector-main"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '100%',
        backgroundColor: theme.palette.background.default,
      }}
      key={resetKey}
    >
      <PanelGroup direction="horizontal">
        <Panel defaultSize={30} minSize={20}>
          <Box sx={{ 
            height: '100%', 
            display: 'flex', 
            flexDirection: 'column',
            backgroundColor: theme.palette.background.paper,
          }}>
            {/* Setup Section */}
            <Box sx={{ 
              p: 2, 
              borderBottom: 1, 
              borderColor: theme.palette.background.nav,
              backgroundColor: theme.palette.background.content,
            }}>
              
              {/* ASAR Selection */}
              <Card sx={{ mb: 2, backgroundColor: theme.palette.background.default }}>
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                  <Typography variant="subtitle2" sx={{ mb: 1, color: theme.palette.text.primary }}>
                    Select ASAR File
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    <TextField
                      fullWidth
                      size="small"
                      placeholder="No ASAR file selected"
                      value={asarPath}
                      InputProps={{
                        readOnly: true,
                      }}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          backgroundColor: theme.palette.background.paper,
                        },
                      }}
                    />
                    <Button
                      variant="outlined"
                      startIcon={<FolderIcon />}
                      onClick={handleSelectAsar}
                      sx={{ minWidth: '120px' }}
                    >
                      Browse
                    </Button>
                  </Box>
                </CardContent>
              </Card>

              <Container sx={{ display: 'flex', flexDirection: 'row', gap: 2 }}>
                <Button
                  variant="contained"
                  startIcon={isSetupLoading ? <CircularProgress size={20} /> : <InjectIcon />}
                  onClick={handleInjectHook}
                  disabled={!asarPath || isSetupLoading || isSetupComplete}
                  fullWidth
                  sx={{ mb: 2 }}
                >
                  {isSetupLoading ? 'Injecting...' : isSetupComplete ? 'Hook Injected' : 'Inject Hook'}
                </Button>
                <Button
                  variant="outlined"
                  color="info"
                  size="small"
                  onClick={openConfigModal}
                  fullWidth
                  sx={{ mb: 2 }}
                >
                  Configure Injection
                </Button>
                <Button
                  fullWidth
                  variant="outlined"
                  color="error"
                  size="small"
                  onClick={() => {
                    clearAll();
                    setResetKey(prev => prev + 1);
                  }}
                  sx={{ mb: 2 }}
                >
                  Reset All
                </Button>
              </Container>

              {/* Hooked Apps List */}
              <Card sx={{ mb: 2, backgroundColor: theme.palette.background.default }}>
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="subtitle2" sx={{ color: theme.palette.text.primary }}>
                        Hooked Apps
                      </Typography>
                      {isListenerRunning ? (
                        <WifiIcon sx={{ color: 'success.main', fontSize: 20 }} />
                      ) : (
                        <WifiOffIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                      )}
                    </Box>
                    <IconButton size="small" onClick={loadHookedApps}>
                      <RefreshIcon />
                    </IconButton>
                  </Box>
                  <FormControl fullWidth size="small">
                    <InputLabel id="hooked-apps-label">Select Hooked App</InputLabel>
                    <Select
                      labelId="hooked-apps-label"
                      value={selectedApp?.uuid || ''}
                      label="Select Hooked App"
                      onChange={e => {
                        const app = hookedApps.find(a => a.uuid === e.target.value);
                        setSelectedApp(app || null);
                      }}
                      displayEmpty
                      sx={{ backgroundColor: theme.palette.background.paper }}
                    >
                      {hookedApps.length === 0 && (
                        <MenuItem value="" disabled>
                          <em>No hooked apps found</em>
                        </MenuItem>
                      )}
                      {hookedApps.map(app => (
                        <MenuItem key={app.uuid} value={app.uuid}>
                          {app.name} ({app.uuid})
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </CardContent>
              </Card>
            </Box>

            {/* Terminal Section */}
            <Box sx={{ 
              flexGrow: 1, 
              display: 'flex',
              flexDirection: 'column',
              p: 2,
              backgroundColor: theme.palette.background.default,
              minHeight: 0,
            }}>
              {/* Payload Launcher Section */}
              <Card sx={{ mb: 4, backgroundColor: theme.palette.background.content }}>
                <CardContent sx={{ p: 2, '&:last-child': { pb: 8 } }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2}}>
                      <Typography variant="subtitle2" sx={{ color: theme.palette.text.primary }}>
                        Pre-built Payloads
                      </Typography>
                      <FormControl size="small" sx={{ minWidth: 300 }}>
                        <Select
                          value={selectedPayload}
                          onChange={handlePayloadSelect}
                          displayEmpty
                          sx={{
                            backgroundColor: theme.palette.background.paper,
                            color: theme.palette.text.primary,
                            '& .MuiOutlinedInput-notchedOutline': {
                              borderColor: theme.palette.background.nav,
                            },
                            '&:hover .MuiOutlinedInput-notchedOutline': {
                              borderColor: theme.palette.background.sidebar,
                            },
                            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                              borderColor: theme.palette.color.blue,
                            },
                            '& .MuiSelect-icon': {
                              color: theme.palette.text.primary,
                            },
                          }}
                        >
                          <MenuItem value="">
                            <em>Select a payload...</em>
                          </MenuItem>
                          {payloads.map((payload) => (
                            <MenuItem key={payload.name} value={payload.name}>
                              {payload.name} ({payload.process})
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      <Button
                        variant="contained"
                        size="small"
                        onClick={handleSendPayload}
                        disabled={!selectedPayload}
                        sx={{
                          backgroundColor: theme.palette.color.cyan,
                          '&:hover': {
                            backgroundColor: theme.palette.color.cyanDark,
                          },
                        }}
                      >
                        Send Payload
                      </Button>
                    </Box>
                    {selectedPayload && (
                      <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                        {payloads.find(p => p.name === selectedPayload)?.description}
                      </Typography>
                    )}
                  </Box>
                </CardContent>
              </Card>

              {/* Terminal Header */}
              <Box sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between', 
                mb: 1 
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Typography variant="subtitle2" sx={{ color: theme.palette.text.primary }}>
                    Terminal
                  </Typography>
                  <FormControl size="small" sx={{ minWidth: 120 }}>
                    <Select
                      value={selectedProcess}
                      onChange={(e) => setSelectedProcess(e.target.value)}
                      sx={{
                        backgroundColor: theme.palette.background.paper,
                        color: theme.palette.text.primary,
                        '& .MuiOutlinedInput-notchedOutline': {
                          borderColor: theme.palette.background.nav,
                        },
                        '&:hover .MuiOutlinedInput-notchedOutline': {
                          borderColor: theme.palette.background.sidebar,
                        },
                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                          borderColor: theme.palette.color.blue,
                        },
                        '& .MuiSelect-icon': {
                          color: theme.palette.text.primary,
                        },
                      }}
                    >
                      <MenuItem value="renderer">Renderer</MenuItem>
                      <MenuItem value="main">Main</MenuItem>
                    </Select>
                  </FormControl>
                </Box>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => {
                    setConsoleOutput([]);
                    setConsoleHistory([]);
                    localStorage.removeItem('consoleHistory');
                  }}
                >
                  Clear
                </Button>
              </Box>
              
              {/* Terminal Output */}
              <Box sx={{ 
                flexGrow: 1,
                mb: 2,
                height: '100%',
                overflowY: 'auto',
                backgroundColor: theme.palette.background.terminal,
                borderRadius: 1,
                p: 2,
                fontFamily: 'Consolas, Monaco, monospace',
                fontSize: '14px',
                color: theme.palette.text.primary,
                display: 'flex',
                flexDirection: 'column',
                '&::-webkit-scrollbar': {
                  width: '8px',
                },
                '&::-webkit-scrollbar-track': {
                  backgroundColor: theme.palette.background.nav,
                },
                '&::-webkit-scrollbar-thumb': {
                  backgroundColor: theme.palette.background.sidebar,
                  borderRadius: '4px',
                },
              }}>
                <Box sx={{ 
                  flexGrow: 1,
                  overflowY: 'auto',
                  '&::-webkit-scrollbar': {
                    width: '8px',
                  },
                  '&::-webkit-scrollbar-track': {
                    backgroundColor: theme.palette.background.nav,
                  },
                  '&::-webkit-scrollbar-thumb': {
                    backgroundColor: theme.palette.background.sidebar,
                    borderRadius: '4px',
                  },
                }}>
                  {consoleOutput.map((entry, index) => (
                    <Box key={index} sx={{ mb: 1 }}>
                      {entry.command && (
                        <Box sx={{ 
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                          mb: 0.5,
                        }}>
                          <Box sx={{ 
                            color: theme.palette.color.blue,
                            '&::before': {
                              content: '"> "',
                              color: theme.palette.color.blue,
                            }
                          }}>
                            {entry.command}
                          </Box>
                          {entry.status === 'pending' && (
                            <PendingIcon 
                              sx={{ 
                                color: theme.palette.color.yellow,
                                fontSize: '1rem',
                                animation: 'spin 1s linear infinite',
                                '@keyframes spin': {
                                  '0%': { transform: 'rotate(0deg)' },
                                  '100%': { transform: 'rotate(360deg)' }
                                }
                              }} 
                            />
                          )}
                          {entry.status === 'success' && (
                            <CheckIcon sx={{ color: theme.palette.color.green, fontSize: '1rem' }} />
                          )}
                          {entry.status === 'error' && (
                            <ErrorIcon sx={{ color: theme.palette.color.red, fontSize: '1rem' }} />
                          )}
                        </Box>
                      )}
                      <Box sx={{ 
                        color: entry.status === 'error' ? theme.palette.color.red : theme.palette.text.primary,
                        pl: 2,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word'
                      }}>
                        {entry.output}
                      </Box>
                    </Box>
                  ))}
                </Box>
              </Box>

              {/* Terminal Input */}
              <Box sx={{ 
                display: 'flex',
                gap: 1,
                backgroundColor: theme.palette.background.terminal,
                borderRadius: 1,
                p: 2,
                flexShrink: 0, 
              }}>
                <Box sx={{ 
                  color: theme.palette.color.blue,
                  pt: 1,
                  '&::before': {
                    content: '"> "',
                    color: theme.palette.color.blue,
                  }
                }} />
                <TextField
                  fullWidth
                  multiline
                  maxRows={4}
                  placeholder="Enter JavaScript code to execute..."
                  value={consoleInput}
                  onChange={(e) => setConsoleInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (consoleInput.trim()) {
                        handleExecuteCode(consoleInput);
                        setConsoleInput('');
                      }
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      if (consoleHistoryIndex < consoleHistory.length - 1) {
                        setConsoleHistoryIndex(prev => prev + 1);
                        setConsoleInput(consoleHistory[consoleHistoryIndex + 1]);
                      }
                    } else if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      if (consoleHistoryIndex > 0) {
                        setConsoleHistoryIndex(prev => prev - 1);
                        setConsoleInput(consoleHistory[consoleHistoryIndex - 1]);
                      } else if (consoleHistoryIndex === 0) {
                        setConsoleHistoryIndex(-1);
                        setConsoleInput('');
                      }
                    }
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: 'transparent',
                      '& fieldset': {
                        borderColor: 'transparent',
                      },
                      '&:hover fieldset': {
                        borderColor: 'transparent',
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: 'transparent',
                      },
                      '& textarea': {
                        fontFamily: 'Consolas, Monaco, monospace',
                        fontSize: '14px',
                        lineHeight: 1.5,
                        color: theme.palette.text.primary,
                      }
                    }
                  }}
                />
              </Box>
            </Box>
          </Box>
        </Panel>

        <PanelResizeHandle style={{
          width: 10,
          backgroundColor: theme.palette.background.nav,
        }}/>

        <Panel minSize={70}>
          <Box sx={{ 
            height: '100%', 
            backgroundColor: theme.palette.background.paper,
            p: 2,
            display: 'flex',
            flexDirection: 'column',
            gap: 2
          }}>
            <Typography variant="h6" sx={{ color: theme.palette.text.primary }}>
              Status
            </Typography>
            {setupStatus && (
              <Alert severity={setupStatus.type} sx={{ mb: 2 }}>
                {setupStatus.message}
              </Alert>
            )}
            {/* Nested resizable panels for AppInfo, Cookies, and IPCMonitor */}
            <Box sx={{ flexGrow: 1, minHeight: 0, display: 'flex', height: '100%' }}>
              <PanelGroup direction="horizontal">
                {/* Left column: AppInfo and Cookies (vertical split) */}
                <Panel defaultSize={50} minSize={20}>
                  <PanelGroup direction="vertical">
                    <Panel defaultSize={30} minSize={20} maxSize={30}>
                      <AppInfo appConfig={selectedApp} />
                    </Panel>
                    <PanelResizeHandle style={{ height: 10, backgroundColor: theme.palette.background.nav }} />
                    <Panel minSize={20}>
                      <Cookies appConfig={selectedAppConfig} />
                    </Panel>
                  </PanelGroup>
                </Panel>
                <PanelResizeHandle style={{ width: 10, backgroundColor: theme.palette.background.nav }} />
                {/* Right column: IPCMonitor */}
                <Panel minSize={20}>
                  <IPCMonitor appConfig={selectedAppConfig} />
                </Panel>
              </PanelGroup>
            </Box>
          </Box>
        </Panel>
      </PanelGroup>

      <Snackbar
        open={!!injectionStatus}
        autoHideDuration={6000}
        onClose={() => setInjectionStatus(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setInjectionStatus(null)} 
          severity={injectionStatus?.type || 'info'}
          sx={{ width: '100%' }}
        >
          {injectionStatus?.message}
        </Alert>
      </Snackbar>

      {/* Modal for configuring injection params */}
      <Dialog open={showConfigModal} onClose={handleConfigCancel}>
        <DialogTitle>Configure Injection Parameters</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 350 }}>
            <TextField
              label="Debug Port"
              type="number"
              value={pendingConfig.debugPort}
              onChange={e => handleConfigFieldChange('debugPort', parseInt(e.target.value) || 10100)}
              fullWidth
            />
            <TextField
              label="Debug Host"
              value={pendingConfig.debugHost}
              onChange={e => handleConfigFieldChange('debugHost', e.target.value)}
              fullWidth
            />
            <TextField
              label="Call Home Host"
              value={pendingConfig.callHomeHost}
              onChange={e => handleConfigFieldChange('callHomeHost', e.target.value)}
              fullWidth
            />
            <TextField
              label="Call Home Port"
              type="number"
              value={pendingConfig.callHomePort}
              onChange={e => handleConfigFieldChange('callHomePort', parseInt(e.target.value) || 5666)}
              fullWidth
            />
            <TextField
              label="Call Home Interval (ms)"
              type="number"
              value={pendingConfig.callHomeInterval}
              onChange={e => handleConfigFieldChange('callHomeInterval', parseInt(e.target.value) || 60000)}
              fullWidth
            />
            <TextField
              label="Job Timeout (ms)"
              type="number"
              value={pendingConfig.jobTimeout}
              onChange={e => handleConfigFieldChange('jobTimeout', parseInt(e.target.value) || 10000)}
              fullWidth
            />
            <FormControlLabel
              control={
                <Switch
                  checked={!!pendingConfig.enableCallHome}
                  onChange={e => handleConfigFieldChange('enableCallHome', e.target.checked)}
                />
              }
              label="Enable Call Home"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleConfigCancel} color="secondary">Cancel</Button>
          <Button onClick={handleConfigSave} color="primary" variant="contained">Save</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}