import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  FormControl,
  Select,
  MenuItem,
  CircularProgress,
  TextField
} from '@mui/material';
import { PlayArrow as PlayIcon } from '@mui/icons-material';
import PendingIcon from '@mui/icons-material/Pending';
import CheckIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';

export default function TerminalPanel({
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
  appConfig
}) {
  const handleSend = async (code) => {
    if (!appConfig?.ip || !appConfig?.port) {
      alert('App is missing IP or port information.');
      return;
    }

    console.log('Sending code:', code); // Debug log

    // Add command to output with pending status
    const newOutput = [...consoleOutput, { 
      command: code,
      status: 'pending',
      output: 'Executing...'
    }];
    console.log('Setting new output:', newOutput); // Debug log
    setConsoleOutput(newOutput);

    try {
      const encodedData = window.btoa(unescape(encodeURIComponent(code)));
      console.log('Sending request to:', `http://${appConfig.ip}:${appConfig.port}/console`); // Debug log
      
      // Get the process from the selected payload if it exists
      const selectedPayloadObj = payloads.find(p => p.name === selectedPayload);
      const processToUse = selectedPayloadObj ? selectedPayloadObj.process : selectedProcess;
      
      console.log('Using process:', processToUse); // Debug log
      
      const response = await fetch(`http://${appConfig.ip}:${appConfig.port}/console`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Origin': `http://${appConfig.ip}:${appConfig.port}`
        },
        body: JSON.stringify({
          data: encodedData,
          process: processToUse
        }),
        mode: 'cors',
        credentials: 'omit'
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('Received response:', result); // Debug log
      
      if (!result.jobId) {
        throw new Error('No job ID received from server');
      }

      // Poll for the result
      let attempts = 0;
      const maxAttempts = 10;
      const pollInterval = 1000; // 1 second

      const pollResult = async () => {
        try {
          console.log('Polling for result, attempt:', attempts + 1); // Debug log
          const resultResponse = await fetch(`http://${appConfig.ip}:${appConfig.port}/result/${result.jobId}`);
          const resultText = await resultResponse.text();
          console.log('Received result text:', resultText); // Debug log

          if (!resultText) {
            throw new Error('Empty result received');
          }

          const resultData = JSON.parse(resultText);
          console.log('Parsed result data:', resultData); // Debug log

          if (resultData.error) {
            console.log('Error in result:', resultData.error); // Debug log
            setConsoleOutput(prev => {
              const newOutput = [...prev];
              const lastEntry = newOutput[newOutput.length - 1];
              if (lastEntry && lastEntry.command === code) {
                lastEntry.status = 'error';
                lastEntry.output = `${resultData.error}\n\n${resultData.stack || ''}`;
              }
              return newOutput;
            });
            return;
          }

          if (resultData.status === 'pending' && attempts < maxAttempts) {
            attempts++;
            setTimeout(pollResult, pollInterval);
            return;
          }

          console.log('Updating console output with success result'); // Debug log
          setConsoleOutput(prev => {
            const newOutput = [...prev];
            const lastEntry = newOutput[newOutput.length - 1];
            if (lastEntry && lastEntry.command === code) {
              lastEntry.status = 'success';
              lastEntry.output = JSON.stringify(resultData.result, null, 2);
            }
            return newOutput;
          });
        } catch (error) {
          console.error('Error in pollResult:', error); // Debug log
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
      };

      // Start polling
      pollResult();
    } catch (error) {
      console.error('Error in handleSend:', error); // Debug log
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
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Pre-built Payloads Section */}
      <Card sx={{ mb: 4, backgroundColor: theme.palette.background.content }}>
        <CardContent sx={{ p: 2, '&:last-child': { pb: 8 } }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="subtitle2" sx={{ color: theme.palette.text.primary }}>
                Pre-built Payloads
              </Typography>
              <FormControl size="small" sx={{ minWidth: 300 }}>
                <Select
                  value={selectedPayload}
                  onChange={e => setSelectedPayload(e.target.value)}
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
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <Select
                  value={selectedProcess}
                  onChange={e => setSelectedProcess(e.target.value)}
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
              <Button
                variant="contained"
                size="small"
                onClick={() => {
                  const payload = payloads.find(p => p.name === selectedPayload);
                  if (payload) handleSend(payload.code);
                }}
                disabled={!selectedPayload || isSending}
                sx={{
                  backgroundColor: theme.palette.color.cyan,
                  '&:hover': {
                    backgroundColor: theme.palette.color.cyanDark,
                  },
                }}
                startIcon={<PlayIcon />}
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
                      content: '" > "',
                      color: theme.palette.color.blue,
                    }
                  }}>
                    {entry.command}
                  </Box>
                  {entry.status === 'pending' && (
                    <CircularProgress size={16} sx={{ color: theme.palette.color.yellow }} />
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
        alignItems: 'flex-start',
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
            content: '" > "',
            color: theme.palette.color.blue,
          }
        }} />
        <TextField
          fullWidth
          multiline
          maxRows={4}
          placeholder="Enter JavaScript code to execute..."
          value={consoleInput}
          onChange={e => setConsoleInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              if (consoleInput.trim()) {
                handleSend(consoleInput);
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
  );
} 