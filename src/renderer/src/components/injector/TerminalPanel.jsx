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

const TerminalPanel = ({
  payloads,
  selectedPayload,
  setSelectedPayload,
  handleSendPayload,
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
  const outputEndRef = useRef(null);

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

  // Execute code
  const handleExecuteCode = useCallback(async () => {
    if (!appConfig) {
      setConsoleOutput(prev => [...prev, {
        type: 'error',
        command: consoleInput,
        output: 'Please select an app first'
      }]);
      return;
    }

    if (!isAppOnline(appConfig.uuid)) {
      setConsoleOutput(prev => [...prev, {
        type: 'error',
        command: consoleInput,
        output: 'Selected app is offline'
      }]);
      return;
    }

    try {
      // Add to history
      const newHistory = [consoleInput, ...consoleHistory.filter(cmd => cmd !== consoleInput)].slice(0, 100);
      setConsoleHistory(newHistory);
      setConsoleHistoryIndex(-1);
      localStorage.setItem('consoleHistory', JSON.stringify(newHistory));

      // Add command to output with pending status
      setConsoleOutput(prev => [...prev, { 
        command: consoleInput,
        status: 'pending',
        output: 'Executing...'
      }]);

      // Encode code in base64
      const encodedData = btoa(consoleInput);

      console.log('🔍 Debug - Sending code via direct fetch:', {
        url: `http://${appConfig.ip}:${appConfig.port}/console`,
        codeLength: consoleInput.length,
        encodedLength: encodedData.length
      });

      const response = await fetch(`http://${appConfig.ip}:${appConfig.port}/console`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Origin': `http://${appConfig.ip}:${appConfig.port}`
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
      const resultData = await fetchResult(result.jobId, appConfig);

      // Update the last output entry with the result
      setConsoleOutput(prev => {
        const newOutput = [...prev];
        const lastEntry = newOutput[newOutput.length - 1];
        if (lastEntry && lastEntry.command === consoleInput) {
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

      // Clear input
      setConsoleInput('');
    } catch (error) {
      console.error('Failed to execute code:', error);
      // Update the last output entry with the error
      setConsoleOutput(prev => {
        const newOutput = [...prev];
        const lastEntry = newOutput[newOutput.length - 1];
        if (lastEntry && lastEntry.command === consoleInput) {
          lastEntry.status = 'error';
          lastEntry.output = error.message || 'An unknown error occurred';
        }
        return newOutput;
      });
    }
  }, [
    appConfig,
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
  const fetchResult = async (jobId, appConfig, maxAttempts = 5) => {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        console.log(`🔍 Debug - Fetching result for job ${jobId} (attempt ${attempt + 1}/${maxAttempts})`);
        const resultResponse = await fetch(`http://${appConfig.ip}:${appConfig.port}/result/${jobId}`);
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
            onChange={(e) => setSelectedPayload(e.target.value)}
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
          disabled={!selectedPayload || !appConfig || !isAppOnline(appConfig.uuid)}
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
                  color: theme.palette.text.primary,
                  fontWeight: 'bold',
                  mb: 0.5,
                }}
              >
                &gt; {entry.command}
              </Typography>
            )}
            <Typography
              component="div"
              sx={{
                color: entry.type === 'error' ? 'error.main' : 
                       entry.type === 'success' ? 'success.main' : 
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
          disabled={!appConfig || !isAppOnline(appConfig.uuid)}
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
                onClick={handleExecuteCode}
                disabled={!consoleInput || !appConfig || !isAppOnline(appConfig.uuid)}
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