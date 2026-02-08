import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useConfigStore } from '@/store/configStore';
import { useFileStore } from '@/store/fileStore';
import { downloadedTxtStore, DownloadedFile } from '@/utils/storage';
import { initOSSClient, getParentPath, OSSObject } from '@/utils/oss';
import { formatFileSize, formatDate } from '@/utils/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { 
  Folder, 
  FileText, 
  ArrowLeft, 
  Search, 
  RefreshCw, 
  Trash2, 
  Download, 
  Pencil, 
  Move, 
  Eye,
  MoreVertical,
  ChevronRight
} from 'lucide-react';
import { SwipeableList, SwipeableListItem, SwipeAction, TrailingActions, Type as ListType } from 'react-swipeable-list';
import 'react-swipeable-list/dist/styles.css';

import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
  DrawerClose,
} from "@/components/ui/drawer";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

const FolderPicker = ({ 
  currentPath: initialPath, 
  onSelect, 
  onCancel 
}: { 
  currentPath: string;
  onSelect: (path: string) => void;
  onCancel: () => void;
}) => {
  const { ossConfig } = useConfigStore();
  const [path, setPath] = useState(ossConfig?.rootPath || '');
  const [folders, setFolders] = useState<OSSObject[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchFolders(path);
  }, [path]);

  const fetchFolders = async (dirPath: string) => {
    if (!ossConfig) return;
    setLoading(true);
    try {
      const client = initOSSClient(ossConfig);
      const result = await client.list({
        prefix: dirPath,
        delimiter: '/',
        ['max-keys']: 100,
      }, {});

      const folderList: OSSObject[] = [];
      if (result.prefixes) {
        result.prefixes.forEach((prefix: string) => {
            // Remove the current path from the name to get the display name
            const name = prefix.replace(dirPath, '').replace(/\/$/, '');
            if (name) {
                folderList.push({
                    name: name,
                    url: '',
                    lastModified: '',
                    size: 0,
                    type: 'folder'
                });
            }
        });
      }
      setFolders(folderList);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load folders');
    } finally {
      setLoading(false);
    }
  };

  const handleFolderClick = (folderName: string) => {
    setPath(path + folderName + '/');
  };

  const handleBack = () => {
    const root = ossConfig?.rootPath || '';
    if (path === root) return;
    const parent = getParentPath(path);
    if (root && !parent.startsWith(root) && parent !== root) {
        setPath(root);
    } else {
        setPath(parent);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2 border-b pb-2">
         {path !== (ossConfig?.rootPath || '') && (
            <Button variant="ghost" size="icon" onClick={handleBack} className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
         )}
         <div className="text-sm font-medium truncate flex-1">
            {path || 'Root'}
         </div>
      </div>
      
      <div className="h-[200px] overflow-y-auto space-y-1">
        {loading ? (
            <div className="space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
            </div>
        ) : folders.length === 0 ? (
            <div className="text-center text-muted-foreground text-sm py-4">No subfolders</div>
        ) : (
            folders.map(f => (
                <div 
                    key={f.name}
                    className="flex items-center p-2 hover:bg-accent rounded-md cursor-pointer"
                    onClick={() => handleFolderClick(f.name)}
                >
                    <Folder className="h-4 w-4 mr-2 text-blue-500" />
                    <span className="text-sm truncate flex-1">{f.name}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
            ))
        )}
      </div>

      <div className="flex justify-end space-x-2 pt-2">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onSelect(path)}>Move Here</Button>
      </div>
    </div>
  );
};

