// this component will be connected to the backend to perform search operations across the codebase
// we will not connect it to the backend for now, we just want to show the UI

import React, { useState, useCallback } from 'react';
import { 
    Container, 
    TextField, 
    Box, 
    IconButton, 
    Typography,
    Collapse,
    List,
    ListItem,
    ListItemText,
    ListItemIcon,
    Divider,
    Tooltip,
    Menu,
    MenuItem,
    Checkbox,
    FormControlLabel,
    CircularProgress,
    Alert
} from '@mui/material';
import { 
    Search as SearchIcon,
    FormatSize as CaseSensitiveIcon,
    TextFormat as TextFormatIcon,
    Code as RegexIcon,
    MoreVert as MoreVertIcon,
    ExpandMore as ExpandMoreIcon,
    ExpandLess as ExpandLessIcon,
    FindReplace as ReplaceIcon,
    Folder as FolderIcon,
    InsertDriveFile as FileIcon
} from '@mui/icons-material';
import { useTheme } from '../../theme';
import { useApi } from '../../contexts/ApiContext';
import { useAnalysis } from '../../contexts/AnalysisContext';
import Highlighter from 'react-highlight-words';

// Mock search results for now
const mockSearchResults = {
    'src/components/Button.jsx': [
        { line: 12, content: 'const Button = ({ children, variant = \'primary\' }) => {' },
        { line: 15, content: '  return <button className={variant}>{children}</button>;' }
    ],
    'src/components/Card.jsx': [
        { line: 8, content: 'const Card = ({ title, children }) => {' },
        { line: 10, content: '  return <div className="card">{children}</div>;' }
    ]
};

