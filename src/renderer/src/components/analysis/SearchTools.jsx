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
    CircularProgress
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
    const { searchFiles, replaceInFiles, currentAsarInfo } = useApi();
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

    const handleSearch = useCallback(async () => {
        if (!searchQuery.trim() || !currentAsarInfo?.tmpDir) return;

        setIsSearching(true);
        try {
            const results = await searchFiles(
                currentAsarInfo.tmpDir,
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
            // TODO: Show error notification
        } finally {
            setIsSearching(false);
        }
    }, [searchQuery, options, currentAsarInfo, searchFiles]);

    const handleReplace = useCallback(async () => {
        if (!searchQuery.trim() || !replaceQuery.trim() || !currentAsarInfo?.tmpDir) return;

        try {
            const results = await replaceInFiles(
                currentAsarInfo.tmpDir,
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
            
            // TODO: Show success notification with results
            console.log('Replace completed:', results);
        } catch (error) {
            console.error('Replace failed:', error);
            // TODO: Show error notification
        }
    }, [searchQuery, replaceQuery, options, currentAsarInfo, replaceInFiles, handleSearch]);

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

    const handleResultClick = (filePath, line) => {
        // TODO: Implement file navigation
        console.log(`Navigate to ${filePath}:${line}`);
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
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <TextField
                        fullWidth
                        size="small"
                        placeholder="Search"
                        value={searchQuery}
                        onChange={handleSearchChange}
                        onKeyPress={handleSearchKeyPress}
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
                                            button
                                            onClick={() => handleResultClick(filePath, match.line)}
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
                                                        }}
                                                        dangerouslySetInnerHTML={{ __html: match.highlighted }}
                                                    />
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