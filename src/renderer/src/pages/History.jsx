import React, { useMemo } from 'react';
import { useInjector } from '../contexts/InjectorContext';
import { useCodeEditor } from '../contexts/CodeEditorContext';
import { useApi } from '../contexts/ApiContext';
import { useHistory } from '../contexts/HistoryContext';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Stack,
} from '@mui/material';
import {
  Code as CodeIcon,
  Security as SecurityIcon,
  Save as SaveIcon,
  Edit as EditIcon,
  Terminal as TerminalIcon,
  Cookie as CookieIcon,
  Message as MessageIcon,
  Navigation as NavigationIcon,
} from '@mui/icons-material';

const History = () => {
  const { 
    consoleOutput,
    ipcTraffic,
    cookiesData,
    selectedApp,
    asarPath,
    selectedPayload,
  } = useInjector();

  const {
    getUnsavedFiles,
    getAllTrackedFiles,
    getFileState,
    getFocusedFilePath,
    FILE_STATE,
  } = useCodeEditor();

  const {
    currentAsarInfo,
  } = useApi();

  const {
    getBrowserHistory,
  } = useHistory();

  // Generate activity log
  const activityLog = useMemo(() => {
    const activities = [];
    
    // Add console commands
    consoleOutput.forEach((cmd, index) => {
      activities.push({
        id: `console-${index}`,
        timestamp: new Date(),
        action: cmd.command || 'Command executed',
        context: 'Injection',
        icon: <TerminalIcon />,
        status: cmd.status || 'completed',
      });
    });

    // Add IPC messages
    ipcTraffic.forEach((msg, index) => {
      activities.push({
        id: `ipc-${index}`,
        timestamp: new Date(msg.timestamp),
        action: `IPC ${msg.type.replace('ipc_', '')} on ${msg.channel}`,
        context: 'Injection',
        icon: <MessageIcon />,
        status: 'info',
      });
    });

    // Add file operations
    const trackedFiles = getAllTrackedFiles();
    trackedFiles.forEach((file, index) => {
      const state = getFileState(file);
      activities.push({
        id: `file-${index}`,
        timestamp: new Date(),
        action: `Working on ${file.split('/').pop()}`,
        context: 'Analysis',
        icon: state === FILE_STATE.UNSAVED ? <EditIcon /> : <SaveIcon />,
        status: state === FILE_STATE.UNSAVED ? 'warning' : 'success',
      });
    });

    // Add navigation history
    const browserHistory = getBrowserHistory();
    browserHistory.forEach((page, index) => {
      activities.push({
        id: `nav-${index}`,
        timestamp: new Date(),
        action: `Navigated to ${page}`,
        context: 'Navigation',
        icon: <NavigationIcon />,
        status: 'info',
      });
    });

    // Add cookie monitoring if active
    if (cookiesData && cookiesData.cookies) {
      activities.push({
        id: 'cookies',
        timestamp: new Date(cookiesData.timestamp),
        action: `Captured ${cookiesData.cookies.length} cookies`,
        context: 'Injection',
        icon: <CookieIcon />,
        status: 'success',
      });
    }

    // Add ASAR analysis if available
    if (currentAsarInfo) {
      activities.push({
        id: 'asar-analysis',
        timestamp: new Date(currentAsarInfo.setupAt),
        action: `Analyzed ${currentAsarInfo.originalPath.split('/').pop()}`,
        context: 'Analysis',
        icon: <CodeIcon />,
        status: 'success',
      });
    }

    // Add injection setup if available
    if (asarPath) {
      activities.push({
        id: 'injection-setup',
        timestamp: new Date(),
        action: `Setup injection for ${asarPath.split('/').pop()}`,
        context: 'Injection',
        icon: <SecurityIcon />,
        status: 'success',
      });
    }

    // Sort by timestamp (most recent first) and limit to last 50
    return activities
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 50);
  }, [
    consoleOutput, 
    ipcTraffic, 
    cookiesData, 
    getAllTrackedFiles, 
    getFileState, 
    getBrowserHistory, 
    currentAsarInfo, 
    asarPath,
    FILE_STATE
  ]);

  const getContextColor = (context) => {
    switch (context) {
      case 'Analysis':
        return 'primary';
      case 'Injection':
        return 'secondary';
      case 'Navigation':
        return 'default';
      default:
        return 'default';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'success':
      case 'completed':
        return 'success';
      case 'error':
        return 'error';
      case 'warning':
      case 'pending':
        return 'warning';
      default:
        return 'info';
    }
  };

  return (
    <Box sx={{ 
      width: 'calc(100vw - 128px)',
      height: 'calc(100vh - 128px)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      p: 3,
      overflow: 'hidden'
    }}>
      {/* Header */}
      <Box sx={{ mb: 3, textAlign: 'center' }}>
        <Typography variant="h4" gutterBottom>
          Activity History
        </Typography>
        <Typography variant="body2" color="textSecondary">
          Recent actions across all components
        </Typography>
      </Box>

      {/* Activity Table */}
      <Paper sx={{ 
        width: '100%', 
        maxWidth: 1200,
        height: '100%',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <TableContainer sx={{ flexGrow: 1 }}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Time</TableCell>
                <TableCell>Action</TableCell>
                <TableCell>Context</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {activityLog.map((activity) => (
                <TableRow key={activity.id} hover>
                  <TableCell>
                    <Typography variant="body2" color="textSecondary">
                      {activity.timestamp.toLocaleTimeString()}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      {activity.icon}
                      <Typography variant="body2">
                        {activity.action}
                      </Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={activity.context}
                      color={getContextColor(activity.context)}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={activity.status}
                      color={getStatusColor(activity.status)}
                      size="small"
                    />
                  </TableCell>
                </TableRow>
              ))}
              {activityLog.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} sx={{ textAlign: 'center', py: 4 }}>
                    <Typography variant="body2" color="textSecondary">
                      No activity recorded yet. Start using the application to see your history.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
};

export default History;