export default function SearchTools() {
    const theme = useTheme();
    const { searchFiles, replaceInFiles } = useApi();
    const { tmpDir, fileTree, isLoading: isAnalysisLoading } = useAnalysis();
    const [searchQuery, setSearchQuery] = useState('');
    const [showReplace, setShowReplace] = useState(false);
    const [replaceQuery, setReplaceQuery] = useState('');
    const [options, setOptions] = useState({
        matchCase: false,
        matchWholeWord: false,
        useRegex: false
    });
    const [expandedFiles, setExpandedFiles] = useState({});
    const [anchorEl, setAnchorEl] = useState(null);
    const [searchResults, setSearchResults] = useState({});
    const [isSearching, setIsSearching] = useState(false);
    const [searchStats, setSearchStats] = useState(null);
    const [error, setError] = useState(null);

    const handleSearch = useCallback(async () => {
        if (!searchQuery.trim()) {
            setError('Please enter a search query');
            return;
        }

        if (!tmpDir) {
            setError('No ASAR file is currently loaded. Please load an ASAR file first.');
            return;
        }

        if (isAnalysisLoading) {
            setError('Please wait for the file tree to finish loading');
            return;
        }

        setError(null);
        setIsSearching(true);
        try {
            const results = await searchFiles(
                tmpDir,
                searchQuery,
                {
                    matchCase: options.matchCase,
                    matchWholeWord: options.matchWholeWord,
                    useRegex: options.useRegex,
                    excludePatterns: ['node_modules/**', '*.min.js', '*.bundle.js']
                }
            );

            setSearchResults(results.results);
            setSearchStats({
                totalMatches: results.totalMatches,
                fileCount: results.fileCount,
                searchTime: results.searchTime
            });
        } catch (error) {
            console.error('Search failed:', error);
            setError(error.message || 'Search failed. Please try again.');
        } finally {
            setIsSearching(false);
        }
    }, [searchQuery, options, tmpDir, isAnalysisLoading, searchFiles]);

    const handleReplace = useCallback(async () => {
        if (!searchQuery.trim() || !replaceQuery.trim()) {
            setError('Please enter both search and replace text');
            return;
        }

        if (!tmpDir) {
            setError('No ASAR file is currently loaded. Please load an ASAR file first.');
            return;
        }

        if (isAnalysisLoading) {
            setError('Please wait for the file tree to finish loading');
            return;
        }

        setError(null);
        try {
            const results = await replaceInFiles(
                tmpDir,
                searchQuery,
                replaceQuery,
                {
                    matchCase: options.matchCase,
                    matchWholeWord: options.matchWholeWord,
                    useRegex: options.useRegex,
                    excludePatterns: ['node_modules/**', '*.min.js', '*.bundle.js']
                }
            );

            // Refresh search results after replace
            await handleSearch();
            
            // Show success message
            setError({
                type: 'success',
                message: `Successfully replaced ${results.totalReplacements} occurrences in ${results.filesModified} files`
            });
        } catch (error) {
            console.error('Replace failed:', error);
            setError(error.message || 'Replace failed. Please try again.');
        }
    }, [searchQuery, replaceQuery, options, tmpDir, isAnalysisLoading, replaceInFiles, handleSearch]);

    const handleSearchChange = (event) => {
        setSearchQuery(event.target.value);
    };

    const handleReplaceChange = (event) => {
        setReplaceQuery(event.target.value);
    };

    const toggleOption = (option) => {
        setOptions(prev => ({
            ...prev,
            [option]: !prev[option]
        }));
    };

    const toggleFileExpansion = (filePath) => {
        setExpandedFiles(prev => ({
            ...prev,
            [filePath]: !prev[filePath]
        }));
    };

    const handleOptionsMenuOpen = (event) => {
        setAnchorEl(event.currentTarget);
    };

    const handleOptionsMenuClose = () => {
        setAnchorEl(null);
    };

    // Handle Enter key press in search field
    const handleSearchKeyPress = (event) => {
        if (event.key === 'Enter') {
            handleSearch();
        }
    };

    return (
        <Container
            maxWidth={false}
            disableGutters
            sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: theme.palette.background.paper,
                color: theme.palette.text.primary,
            }}
        >
            {/* Search Box */}
            <Box sx={{ p: 2, borderBottom: 1, borderColor: theme.palette.background.nav }}>
                {error && (
                    <Alert 
                        severity={error.type === 'success' ? 'success' : 'error'}
                        sx={{ mb: 2 }}
                        onClose={() => setError(null)}
                    >
                        {error.message || error}
                    </Alert>
                )}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <TextField
                        fullWidth
                        size="small"
                        placeholder="Search"
                        value={searchQuery}
                        onChange={handleSearchChange}
                        onKeyPress={handleSearchKeyPress}
                        disabled={!tmpDir || isAnalysisLoading}
                        InputProps={{
                            startAdornment: (
                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                    <SearchIcon sx={{ color: theme.palette.text.secondary, mr: 1 }} />
                                    {isSearching && (
                                        <CircularProgress size={16} sx={{ mr: 1 }} />
                                    )}
                                </Box>
                            ),
                        }}
                        sx={{
                            '& .MuiOutlinedInput-root': {
                                backgroundColor: theme.palette.background.default,
                                '& fieldset': {
                                    borderColor: theme.palette.background.nav,
                                },
                                '&:hover fieldset': {
                                    borderColor: theme.palette.text.secondary,
                                },
                            },
                        }}
                    />
                    <Tooltip title="Match Case">
                        <IconButton 
                            size="small"
                            onClick={() => toggleOption('matchCase')}
                            sx={{ 
                                color: options.matchCase ? theme.palette.primary.main : theme.palette.text.secondary 
                            }}
                        >
                            <CaseSensitiveIcon />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Match Whole Word">
                        <IconButton 
                            size="small"
                            onClick={() => toggleOption('matchWholeWord')}
                            sx={{ 
                                color: options.matchWholeWord ? theme.palette.primary.main : theme.palette.text.secondary 
                            }}
                        >
                            <TextFormatIcon />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Use Regular Expression">
                        <IconButton 
                            size="small"
                            onClick={() => toggleOption('useRegex')}
                            sx={{ 
                                color: options.useRegex ? theme.palette.primary.main : theme.palette.text.secondary 
                            }}
                        >
                            <RegexIcon />
                        </IconButton>
                    </Tooltip>
                    <IconButton size="small" onClick={handleOptionsMenuOpen}>
                        <MoreVertIcon sx={{ color: theme.palette.text.secondary }} />
                    </IconButton>
                </Box>

                {/* Replace Box */}
                <Collapse in={showReplace}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                        <TextField
                            fullWidth
                            size="small"
                            placeholder="Replace"
                            value={replaceQuery}
                            onChange={handleReplaceChange}
                            InputProps={{
                                startAdornment: <ReplaceIcon sx={{ color: theme.palette.text.secondary, mr: 1 }} />,
                            }}
                            sx={{
                                '& .MuiOutlinedInput-root': {
                                    backgroundColor: theme.palette.background.default,
                                    '& fieldset': {
                                        borderColor: theme.palette.background.nav,
                                    },
                                    '&:hover fieldset': {
                                        borderColor: theme.palette.text.secondary,
                                    },
                                },
                            }}
                        />
                        <Tooltip title="Replace All">
                            <IconButton 
                                size="small"
                                onClick={handleReplace}
                                disabled={!searchQuery.trim() || !replaceQuery.trim()}
                            >
                                <ReplaceIcon sx={{ color: theme.palette.text.secondary }} />
                            </IconButton>
                        </Tooltip>
                    </Box>
                </Collapse>

                {/* Search Stats */}
                {searchStats && (
                    <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Typography variant="caption" color="text.secondary">
                            {searchStats.totalMatches} matches in {searchStats.fileCount} files
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            Search completed in {searchStats.searchTime}ms
                        </Typography>
                    </Box>
                )}
            </Box>

            {/* Search Results */}
            <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
                <List sx={{ p: 0 }}>
                    {Object.entries(searchResults).map(([filePath, fileResult]) => (
                        <React.Fragment key={filePath}>
                            <ListItem
                                button
                                onClick={() => toggleFileExpansion(filePath)}
                                sx={{
                                    backgroundColor: theme.palette.background.default,
                                    '&:hover': {
                                        backgroundColor: theme.palette.background.sidebar,
                                    },
                                }}
                            >
                                <ListItemIcon>
                                    {expandedFiles[filePath] ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                                </ListItemIcon>
                                <ListItemIcon>
                                    <FileIcon sx={{ color: theme.palette.text.secondary }} />
                                </ListItemIcon>
                                <ListItemText 
                                    primary={filePath}
                                    secondary={`${fileResult.matchCount} matches`}
                                    primaryTypographyProps={{
                                        sx: { color: theme.palette.text.primary }
                                    }}
                                    secondaryTypographyProps={{
                                        sx: { color: theme.palette.text.secondary }
                                    }}
                                />
                            </ListItem>
                            <Collapse in={expandedFiles[filePath]}>
                                <List component="div" disablePadding>
                                    {fileResult.matches.map((match, index) => (
                                        <ListItem
                                            key={index}
                                            sx={{
                                                pl: 4,
                                                '&:hover': {
                                                    backgroundColor: theme.palette.background.sidebar,
                                                },
                                            }}
                                        >
                                            <ListItemText
                                                primary={
                                                    <Typography
                                                        component="span"
                                                        sx={{
                                                            color: theme.palette.text.secondary,
                                                            fontSize: '0.875rem',
                                                        }}
                                                    >
                                                        {match.line}:
                                                    </Typography>
                                                }
                                                secondary={
                                                    <Typography
                                                        component="span"
                                                        sx={{
                                                            color: theme.palette.text.primary,
                                                            fontSize: '0.875rem',
                                                            fontFamily: 'monospace',
                                                        }}
                                                    >
                                                        <Highlighter
                                                            highlightClassName="search-highlight"
                                                            searchWords={[searchQuery]}
                                                            autoEscape={true}
                                                            textToHighlight={match.content}
                                                            caseSensitive={options.matchCase}
                                                            highlightStyle={{
                                                                backgroundColor: theme.palette.warning.main,
                                                                color: theme.palette.warning.contrastText,
                                                                padding: '0 2px',
                                                                borderRadius: '2px',
                                                            }}
                                                        />
                                                    </Typography>
                                                }
                                            />
                                        </ListItem>
                                    ))}
                                </List>
                            </Collapse>
                        </React.Fragment>
                    ))}
                </List>
            </Box>

            {/* Options Menu */}
            <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleOptionsMenuClose}
                sx={{
                    '& .MuiPaper-root': {
                        backgroundColor: theme.palette.background.paper,
                        color: theme.palette.text.primary,
                    },
                }}
            >
                <MenuItem>
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={showReplace}
                                onChange={() => setShowReplace(!showReplace)}
                                sx={{
                                    color: theme.palette.text.secondary,
                                    '&.Mui-checked': {
                                        color: theme.palette.primary.main,
                                    },
                                }}
                            />
                        }
                        label="Show Replace"
                    />
                </MenuItem>
                <MenuItem>
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={options.matchCase}
                                onChange={() => toggleOption('matchCase')}
                                sx={{
                                    color: theme.palette.text.secondary,
                                    '&.Mui-checked': {
                                        color: theme.palette.primary.main,
                                    },
                                }}
                            />
                        }
                        label="Match Case"
                    />
                </MenuItem>
                <MenuItem>
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={options.matchWholeWord}
                                onChange={() => toggleOption('matchWholeWord')}
                                sx={{
                                    color: theme.palette.text.secondary,
                                    '&.Mui-checked': {
                                        color: theme.palette.primary.main,
                                    },
                                }}
                            />
                        }
                        label="Match Whole Word"
                    />
                </MenuItem>
                <MenuItem>
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={options.useRegex}
                                onChange={() => toggleOption('useRegex')}
                                sx={{
                                    color: theme.palette.text.secondary,
                                    '&.Mui-checked': {
                                        color: theme.palette.primary.main,
                                    },
                                }}
                            />
                        }
                        label="Use Regular Expression"
                    />
                </MenuItem>
            </Menu>
        </Container>
    );
}