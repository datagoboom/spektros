import { Container, Box, Typography } from '@mui/material';
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
    Image
} from '@mui/icons-material';
import { useTheme } from '../../theme';
import { useAnalysis } from '../../contexts/AnalysisContext';

// Map file types to icons
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

// Convert flat file tree to nested structure
const buildTreeFromFiles = (files) => {
    // Add safety check for undefined/null files
    if (!files || !Array.isArray(files)) {
        console.log('Files is not an array:', files);
        return [];
    }

    if (files.length === 0) {
        return [];
    }

    const tree = [];
    const pathMap = new Map();

    // Sort files by relative path for consistent tree building
    files.sort((a, b) => {
        const pathA = a?.relativePath || '';
        const pathB = b?.relativePath || '';
        return pathA.localeCompare(pathB);
    });

    files.forEach(file => {
        // Safety check for file structure
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

// Helper function to find an item by ID in the tree
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

export default function FileTree({ onFileSelect }) {
    const theme = useTheme();
    const { fileTree, isLoading } = useAnalysis();
    
    console.log('FileTree render - fileTree:', fileTree, 'isLoading:', isLoading);
    
    // Build tree data with safety checks
    const treeData = buildTreeFromFiles(fileTree);
    
    console.log('Built treeData:', treeData);

    // Show loading state
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

    // Show empty state
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

    // Show tree
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
            {treeData.length > 0 ? (
                <RichTreeView
                    items={treeData}
                    defaultExpanded={['root']}
                    onItemClick={(event, itemId) => {
                        console.log('Tree item clicked:', itemId);
                        // Only trigger for files (items without children)
                        const item = findItemById(treeData, itemId);
                        console.log('Found item:', item);
                        
                        if (item && !item.children && item.data) {
                            console.log('Calling onFileSelect with path:', item.data.path);
                            if (onFileSelect) {
                                onFileSelect(item.data.path);
                            }
                        } else {
                            console.log('Item not selected because:', {
                                hasItem: !!item,
                                hasChildren: !!item?.children,
                                hasData: !!item?.data
                            });
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
            )}
        </Container>
    );
}