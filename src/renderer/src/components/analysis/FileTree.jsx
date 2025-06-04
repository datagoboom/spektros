import { Container, Box, Typography, TextField, InputAdornment } from '@mui/material';
import { RichTreeView } from '@mui/x-tree-view/RichTreeView';
import { 
    ExpandMore, 
    ChevronRight, 
    InsertDriveFile, 
    Folder,
    Code,
    Description,
    Settings,
    Security,
    Image,
    Search
} from '@mui/icons-material';
import { useTheme } from '../../theme';
import { useAnalysis } from '../../contexts/AnalysisContext';
import { useState, useMemo } from 'react';


const getFileIcon = (fileType, theme) => {
    switch (fileType) {
        case 'javascript':
        case 'typescript':
        case 'python':
        case 'java':
        case 'cpp':
        case 'c':
        case 'csharp':
        case 'php':
        case 'ruby':
        case 'go':
        case 'rust':
            return <Code sx={{ fontSize: 16, color: theme.palette.text.secondary }} />;
        case 'markdown':
        case 'text':
        case 'restructuredtext':
            return <Description sx={{ fontSize: 16, color: theme.palette.text.secondary }} />;
        case 'json':
        case 'xml':
        case 'yaml':
        case 'toml':
        case 'ini':
            return <Settings sx={{ fontSize: 16, color: theme.palette.text.secondary }} />;
        case 'env':
            return <Security sx={{ fontSize: 16, color: theme.palette.text.secondary }} />;
        case 'image':
            return <Image sx={{ fontSize: 16, color: theme.palette.text.secondary }} />;
        default:
            return <InsertDriveFile sx={{ fontSize: 16, color: theme.palette.text.secondary }} />;
    }
};


const buildTreeFromFiles = (files) => {
    
    if (!files || !Array.isArray(files)) {
        console.log('Files is not an array:', files);
        return [];
    }

    if (files.length === 0) {
        return [];
    }

    const tree = [];
    const pathMap = new Map();

    
    files.sort((a, b) => {
        const pathA = a?.relativePath || '';
        const pathB = b?.relativePath || '';
        return pathA.localeCompare(pathB);
    });

    files.forEach(file => {
        
        if (!file || !file.relativePath) {
            console.warn('Invalid file object:', file);
            return;
        }

        const parts = file.relativePath.split('/');
        let currentPath = '';
        let parentNode = null;

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            const isLast = i === parts.length - 1;
            currentPath = currentPath ? `${currentPath}/${part}` : part;

            if (!pathMap.has(currentPath)) {
                const node = {
                    id: currentPath,
                    label: part,
                    children: !isLast ? [] : undefined,
                    data: isLast ? file : undefined
                };

                if (parentNode) {
                    if (!parentNode.children) {
                        parentNode.children = [];
                    }
                    parentNode.children.push(node);
                } else {
                    tree.push(node);
                }

                pathMap.set(currentPath, node);
            }

            parentNode = pathMap.get(currentPath);
        }
    });

    return tree;
};


function findItemById(items, id) {
    if (!items || !Array.isArray(items)) {
        return null;
    }

    for (const item of items) {
        if (item.id === id) {
            return item;
        }
        if (item.children) {
            const found = findItemById(item.children, id);
            if (found) {
                return found;
            }
        }
    }
    return null;
}


const filterTreeData = (treeData, searchTerm) => {
    if (!searchTerm) return { treeData, flatMatches: [] };

    const searchLower = searchTerm.toLowerCase();
    const flatMatches = [];
    
    const findMatches = (node, currentPath = '') => {
        const fullPath = currentPath ? `${currentPath}/${node.label}` : node.label;
        
        
        if (node.label.toLowerCase().includes(searchLower)) {
            flatMatches.push({
                ...node,
                fullPath
            });
        }

        
        if (node.children) {
            node.children.forEach(child => findMatches(child, fullPath));
        }
    };

    treeData.forEach(node => findMatches(node));
    return { treeData, flatMatches };
};

