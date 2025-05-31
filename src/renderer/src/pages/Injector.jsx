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
import { useConnectedApps } from '../contexts/ConnectedAppContext';
import payloads from '../components/injector/Payloads';
import { useApi } from '../contexts/ApiContext';
import { v4 as uuidv4 } from 'uuid';
import TerminalPanel from '../components/injector/TerminalPanel';

export default function Injector() {
  const theme = useTheme();
  const { settings } = useSettings();
  const backgroundColor = settings.themeType === 'light' ? theme.palette.background.paper : theme.palette.color.black;
  
  // Get state and actions from InjectorContext
  const {
    // State
    asarPath, setAsarPath,
    selectedPayload, setSelectedPayload,
    injectionStatus, setInjectionStatus,
    isInjecting, setIsInjecting,
    isSetupComplete, setIsSetupComplete,
    setupStatus, setSetupStatus,
    consoleInput, setConsoleInput,
    consoleOutput, setConsoleOutput,
    consoleHistory, setConsoleHistory,
    consoleHistoryIndex, setConsoleHistoryIndex,
    selectedProcess, setSelectedProcess,
    // Actions
    clearInjectionStatus,
    clearAsarPath,
    clearAll,
  } = useInjector();

  // Get state and actions from ConnectedAppContext
  const {
    apps,
    isListening,
    startListener,
    stopListener,
    checkServerStatus,
    getApp,
    getOnlineApps,
    getOfflineApps,
    isAppOnline,
    clearApps,
  } = useConnectedApps();

  const { 
    injectHook,
    openFileDialog
  } = useApi();

  // Local state that doesn't need to persist between page changes
  const [isSetupLoading, setIsSetupLoading] = React.useState(false);
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
    callHomeInterval: 5000,
    jobTimeout: 10000,
    enableCallHome: true
  });
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [pendingConfig, setPendingConfig] = useState(asarConfig);
  const [useCustomTargetPath, setUseCustomTargetPath] = useState(false);
  const [customTargetPath, setCustomTargetPath] = useState(null);
  const [selectedApp, setSelectedApp] = useState(null);

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
      const result = await openFileDialog();

      console.log('[INJECTOR] File dialog result:', result);
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
  }, [setAsarPath, setIsSetupComplete, setSetupStatus]);

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

      const result = await injectHook(config, customTargetPath);

      if (result.success) {
        setIsSetupComplete(true);
        setSetupStatus({
          type: 'success',
          message: `Setup completed! Hook payload injected.`
        });
        setTimeout(() => setSetupStatus(null), 3000);
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

  // Helper to get next available port
  const getNextAvailablePort = (startPort = 10100) => {
    const usedPorts = new Set(apps.map(app => app.debugPort || app.port));
    let port = startPort;
    while (usedPorts.has(port)) {
      port++;
    }
    return port;
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
        <Panel minSize={30}>
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
                      {isListening ? (
                        <WifiIcon sx={{ color: 'success.main', fontSize: 20 }} />
                      ) : (
                        <WifiOffIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                      )}
                    </Box>
                    <IconButton size="small" onClick={checkServerStatus}>
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
                        const app = apps.find(a => a.uuid === e.target.value);
                        setSelectedApp(app || null);
                      }}
                      displayEmpty
                      sx={{ backgroundColor: theme.palette.background.paper }}
                    >
                      {apps.length === 0 && (
                        <MenuItem value="" disabled>
                          <em>No hooked apps found</em>
                        </MenuItem>
                      )}
                      {apps.map(app => (
                        <MenuItem key={app.uuid} value={app.uuid}>
                          {app.name} ({app.uuid.substring(0, 5)} - {app.ip}:{app.port})
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
              <TerminalPanel
                payloads={payloads}
                selectedPayload={selectedPayload}
                setSelectedPayload={setSelectedPayload}
                handleSendPayload={handleSendPayload}
                consoleInput={consoleInput}
                setConsoleInput={setConsoleInput}
                consoleOutput={consoleOutput}
                setConsoleOutput={setConsoleOutput}
                consoleHistory={consoleHistory}
                consoleHistoryIndex={consoleHistoryIndex}
                setConsoleHistory={setConsoleHistory}
                setConsoleHistoryIndex={setConsoleHistoryIndex}
                theme={theme}
                isSending={isInjecting}
                selectedProcess={selectedProcess}
                setSelectedProcess={setSelectedProcess}
                appConfig={selectedApp}
              />
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
                      <Cookies appConfig={selectedApp} />
                    </Panel>
                  </PanelGroup>
                </Panel>
                <PanelResizeHandle style={{ width: 10, backgroundColor: theme.palette.background.nav }} />
                {/* Right column: IPCMonitor */}
                <Panel minSize={20}>
                  <IPCMonitor appConfig={selectedApp} />
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
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 350, mt: 1 }}>
            <Container sx={{ 
              display: 'flex', 
              flexDirection: 'row', 
              gap: 2, 
              alignItems: 'center', 
            }}>
              <Typography 
                variant="subtitle1" 
                sx={{ color: theme.palette.text.primary, display: 'flex', alignItems: 'center', mb: 0, padding: 0}}
              >
                Use Custom Target Path
              </Typography>
              <Switch
                value="customTargetPath"
                checked={useCustomTargetPath}
                onChange={() => setUseCustomTargetPath(!useCustomTargetPath)}
                sx={{ mb: 0 }}
              />
            </Container>
            { useCustomTargetPath && (
              <TextField
                label="Custom Target Path"
                value={customTargetPath || ''}
                onChange={e => setCustomTargetPath(e.target.value)}
                fullWidth
              />
            )}
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