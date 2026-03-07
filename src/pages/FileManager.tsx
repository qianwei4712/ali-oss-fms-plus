import { useEffect, useState, useRef, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useConfigStore } from '@/store/configStore';
import { useFileStore } from '@/store/fileStore';
import { downloadedTxtStore, DownloadedFile } from '@/utils/storage';
import { initOSSClient, getParentPath, OSSObject, OSSConfig } from '@/utils/oss';
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
  ChevronRight,
  Eraser
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

// Memoized File Row Component
const FileRow = memo(({ 
  file, 
  onClick, 
  searchQuery, 
  isFolder 
}: { 
  file: OSSObject; 
  onClick: () => void; 
  searchQuery: string;
  isFolder: boolean;
}) => (
  <div 
    className="w-full px-4 py-3 border-b border-border/40 bg-background flex items-center space-x-3 active:bg-muted/50 transition-colors duration-200 cursor-pointer"
    onClick={onClick}
  >
    <div className={`p-2 rounded-lg ${isFolder ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
      {isFolder ? (
        <Folder className="h-5 w-5" />
      ) : (
        <FileText className="h-5 w-5" />
      )}
    </div>
    <div className="flex-1 min-w-0">
      <p className="font-medium truncate text-[13px] text-foreground leading-tight">{file.name.split('/').pop()}</p>
      <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center leading-none">
        {!isFolder ? `${formatFileSize(file.size)} • ` : ''}
        {formatDate(file.lastModified)}
        {searchQuery && <span className="ml-2 opacity-50 block">{file.url ? getParentPath(file.name) : ''}</span>}
      </p>
    </div>
    {!isFolder && <MoreVertical className="h-3.5 w-3.5 text-muted-foreground/50" />}
    {isFolder && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30" />}
  </div>
));

FileRow.displayName = 'FileRow';

const FileManager = () => {
  const navigate = useNavigate();
  const { ossConfig, filenameCleanPatterns } = useConfigStore();
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
    isSearching,
    hasMore,
    loadMore
  } = useFileStore();

  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<OSSObject | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [moveOpen, setMoveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<string | null>(null);

  const [searchInputValue, setSearchInputValue] = useState('');
  const observerTarget = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading && !error) {
          loadMore();
        }
      },
      { 
        root: scrollContainerRef.current,
        threshold: 0.1,
        rootMargin: '200px'
      }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [hasMore, isLoading, loadMore, error]);

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
      // headers type in ali-oss is sometimes loose, cast to any to avoid strict mode error
      const headers = result.res && result.res.headers ? (result.res.headers as any) : {};
      if (headers['content-length']) {
        size = parseInt(headers['content-length'] as string);
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

  const handleAutoClean = () => {
    if (!filenameCleanPatterns || filenameCleanPatterns.length === 0) {
      toast.info('No cleaning patterns configured');
      return;
    }
    
    let cleanedName = newName;
    let originalName = newName;
    
    filenameCleanPatterns.forEach(pattern => {
      cleanedName = cleanedName.split(pattern).join('');
    });
    
    if (cleanedName !== originalName) {
      setNewName(cleanedName);
      toast.success('Filename cleaned');
    } else {
      toast.info('No matching patterns found');
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

  const handleItemClick = useCallback((file: OSSObject) => {
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
  }, [searchQuery, ossConfig, currentPath, setCurrentPath, setSearchQuery]);

  return (
    <div className="flex flex-col h-full">
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
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto bg-muted/30 pb-24"
      >
        {(isLoading || isSearching) && displayFiles.length === 0 ? (
          <div className="p-4 space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        ) : error && displayFiles.length === 0 ? (
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
                <FileRow 
                    file={file} 
                    onClick={() => handleItemClick(file)}
                    searchQuery={searchQuery}
                    isFolder={file.type === 'folder'}
                />
              </SwipeableListItem>
            ))}
          </SwipeableList>
        )}
        
        {hasMore && !isSearching && !searchQuery && (
            <div 
                ref={observerTarget} 
                className="h-20 flex justify-center items-center w-full cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => {
                    if (!isLoading) loadMore();
                }}
            >
                {error ? (
                    <div className="flex flex-col items-center gap-1">
                        <span className="text-xs text-destructive">{error}</span>
                        <span className="text-xs text-muted-foreground underline">Tap to retry</span>
                    </div>
                ) : isLoading ? (
                    <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                ) : (
                    <span className="text-sm text-muted-foreground/50">Load More</span>
                )}
            </div>
        )}
      </div>

      {/* Options Menu */}
      <Drawer open={menuOpen} onOpenChange={setMenuOpen}>
        <DrawerContent>
          <DrawerHeader className="text-left">
            <DrawerTitle className="whitespace-normal break-all">{selectedFile?.name.split('/').pop()}</DrawerTitle>
          </DrawerHeader>
          <div className="p-4 grid grid-cols-2 gap-3">
            <Button 
                variant="outline" 
                className="flex flex-col items-center justify-center h-20 space-y-2 border-primary/10 bg-primary/5 hover:bg-primary/10 hover:text-primary transition-all rounded-xl" 
                onClick={() => {
                    if (selectedFile) {
                        if (selectedFile.name.endsWith('.txt')) {
                            let fullPath = searchQuery ? (ossConfig?.rootPath || '') + selectedFile.name : currentPath + selectedFile.name;
                            navigate(`/reader/${encodeURIComponent(fullPath)}`);
                        } else {
                            toast.info('Only .txt files supported');
                        }
                    }
                    setMenuOpen(false);
                }}
            >
                <Eye className="h-6 w-6" />
                <span className="text-xs font-medium">Read Online</span>
            </Button>
            
            <Button 
                variant="outline" 
                className="flex flex-col items-center justify-center h-20 space-y-2 border-green-500/10 bg-green-500/5 hover:bg-green-500/10 hover:text-green-600 transition-all rounded-xl text-green-600" 
                onClick={() => {
                    if (selectedFile) handleDownload(selectedFile.name);
                    setMenuOpen(false);
                }}
            >
                <Download className="h-6 w-6" />
                <span className="text-xs font-medium">Download</span>
            </Button>

            <Button 
                variant="outline" 
                className="flex flex-col items-center justify-center h-20 space-y-2 border-orange-500/10 bg-orange-500/5 hover:bg-orange-500/10 hover:text-orange-600 transition-all rounded-xl text-orange-600" 
                onClick={() => {
                    setMenuOpen(false);
                    setNewName(selectedFile?.name.replace(/\.txt$/, '') || '');
                    setRenameOpen(true);
                }}
            >
                <Pencil className="h-6 w-6" />
                <span className="text-xs font-medium">Rename</span>
            </Button>

            <Button 
                variant="outline" 
                className="flex flex-col items-center justify-center h-20 space-y-2 border-blue-500/10 bg-blue-500/5 hover:bg-blue-500/10 hover:text-blue-600 transition-all rounded-xl text-blue-600" 
                onClick={() => {
                    setMenuOpen(false);
                    setMoveOpen(true);
                }}
            >
                <Move className="h-6 w-6" />
                <span className="text-xs font-medium">Move</span>
            </Button>

            <Button 
                variant="outline" 
                className="flex flex-col items-center justify-center h-20 space-y-2 border-destructive/10 bg-destructive/5 hover:bg-destructive/10 hover:text-destructive transition-all rounded-xl text-destructive col-span-2" 
                onClick={() => {
                    if (selectedFile) handleDelete(selectedFile.name);
                    setMenuOpen(false);
                }}
            >
                <Trash2 className="h-6 w-6" />
                <span className="text-xs font-medium">Delete File</span>
            </Button>
          </div>
          <DrawerFooter className="pt-0">
            <DrawerClose asChild>
              <Button variant="ghost" className="w-full">Cancel</Button>
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
                    <div className="flex space-x-2">
                        <Input 
                            id="name" 
                            value={newName} 
                            onChange={(e) => setNewName(e.target.value)} 
                        />
                        <Button 
                            variant="outline" 
                            size="icon" 
                            title="Auto Clean"
                            onClick={handleAutoClean}
                        >
                            <Eraser className="h-4 w-4" />
                        </Button>
                    </div>
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