const FileManager = () => {
  const navigate = useNavigate();
  const { ossConfig } = useConfigStore();
  const { 
    currentPath, 
    files, 
    isLoading, 
    error, 
    fetchFiles, 
    setCurrentPath, 
    deleteFiles,
    renameFile,
    moveFile,
    searchQuery,
    setSearchQuery,
    searchResults,
    isSearching
  } = useFileStore();

  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<OSSObject | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [moveOpen, setMoveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<string | null>(null);

  const [searchInputValue, setSearchInputValue] = useState('');

  // Sync searchInputValue with store searchQuery when searchQuery is cleared externally
  useEffect(() => {
    if (!searchQuery) {
        setSearchInputValue('');
    }
  }, [searchQuery]);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
        setSearchQuery(searchInputValue);
    }
  };

  useEffect(() => {
    if (!ossConfig) {
      navigate('/settings');
    } else {
      const root = ossConfig.rootPath || '';
      if (!currentPath && root) {
        setCurrentPath(root);
      } else {
        fetchFiles();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ossConfig, navigate]);

  const handleFolderClick = (folderName: string) => {
    setCurrentPath(currentPath + folderName + '/');
  };

  const handleFileClick = (file: OSSObject) => {
    setSelectedFile(file);
    setMenuOpen(true);
  };

  const handleBack = () => {
    const root = ossConfig?.rootPath || '';
    if (currentPath === root) return;
    
    const parent = getParentPath(currentPath);
    if (root && !parent.startsWith(root) && parent !== root) {
        setCurrentPath(root);
    } else {
        setCurrentPath(parent);
    }
  };

  const handleDownload = async (fileName: string) => {
    if (!ossConfig) return;
    const key = currentPath + fileName;
    
    try {
      toast.loading('Downloading...');
      const client = initOSSClient(ossConfig);
      const result = await client.get(key);
      
      const content = result.content.toString();
      const downloadedFile: DownloadedFile = {
        key,
        name: fileName,
        content,
        encoding: 'UTF-8', 
        downloadTime: new Date().toISOString(),
        size: result.res.headers['content-length'] ? parseInt(result.res.headers['content-length'] as string) : 0
      };

      await downloadedTxtStore.setItem(key, downloadedFile);
      toast.dismiss();
      toast.success('Downloaded to offline storage');
    } catch (err: any) {
      toast.dismiss();
      toast.error('Download failed: ' + err.message);
    }
  };

  const handleDelete = (fileName: string) => {
    setFileToDelete(fileName);
    setDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (fileToDelete) {
      await deleteFiles([currentPath + fileToDelete]);
      toast.success('File deleted');
      setDeleteOpen(false);
      setFileToDelete(null);
    }
  };

  const onRename = async () => {
    if (!selectedFile || !newName.trim()) return;
    
    let finalName = newName.trim();
    if (!finalName.endsWith('.txt')) {
        finalName += '.txt';
    }

    if (finalName === selectedFile.name) {
        setRenameOpen(false);
        return;
    }
    
    try {
        const oldKey = currentPath + selectedFile.name;
        // If folder, we need to handle it differently or block renaming folders for now?
        // Renaming folders in OSS is expensive (recursive copy).
        // Let's support file rename for now.
        if (selectedFile.type === 'folder') {
             toast.error('Renaming folders is not supported yet');
             return;
        }

        await renameFile(oldKey, finalName);
        toast.success('Renamed successfully');
        setRenameOpen(false);
    } catch (err: any) {
        toast.error('Rename failed: ' + err.message);
    }
  };

  const onMove = async (destinationPath: string) => {
    if (!selectedFile) return;
    
    try {
        const sourceKey = currentPath + selectedFile.name;
        await moveFile(sourceKey, destinationPath);
        toast.success('Moved successfully');
        setMoveOpen(false);
    } catch (err: any) {
        toast.error('Move failed: ' + err.message);
    }
  };

  const displayFiles = searchQuery ? searchResults : files;

  const trailingActions = (fileName: string, isFolder: boolean) => (
    <TrailingActions>
      {!isFolder && (
        <SwipeAction
          onClick={() => handleDownload(fileName)}
          className="bg-green-500 flex items-center justify-center px-4"
        >
          <Download className="text-white" />
        </SwipeAction>
      )}
      <SwipeAction
        onClick={() => handleDelete(fileName)}
        className="bg-red-500 flex items-center justify-center px-4"
      >
        <Trash2 className="text-white" />
      </SwipeAction>
    </TrailingActions>
  );

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Top Bar */}
      <div className="p-4 border-b space-y-2 bg-background z-10 sticky top-0">
        <div className="flex items-center space-x-2">
          {currentPath && currentPath !== (ossConfig?.rootPath || '') && (
            <Button variant="ghost" size="icon" onClick={handleBack}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <h1 className="font-semibold text-lg truncate flex-1">
            {currentPath ? (
              ossConfig?.rootPath && currentPath.startsWith(ossConfig.rootPath) 
                ? (currentPath.replace(ossConfig.rootPath, '') || 'Home')
                : currentPath
            ) : 'Home'}
          </h1>
          <Button variant="ghost" size="icon" onClick={() => fetchFiles(true)}>
            <RefreshCw className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search files..." 
            className="pl-8" 
            value={searchInputValue}
            onChange={(e) => setSearchInputValue(e.target.value)}
            onKeyDown={handleSearchKeyDown}
          />
        </div>
      </div>

      {/* File List */}
      <div className="flex-1 overflow-y-auto">
        {(isLoading || isSearching) && displayFiles.length === 0 ? (
          <div className="p-4 space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : error ? (
          <div className="p-4 text-center text-red-500">{error}</div>
        ) : displayFiles.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
             {searchQuery ? 'No results found' : 'No files found'}
          </div>
        ) : (
          <SwipeableList fullSwipe={false} type={ListType.IOS}>
            {displayFiles.map((file) => (
              <SwipeableListItem
                key={file.url || file.name} // url is unique for files, name for folders
                trailingActions={trailingActions(file.name, file.type === 'folder')}
              >
                <div 
                  className="w-full p-4 border-b bg-background flex items-center space-x-4 active:bg-accent cursor-pointer"
                  onClick={() => {
                      if (file.type === 'folder') {
                          // If searching, we might need to handle full path navigation differently?
                          // Currently handleFolderClick appends to currentPath.
                          // If search result returns full relative path like "subdir/folder", we need to set path.
                          // But our search logic will likely return objects.
                          // If file.name is "subdir/folder", handleFolderClick appends it?
                          // Standard file listing: name is "folder". currentPath is "root/". click -> "root/folder/"
                          // Search result: name might be "sub/folder" (relative to root).
                          // If we click it, we probably want to go INTO it.
                          // If the name is full path relative to search root, we should just set path.
                          
                          // For simplicity, let's assume if searching, clicking folder jumps to that folder.
                          if (searchQuery) {
                              const fullPath = (ossConfig?.rootPath || '') + file.name + '/';
                              setCurrentPath(fullPath);
                              setSearchQuery(''); // Clear search on navigation
                              setSearchInputValue(''); // Clear local input
                          } else {
                              handleFolderClick(file.name);
                          }
                      } else {
                          handleFileClick(file);
                      }
                  }}
                >
                  <div className="p-2 bg-muted rounded-full">
                    {file.type === 'folder' ? (
                      <Folder className="h-6 w-6 text-blue-500" />
                    ) : (
                      <FileText className="h-6 w-6 text-gray-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {file.type === 'file' ? `${formatFileSize(file.size)} • ` : ''}
                      {formatDate(file.lastModified)}
                      {searchQuery && <span className="ml-2 text-xs opacity-50 block">{file.url ? getParentPath(file.name) : ''}</span>}
                    </p>
                  </div>
                  {file.type === 'file' && <MoreVertical className="h-4 w-4 text-muted-foreground" />}
                </div>
              </SwipeableListItem>
            ))}
          </SwipeableList>
        )}
      </div>

      {/* Options Menu */}
      <Drawer open={menuOpen} onOpenChange={setMenuOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{selectedFile?.name}</DrawerTitle>
          </DrawerHeader>
          <div className="p-4 space-y-2">
            <Button 
                variant="outline" 
                className="w-full justify-start" 
                onClick={() => {
                    setMenuOpen(false);
                    setNewName(selectedFile?.name.replace(/\.txt$/, '') || '');
                    setRenameOpen(true);
                }}
            >
                <Pencil className="mr-2 h-4 w-4" /> Rename
            </Button>
            <Button 
                variant="outline" 
                className="w-full justify-start" 
                onClick={() => {
                    if (selectedFile) handleDownload(selectedFile.name);
                    setMenuOpen(false);
                }}
            >
                <Download className="mr-2 h-4 w-4" /> Download
            </Button>
            <Button 
                variant="outline" 
                className="w-full justify-start" 
                onClick={() => {
                    if (selectedFile) {
                        if (selectedFile.name.endsWith('.txt')) {
                            // If searching, selectedFile.name includes full relative path.
                            // If browsing, it's just filename.
                            // But wait, our fileStore logic:
                            // When browsing: files have name relative to currentPath.
                            // When searching: searchResults have name relative to rootPath.
                            
                            // If we are searching, currentPath might be irrelevant to the file's location.
                            // We should construct full path based on whether we are searching or not.
                            
                            let fullPath = '';
                            if (searchQuery) {
                                fullPath = (ossConfig?.rootPath || '') + selectedFile.name;
                            } else {
                                fullPath = currentPath + selectedFile.name;
                            }
                            
                            navigate(`/reader/${encodeURIComponent(fullPath)}`);
                        } else {
                            toast.info('Only .txt files supported');
                        }
                    }
                    setMenuOpen(false);
                }}
            >
                <Eye className="mr-2 h-4 w-4" /> Read Online
            </Button>
            <Button 
                variant="outline" 
                className="w-full justify-start" 
                onClick={() => {
                    setMenuOpen(false);
                    setMoveOpen(true);
                }}
            >
                <Move className="mr-2 h-4 w-4" /> Move
            </Button>
            <Button 
                variant="destructive" 
                className="w-full justify-start" 
                onClick={() => {
                    if (selectedFile) handleDelete(selectedFile.name);
                    setMenuOpen(false);
                }}
            >
                <Trash2 className="mr-2 h-4 w-4" /> Delete
            </Button>
          </div>
          <DrawerFooter>
            <DrawerClose asChild>
              <Button variant="outline">Cancel</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* Rename Dialog */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Rename File</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                    <Label htmlFor="name">New Name</Label>
                    <Input 
                        id="name" 
                        value={newName} 
                        onChange={(e) => setNewName(e.target.value)} 
                    />
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setRenameOpen(false)}>Cancel</Button>
                <Button onClick={onRename}>Rename</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move Dialog */}
      <Dialog open={moveOpen} onOpenChange={setMoveOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Move to...</DialogTitle>
                <DialogDescription>Select destination folder</DialogDescription>
            </DialogHeader>
            <FolderPicker 
                currentPath={currentPath}
                onSelect={onMove}
                onCancel={() => setMoveOpen(false)}
            />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Confirm Deletion</DialogTitle>
                <DialogDescription>
                    Are you sure you want to delete "{fileToDelete}"? This action cannot be undone.
                </DialogDescription>
            </DialogHeader>
            <DialogFooter>
                <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
                <Button variant="destructive" onClick={confirmDelete}>Delete</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default FileManager;