export default function FileTree({ onFileSelect }) {
    const theme = useTheme();
    const { fileTree, isLoading } = useAnalysis();
    const [searchTerm, setSearchTerm] = useState('');
    
    console.log('FileTree render - fileTree:', fileTree, 'isLoading:', isLoading);
    
    
    const treeData = buildTreeFromFiles(fileTree);
    
    
    const { treeData: filteredTreeData, flatMatches } = useMemo(() => {
        return filterTreeData(treeData, searchTerm);
    }, [treeData, searchTerm]);

    
    if (isLoading) {
        return (
            <Container
                maxWidth={false}
                disableGutters
                sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: '100%',
                    backgroundColor: theme.palette.background.paper,
                }}
            >
                <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                    Loading file tree...
                </Typography>
            </Container>
        );
    }

    
    if (!fileTree || !Array.isArray(fileTree) || fileTree.length === 0) {
        return (
            <Container
                maxWidth={false}
                disableGutters
                sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: '100%',
                    backgroundColor: theme.palette.background.paper,
                    p: 2,
                }}
            >
                <Typography variant="body2" sx={{ color: theme.palette.text.secondary, textAlign: 'center' }}>
                    No files loaded.<br />
                    Extract an ASAR file to view its contents.
                </Typography>
            </Container>
        );
    }

    
    return (
        <Container
            maxWidth={false}
            disableGutters
            id="file-tree"
            sx={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-start',
                alignItems: 'flex-start',
                height: '100%',
                width: '100%',
                backgroundColor: theme.palette.background.paper,
                padding: 2,
                overflowY: 'auto',
                '&::-webkit-scrollbar': {
                    width: '4px',
                },
                '&::-webkit-scrollbar-thumb': {
                    backgroundColor: theme.palette.text.secondary,
                    borderRadius: '4px',
                },
            }}
        >
            {}
            <Box sx={{ width: '100%', mb: 2 }}>
                <TextField
                    fullWidth
                    size="small"
                    placeholder="Filter files..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <Search sx={{ 
                                    fontSize: 16, 
                                    color: theme.palette.text.secondary 
                                }} />
                            </InputAdornment>
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
            </Box>

            {searchTerm ? (
                
                <Box sx={{ width: '100%' }}>
                    {flatMatches.length > 0 ? (
                        flatMatches.map((match, index) => (
                            <Box
                                key={match.id}
                                onClick={() => match.data && onFileSelect(match.data.path)}
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: '4px 8px',
                                    cursor: match.data ? 'pointer' : 'default',
                                    '&:hover': {
                                        backgroundColor: match.data ? theme.palette.background.sidebar : 'transparent',
                                    },
                                    color: theme.palette.text.primary,
                                    fontSize: '13px',
                                }}
                            >
                                <Box sx={{ mr: 1 }}>
                                    {match.data ? (
                                        getFileIcon(match.data.type, theme)
                                    ) : (
                                        <Folder sx={{ 
                                            fontSize: 16,
                                            color: theme.palette.color?.blue || theme.palette.primary.main
                                        }} />
                                    )}
                                </Box>
                                <Typography
                                    sx={{
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                    }}
                                >
                                    {match.fullPath}
                                </Typography>
                            </Box>
                        ))
                    ) : (
                        <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                            No matching files found
                        </Typography>
                    )}
                </Box>
            ) : (
                
                filteredTreeData.length > 0 ? (
                    <RichTreeView
                        items={filteredTreeData}
                        defaultExpanded={['root']}
                        onItemClick={(event, itemId) => {
                            const item = findItemById(filteredTreeData, itemId);
                            if (item && !item.children && item.data) {
                                onFileSelect(item.data.path);
                            }
                        }}
                        slots={{
                            expandIcon: ExpandMore,
                            collapseIcon: ChevronRight,
                        }}
                        slotProps={{
                            expandIcon: {
                                sx: { color: theme.palette.text.secondary }
                            },
                            collapseIcon: {
                                sx: { color: theme.palette.text.secondary }
                            }
                        }}
                        renderItem={(item) => (
                            <Box sx={{ 
                                display: 'flex', 
                                alignItems: 'center',
                                color: theme.palette.text.primary,
                                fontSize: '13px',
                            }}>
                                {item.children ? (
                                    <Folder sx={{ 
                                        fontSize: 16, 
                                        mr: 1,
                                        color: theme.palette.color?.blue || theme.palette.primary.main
                                    }} />
                                ) : (
                                    <Box sx={{ mr: 1 }}>
                                        {getFileIcon(item.data?.type, theme)}
                                    </Box>
                                )}
                                {item.label}
                            </Box>
                        )}
                        sx={{
                            flexGrow: 1,
                            width: '100%',
                            '& .MuiTreeItem-root': {
                                '& .MuiTreeItem-content': {
                                    padding: '2px 0',
                                },
                                '& .MuiTreeItem-content:hover': {
                                    backgroundColor: theme.palette.background.sidebar || theme.palette.action.hover,
                                },
                                '& .MuiTreeItem-content.Mui-selected': {
                                    backgroundColor: `${theme.palette.background.sidebar || theme.palette.action.selected} !important`,
                                },
                                '& .MuiTreeItem-content.Mui-selected:hover': {
                                    backgroundColor: theme.palette.background.sidebar || theme.palette.action.selected,
                                },
                            },
                        }}
                    />
                ) : (
                    <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                        No files to display
                    </Typography>
                )
            )}
        </Container>
    );
}