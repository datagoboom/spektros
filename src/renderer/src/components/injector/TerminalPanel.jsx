import React, { useCallback, useEffect, useRef } from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  IconButton,
  Tooltip,
  Divider,
} from '@mui/material';
import {
  Send as SendIcon,
  Clear as ClearIcon,
  History as HistoryIcon,
  Code as CodeIcon,
} from '@mui/icons-material';
import { useConnectedApps } from '../../contexts/ConnectedAppContext';
import { useInjector } from '../../contexts/InjectorContext';
import payloads from './Payloads';

const TerminalPanel = ({
  selectedPayload,
  setSelectedPayload,
  consoleInput,
  setConsoleInput,
  consoleOutput,
  setConsoleOutput,
  consoleHistory,
  consoleHistoryIndex,
  setConsoleHistory,
  setConsoleHistoryIndex,
  theme,
  isSending,
  selectedProcess,
  setSelectedProcess,
  appConfig,
}) => {
  const { isAppOnline } = useConnectedApps();
  const { selectedApp } = useInjector();
  const outputEndRef = useRef(null);

  // Use appConfig or selectedApp, similar to Cookies.jsx
  const config = appConfig || selectedApp;

  // Scroll to bottom of output
  const scrollToBottom = () => {
    outputEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [consoleOutput]);

  // Handle input changes
  const handleInputChange = (event) => {
    setConsoleInput(event.target.value);
  };

  // Handle key press
  const handleKeyPress = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleExecuteCode();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (consoleHistoryIndex < consoleHistory.length - 1) {
        setConsoleHistoryIndex(prev => prev + 1);
        setConsoleInput(consoleHistory[consoleHistoryIndex + 1]);
      }
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (consoleHistoryIndex > -1) {
        setConsoleHistoryIndex(prev => prev - 1);
        setConsoleInput(consoleHistoryIndex === 0 ? '' : consoleHistory[consoleHistoryIndex - 1]);
      }
    }
  };

  // Handle payload selection
  const handlePayloadSelect = (event) => {
    setSelectedPayload(event.target.value);
  };

  // Handle sending payload
  const handleSendPayload = async () => {
    if (selectedPayload) {
      const payload = payloads.find(p => p.name === selectedPayload);
      if (payload) {
        // Set the process type based on the payload
        setSelectedProcess(payload.process);
        // Execute the static payload code with the payload name for display
        handleExecuteCode(payload.code, payload.name);
      }
    }
  };

  // Execute code
  const handleExecuteCode = useCallback(async (codeToExecute = consoleInput, displayName = null) => {
    if (!config) {
      setConsoleOutput(prev => [...prev, {
        type: 'error',
        command: displayName || codeToExecute,
        isPayload: !!displayName,
        output: 'Please select an app first'
      }]);
      return;
    }

    if (!isAppOnline(config.uuid)) {
      setConsoleOutput(prev => [...prev, {
        type: 'error',
        command: displayName || codeToExecute,
        isPayload: !!displayName,
        output: 'Selected app is offline'
      }]);
      return;
    }

    try {
      // Add to history (only add custom commands to history)
      if (!displayName) {
        const newHistory = [codeToExecute, ...consoleHistory.filter(cmd => cmd !== codeToExecute)].slice(0, 100);
        setConsoleHistory(newHistory);
        setConsoleHistoryIndex(-1);
        localStorage.setItem('consoleHistory', JSON.stringify(newHistory));
      }

      // Add command to output with pending status
      setConsoleOutput(prev => [...prev, { 
        command: displayName || codeToExecute,
        isPayload: !!displayName,
        status: 'pending',
        output: 'Executing...'
      }]);

      // Encode code in base64
      const encodedData = btoa(codeToExecute);

      console.log('🔍 Debug - Sending code via direct fetch:', {
        url: `http://${config.ip}:${config.port}/console`,
        codeLength: codeToExecute.length,
        encodedLength: encodedData.length
      });

      const response = await fetch(`http://${config.ip}:${config.port}/console`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Origin': `http://${config.ip}:${config.port}`
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
        if (lastEntry && lastEntry.command === (displayName || codeToExecute)) {
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

      // Clear input if this was from the console input
      if (codeToExecute === consoleInput) {
        setConsoleInput('');
      }
    } catch (error) {
      console.error('Failed to execute code:', error);
      // Update the last output entry with the error
      setConsoleOutput(prev => {
        const newOutput = [...prev];
        const lastEntry = newOutput[newOutput.length - 1];
        if (lastEntry && lastEntry.command === (displayName || codeToExecute)) {
          lastEntry.status = 'error';
          lastEntry.output = error.message || 'An unknown error occurred';
        }
        return newOutput;
      });
    }
  }, [
    config,
    consoleInput,
    consoleHistory,
    selectedProcess,
    setConsoleHistory,
    setConsoleHistoryIndex,
    setConsoleOutput,
    setConsoleInput,
    isAppOnline
  ]);

  // Fetch result with polling
  const fetchResult = async (jobId, maxAttempts = 5) => {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        console.log(`🔍 Debug - Fetching result for job ${jobId} (attempt ${attempt + 1}/${maxAttempts})`);
        const resultResponse = await fetch(`http://${config.ip}:${config.port}/result/${jobId}`);
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

  // Clear console output
  const handleClearOutput = () => {
    setConsoleOutput([]);
  };

  return (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100%',
      gap: 2
    }}>
      {/* Payload Selection */}
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel id="payload-select-label">Select Payload</InputLabel>
          <Select
            labelId="payload-select-label"
            value={selectedPayload || ''}
            label="Select Payload"
            onChange={handlePayloadSelect}
          >
            {payloads.map((payload) => (
              <MenuItem key={payload.name} value={payload.name}>
                {payload.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Button
          variant="contained"
          startIcon={<CodeIcon />}
          onClick={handleSendPayload}
          disabled={!selectedPayload || !config || !isAppOnline(config.uuid)}
        >
          Send Payload
        </Button>
      </Box>

      {/* Process Selection */}
      <FormControl size="small" sx={{ minWidth: 200 }}>
        <InputLabel id="process-select-label">Target Process</InputLabel>
        <Select
          labelId="process-select-label"
          value={selectedProcess}
          label="Target Process"
          onChange={(e) => setSelectedProcess(e.target.value)}
        >
          <MenuItem value="main">Main Process</MenuItem>
          <MenuItem value="renderer">Renderer Process</MenuItem>
        </Select>
      </FormControl>

      {/* Console Output */}
      <Paper
        variant="outlined"
        sx={{
          flexGrow: 1,
          p: 2,
          backgroundColor: theme.palette.background.paper,
          overflow: 'auto',
          fontFamily: 'monospace',
          fontSize: '0.875rem',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {consoleOutput.map((entry, index) => (
          <Box key={index} sx={{ mb: 1 }}>
            {entry.command && (
              <Typography
                component="div"
                sx={{
                  color: entry.isPayload ? theme.palette.color.yellow : theme.palette.color.cyan,
                  fontWeight: 'bold',
                  mb: 0.5,
                }}
              >
                &gt; {entry.isPayload ? `(${entry.command})` : entry.command}
              </Typography>
            )}
            <Typography
              component="div"
              sx={{
                color: entry.status === 'error' ? theme.palette.color.red : 
                       entry.status === 'success' ? theme.palette.text.primary :
                       theme.palette.text.secondary,
                fontFamily: 'monospace',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {entry.output}
            </Typography>
          </Box>
        ))}
        <div ref={outputEndRef} />
      </Paper>

      {/* Console Input */}
      <Box sx={{ display: 'flex', gap: 1 }}>
        <TextField
          fullWidth
          multiline
          maxRows={4}
          value={consoleInput}
          onChange={handleInputChange}
          onKeyDown={handleKeyPress}
          placeholder="Enter JavaScript code to execute..."
          disabled={!config || !isAppOnline(config.uuid)}
          sx={{
            '& .MuiOutlinedInput-root': {
              backgroundColor: theme.palette.background.paper,
            },
          }}
        />
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Tooltip title="Send (Enter)">
            <span>
              <IconButton
                color="primary"
                onClick={() => handleExecuteCode()}
                disabled={!consoleInput || !config || !isAppOnline(config.uuid)}
              >
                <SendIcon />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Clear Output">
            <IconButton
              color="secondary"
              onClick={handleClearOutput}
              disabled={consoleOutput.length === 0}
            >
              <ClearIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
    </Box>
  );
};

export default TerminalPanel; 