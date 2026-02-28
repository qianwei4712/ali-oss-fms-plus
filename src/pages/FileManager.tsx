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

import { FolderPicker } from '@/components/FolderPicker';

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
    const key = searchQuery 
      ? (ossConfig.rootPath || '') + fileName 
      : currentPath + fileName;
    
    try {
      toast.loading('Downloading...');
      const client = initOSSClient(ossConfig);
      const result = await client.get(key);
      
      const content = result.content.toString();
      let size = 0;
      if (result.res && result.res.headers && result.res.headers['content-length']) {
        size = parseInt(result.res.headers['content-length'] as string);
      }
      if (!size) {
        size = new Blob([content]).size;
      }

      const downloadedFile: DownloadedFile = {
        key,
        name: fileName,
        content,
        encoding: 'UTF-8', 
        downloadTime: new Date().toISOString(),
        size
      };

      await downloadedTxtStore.setItem(key, downloadedFile);
      toast.dismiss();
      toast.success('Downloaded to offline storage');
    } catch (err: unknown) {
      toast.dismiss();
      const message = err instanceof Error ? err.message : String(err);
      toast.error('Download failed: ' + message);
    }
  };

  const handleDelete = (fileName: string) => {
    setFileToDelete(fileName);
    setDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (fileToDelete) {
      const key = searchQuery 
        ? (ossConfig?.rootPath || '') + fileToDelete 
        : currentPath + fileToDelete;
      await deleteFiles([key]);
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
        const oldKey = searchQuery 
            ? (ossConfig?.rootPath || '') + selectedFile.name 
            : currentPath + selectedFile.name;
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
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        toast.error('Rename failed: ' + message);
    }
  };

  const onMove = async (destinationPath: string) => {
    if (!selectedFile) return;
    
    try {
        const sourceKey = searchQuery 
            ? (ossConfig?.rootPath || '') + selectedFile.name 
            : currentPath + selectedFile.name;
        await moveFile(sourceKey, destinationPath);
        toast.success('Moved successfully');
        setMoveOpen(false);
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        toast.error('Move failed: ' + message);
    }
  };

  const displayFiles = searchQuery ? searchResults : files;

  const trailingActions = (fileName: string, isFolder: boolean) => (
    <TrailingActions>
      {!isFolder && (
        <SwipeAction
          onClick={() => handleDownload(fileName)}
        >
          <div className="bg-green-500 flex items-center justify-center px-4 h-full">
            <Download className="text-white" />
          </div>
        </SwipeAction>
      )}
      <SwipeAction
        onClick={() => handleDelete(fileName)}
      >
        <div className="bg-red-500 flex items-center justify-center px-4 h-full">
          <Trash2 className="text-white" />
        </div>
      </SwipeAction>
    </TrailingActions>
  );

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Top Bar */}
      <div className="px-4 py-2 space-y-1.5 glass z-10 sticky top-0 border-b">
        <div className="flex items-center space-x-2">
          {currentPath && currentPath !== (ossConfig?.rootPath || '') && (
            <Button variant="ghost" size="icon" onClick={handleBack} className="h-8 w-8 hover:bg-primary/10 hover:text-primary">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <h1 className="font-semibold text-base truncate flex-1 tracking-tight">
            {currentPath ? (
              ossConfig?.rootPath && currentPath.startsWith(ossConfig.rootPath) 
                ? (currentPath.replace(ossConfig.rootPath, '') || 'Home')
                : currentPath
            ) : 'Home'}
          </h1>
          <Button variant="ghost" size="icon" onClick={() => fetchFiles(true)} className="h-8 w-8 hover:bg-primary/10 hover:text-primary">
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input 
            placeholder="Search files..." 
            className="h-8 pl-8 text-sm bg-muted/50 border-transparent focus:bg-background focus:border-primary/20 transition-all duration-200" 
            value={searchInputValue}
            onChange={(e) => setSearchInputValue(e.target.value)}
            onKeyDown={handleSearchKeyDown}
          />
        </div>
      </div>

      {/* File List */}
      <div className="flex-1 overflow-y-auto bg-muted/30">
        {(isLoading || isSearching) && displayFiles.length === 0 ? (
          <div className="p-4 space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        ) : error ? (
          <div className="p-4 text-center text-destructive">{error}</div>
        ) : displayFiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground space-y-4">
             <div className="p-4 bg-muted rounded-full">
                <Search className="h-8 w-8 opacity-50" />
             </div>
             <p>{searchQuery ? 'No results found' : 'No files found'}</p>
          </div>
        ) : (
          <SwipeableList fullSwipe={false} type={ListType.IOS}>
            {displayFiles.map((file) => (
              <SwipeableListItem
                key={file.url || file.name} 
                trailingActions={trailingActions(file.name, file.type === 'folder')}
              >
                <div 
                  className="w-full px-4 py-3 border-b border-border/40 bg-background flex items-center space-x-3 active:bg-muted/50 transition-colors duration-200 cursor-pointer"
                  onClick={() => {
                      if (file.type === 'folder') {
                          if (searchQuery) {
                              const fullPath = (ossConfig?.rootPath || '') + file.name + '/';
                              setCurrentPath(fullPath);
                              setSearchQuery(''); 
                              setSearchInputValue(''); 
                          } else {
                              handleFolderClick(file.name);
                          }
                      } else {
                          handleFileClick(file);
                      }
                  }}
                >
                  <div className={`p-2 rounded-lg ${file.type === 'folder' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                    {file.type === 'folder' ? (
                      <Folder className="h-5 w-5" />
                    ) : (
                      <FileText className="h-5 w-5" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate text-[13px] text-foreground leading-tight">{file.name.split('/').pop()}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center leading-none">
                      {file.type === 'file' ? `${formatFileSize(file.size)} • ` : ''}
                      {formatDate(file.lastModified)}
                      {searchQuery && <span className="ml-2 opacity-50 block">{file.url ? getParentPath(file.name) : ''}</span>}
                    </p>
                  </div>
                  {file.type === 'file' && <MoreVertical className="h-3.5 w-3.5 text-muted-foreground/50" />}
                  {file.type === 'folder' && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30" />}
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
