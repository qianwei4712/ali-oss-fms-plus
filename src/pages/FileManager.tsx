import { useEffect, useState, useRef, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useConfigStore } from '@/store/configStore';
import { useFileStore } from '@/store/fileStore';
import { useUiStore } from '@/store/uiStore';
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
  ChevronRight,
  UploadCloud,
  CheckSquare,
  Square,
  Check
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

import { FolderPicker } from '@/components/FolderPicker';
import { RenameDialog } from '@/components/RenameDialog';
import { UploadDialog } from '@/components/UploadDialog';
import jschardet from 'jschardet';

// Memoized File Row Component
const FileRow = memo(({ 
  file, 
  onClick, 
  searchQuery, 
  isFolder,
  selectionMode,
  isSelected,
  onToggleSelect
}: { 
  file: OSSObject; 
  onClick: () => void; 
  searchQuery: string;
  isFolder: boolean;
  selectionMode: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
}) => (
  <div 
    className={`group relative w-full px-3 py-2.5 mb-2 glass-card rounded-xl flex items-center space-x-3 cursor-pointer overflow-hidden border border-white/5 ring-1 ${isSelected ? 'ring-primary border-primary/30 bg-primary/5' : 'ring-white/5 hover:ring-primary/20 hover:border-primary/20'}`}
    onClick={(e) => {
        if (selectionMode) {
            e.stopPropagation();
            onToggleSelect();
        } else {
            onClick();
        }
    }}
  >
    {selectionMode && (
        <div className="mr-1 text-primary">
            {isSelected ? <CheckSquare className="h-5 w-5" /> : <Square className="h-5 w-5 text-muted-foreground" />}
        </div>
    )}

    <div className={`p-2 rounded-lg transition-all duration-300 ${isFolder ? 'bg-primary/20 text-primary group-hover:bg-primary group-hover:text-primary-foreground' : 'bg-secondary/50 text-secondary-foreground group-hover:bg-secondary group-hover:text-foreground'}`}>
      {isFolder ? (
        <Folder className="h-5 w-5" />
      ) : (
        <FileText className="h-5 w-5" />
      )}
    </div>
    <div className="flex-1 min-w-0">
      <p className="font-semibold truncate text-sm text-foreground leading-tight group-hover:text-primary transition-colors">{file.name.split('/').pop()}</p>
      <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center leading-none">
        {!isFolder ? `${formatFileSize(file.size)} • ` : ''}
        {formatDate(file.lastModified)}
        {searchQuery && <span className="ml-2 opacity-50 block">{file.url ? getParentPath(file.name) : ''}</span>}
      </p>
    </div>
    {!selectionMode && isFolder && <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary transition-colors" />}
    
    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out pointer-events-none" />
  </div>
));

FileRow.displayName = 'FileRow';

const FileManager = () => {
  const navigate = useNavigate();
  const { ossConfig } = useConfigStore();
  const { setNavBarVisible, isNavBarVisible } = useUiStore();
  const lastScrollTopRef = useRef(0);

  useEffect(() => {
    setNavBarVisible(true);
    
    const handleScroll = (e: Event) => {
        const target = e.target as HTMLElement;
        const scrollTop = target.scrollTop;
        const scrollDelta = scrollTop - lastScrollTopRef.current;
        
        // Ignore small scrolls
        if (Math.abs(scrollDelta) > 10) {
            if (scrollDelta > 0 && scrollTop > 50) {
                // Scrolling down and not at very top
                setNavBarVisible(false);
            } else if (scrollDelta < 0) {
                // Scrolling up
                setNavBarVisible(true);
            }
        }
        lastScrollTopRef.current = scrollTop;
    };

    const mainElement = document.getElementById('main-content');
    if (mainElement) {
        mainElement.addEventListener('scroll', handleScroll);
    }

    return () => {
        if (mainElement) {
            mainElement.removeEventListener('scroll', handleScroll);
        }
        setNavBarVisible(true);
    };
  }, [setNavBarVisible]);

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
    hasMoreSearch,
    loadMore,
    uploadFiles,
    isSelectionMode,
    toggleSelectionMode,
    selectedFiles,
    toggleSelection,
    selectAll,
    moveFiles
  } = useFileStore();

  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<OSSObject | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<string | null>(null);
  const [globalMenuOpen, setGlobalMenuOpen] = useState(false);
  
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);
  const [batchMoveOpen, setBatchMoveOpen] = useState(false);

  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [filesToUpload, setFilesToUpload] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [searchInputValue, setSearchInputValue] = useState('');
  const observerTarget = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);


  const canLoadMore = searchQuery ? hasMoreSearch : hasMore;

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && canLoadMore && !isLoading && !isSearching && !error) {
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
  }, [canLoadMore, isLoading, isSearching, loadMore, error]);

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

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
        setFilesToUpload(Array.from(e.target.files));
        setUploadDialogOpen(true);
    }
    // Reset input value to allow re-selection of same file
    e.target.value = '';
  };

  const handleUploadConfirm = async (path: string) => {
    await uploadFiles(filesToUpload, path);
    setUploadDialogOpen(false);
    setFilesToUpload([]);
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
      
      // Use signatureUrl + fetch to handle encoding correctly
      const url = client.signatureUrl(key, { expires: 3600 });
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to download: ${response.status} ${response.statusText}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      const size = arrayBuffer.byteLength;
      
      // Detect encoding
      let binaryString = '';
      const len = Math.min(uint8Array.length, 1024 * 50);
      for (let i = 0; i < len; i++) {
        binaryString += String.fromCharCode(uint8Array[i]);
      }
      
      const detected = jschardet.detect(binaryString);
      let encoding = detected.encoding || 'utf-8';
      
      const upper = encoding.toUpperCase();
      if (['GB2312', 'GBK'].includes(upper)) {
        encoding = 'GB18030';
      } else if (upper === 'WINDOWS-1252' && detected.confidence < 0.95) {
        encoding = 'GB18030';
      } else if (upper === 'ISO-8859-1' && detected.confidence < 0.95) {
        encoding = 'GB18030';
      }
      
      let content = '';
      try {
        const decoder = new TextDecoder(encoding);
        content = decoder.decode(uint8Array);
      } catch (e) {
        console.warn('Decoding failed, fallback to utf-8', e);
        const decoder = new TextDecoder('utf-8');
        content = decoder.decode(uint8Array);
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
    if (selectedFile?.name.endsWith('.txt')) {
       setRenameOpen(true);
    } else {
       toast.info('Only .txt files supported');
    }
  };

  const handleRenameConfirm = async (newName: string) => {
    if (!selectedFile) return;

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

        await renameFile(oldKey, newName);
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

  const handleBatchDelete = async () => {
      if (selectedFiles.length > 0) {
          await deleteFiles(selectedFiles);
          toast.success(`${selectedFiles.length} files deleted`);
          setBatchDeleteOpen(false);
          toggleSelectionMode(); // Exit selection mode
      }
  };

  const handleBatchMove = async (destinationPath: string) => {
      if (selectedFiles.length > 0) {
          await moveFiles(selectedFiles, destinationPath);
          toast.success(`${selectedFiles.length} files moved`);
          setBatchMoveOpen(false);
          toggleSelectionMode(); // Exit selection mode
      }
  };

  const handleSelectAll = () => {
      const allKeys = displayFiles.map(f => {
         const rootPath = ossConfig?.rootPath || '';
         if (searchQuery) {
             return rootPath + f.name;
         } else {
             const effectivePath = currentPath || rootPath;
             return effectivePath + f.name;
         }
      });
      selectAll(allKeys);
  };

  const displayFiles = searchQuery ? searchResults : files;

  const trailingActions = (fileName: string, isFolder: boolean) => (
    <TrailingActions>
      {!isFolder && (
        <SwipeAction
          onClick={() => handleDownload(fileName)}
        >
          <div className="bg-success flex items-center justify-center px-4 h-full">
            <Download className="text-success-foreground" />
          </div>
        </SwipeAction>
      )}
      <SwipeAction
        onClick={() => handleDelete(fileName)}
      >
        <div className="bg-destructive flex items-center justify-center px-4 h-full">
          <Trash2 className="text-destructive-foreground" />
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
    <div className="flex flex-col min-h-full px-4 pt-4">
      {/* Top Bar */}
      <div className={`px-4 py-3 glass-panel rounded-2xl fixed top-4 left-4 right-4 z-40 border border-white/10 shadow-lg ring-1 ring-black/5 transition-transform duration-300 ease-in-out ${isNavBarVisible ? 'translate-y-0' : '-translate-y-[200%]'}`}>
        <div className="flex items-center space-x-3 mb-3">
          {currentPath && currentPath !== (ossConfig?.rootPath || '') && (
            <Button variant="ghost" size="icon" onClick={handleBack} className="h-9 w-9 hover:bg-primary/20 hover:text-primary rounded-xl transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <h1 className="font-bold text-lg truncate flex-1 tracking-tight text-glow">
            {currentPath && currentPath !== (ossConfig?.rootPath || '') 
              ? (currentPath.endsWith('/') ? currentPath.slice(0, -1) : currentPath).split('/').pop() 
              : 'Home'}
          </h1>
          <Button variant="ghost" size="icon" onClick={() => fetchFiles(true)} className="h-9 w-9 hover:bg-primary/20 hover:text-primary rounded-xl transition-colors">
            <RefreshCw className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button variant="ghost" size="icon" onClick={toggleSelectionMode} className={`h-9 w-9 hover:bg-primary/20 hover:text-primary rounded-xl transition-colors ${isSelectionMode ? 'bg-primary/20 text-primary' : ''}`}>
            <CheckSquare className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setGlobalMenuOpen(true)} className="h-9 w-9 hover:bg-primary/20 hover:text-primary rounded-xl transition-colors">
            <MoreVertical className="h-5 w-5" />
          </Button>
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            multiple 
            accept=".txt" 
            onChange={handleFileSelect}
          />
        </div>
        {isSelectionMode ? (
            <div className="flex items-center justify-between h-10 px-1">
                <span className="text-sm font-medium">{selectedFiles.length} selected</span>
                <div className="flex space-x-2">
                    <Button variant="ghost" size="sm" onClick={handleSelectAll} className="h-8 text-xs">Select All</Button>
                    <Button variant="ghost" size="sm" onClick={() => selectAll([])} className="h-8 text-xs">Deselect</Button>
                </div>
            </div>
        ) : (
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <Input 
            placeholder="Search files..." 
            className="h-10 pl-10 text-sm bg-secondary/30 border-transparent focus:bg-background/80 focus:border-primary/30 focus:ring-2 focus:ring-primary/20 rounded-xl transition-all duration-300 backdrop-blur-sm" 
            value={searchInputValue}
            onChange={(e) => setSearchInputValue(e.target.value)}
            onKeyDown={handleSearchKeyDown}
          />
        </div>
        )}
      </div>

      {/* File List */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 pb-32 space-y-1 mt-[136px]"
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
                    selectionMode={isSelectionMode}
                    isSelected={(() => {
                        const rootPath = ossConfig?.rootPath || '';
                        let fullPath = '';
                        if (searchQuery) {
                            fullPath = rootPath + file.name;
                        } else {
                            const effectivePath = currentPath || rootPath;
                            fullPath = effectivePath + file.name;
                        }
                        return selectedFiles.includes(fullPath);
                    })()}
                    onToggleSelect={() => {
                        const rootPath = ossConfig?.rootPath || '';
                        let fullPath = '';
                        if (searchQuery) {
                            fullPath = rootPath + file.name;
                        } else {
                            const effectivePath = currentPath || rootPath;
                            fullPath = effectivePath + file.name;
                        }
                        toggleSelection(fullPath);
                    }}
                />
              </SwipeableListItem>
            ))}
          </SwipeableList>
        )}
        
        {canLoadMore && (
            <div 
                ref={observerTarget} 
                className="h-20 flex justify-center items-center w-full cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => {
                    if (!isLoading && !isSearching) loadMore();
                }}
            >
                {error ? (
                    <div className="flex flex-col items-center gap-1">
                        <span className="text-xs text-destructive">{error}</span>
                        <span className="text-xs text-muted-foreground underline">Tap to retry</span>
                    </div>
                ) : (isLoading || isSearching) ? (
                    <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                ) : (
                    <span className="text-sm text-muted-foreground/50">Load More</span>
                )}
            </div>
        )}
      </div>

      {/* Batch Actions Bar */}
      <div className={`fixed bottom-6 left-4 right-4 z-50 transition-transform duration-300 ${isSelectionMode && selectedFiles.length > 0 ? 'translate-y-0' : 'translate-y-[200%]'}`}>
          <div className="bg-background/80 backdrop-blur-md border border-white/10 shadow-lg rounded-2xl p-2 flex justify-around items-center ring-1 ring-black/5">
              <Button 
                  variant="ghost" 
                  className="flex-1 flex flex-col items-center justify-center h-14 space-y-1 hover:bg-destructive/10 hover:text-destructive rounded-xl transition-colors"
                  onClick={() => setBatchDeleteOpen(true)}
              >
                  <Trash2 className="h-5 w-5" />
                  <span className="text-[10px] font-medium">Delete ({selectedFiles.length})</span>
              </Button>
              <div className="w-px h-8 bg-border/50"></div>
              <Button 
                  variant="ghost" 
                  className="flex-1 flex flex-col items-center justify-center h-14 space-y-1 hover:bg-primary/10 hover:text-primary rounded-xl transition-colors"
                  onClick={() => setBatchMoveOpen(true)}
              >
                  <Move className="h-5 w-5" />
                  <span className="text-[10px] font-medium">Move ({selectedFiles.length})</span>
              </Button>
          </div>
      </div>

      {/* Options Menu */}
      <Drawer open={menuOpen} onOpenChange={setMenuOpen}>
        <DrawerContent>
          <DrawerHeader className="text-left">
            <DrawerTitle 
              className="whitespace-normal break-all cursor-pointer select-none"
              style={{ touchAction: 'none' }}
              onContextMenu={(e) => e.preventDefault()}
              onPointerDown={() => {
                longPressTimer.current = setTimeout(() => {
                  const rawName = selectedFile?.name.split('/').pop() || '';
                  const nameWithoutExt = rawName.replace(/\.txt$/i, '');
                  if (nameWithoutExt) {
                    navigator.clipboard.writeText(nameWithoutExt);
                    setSearchInputValue(nameWithoutExt);
                    setSearchQuery(nameWithoutExt);
                    setMenuOpen(false);
                    toast.success('已复制并填入搜索框');
                  }
                }, 500);
              }}
              onPointerUp={() => { if (longPressTimer.current) clearTimeout(longPressTimer.current); }}
              onPointerLeave={() => { if (longPressTimer.current) clearTimeout(longPressTimer.current); }}
              onPointerCancel={() => { if (longPressTimer.current) clearTimeout(longPressTimer.current); }}
            >
              {selectedFile?.name.split('/').pop()?.replace(/\.txt$/i, '')}
            </DrawerTitle>
          </DrawerHeader>
          <div className="p-4 grid grid-cols-2 gap-3">
            <Button 
                variant="outline" 
                className="flex flex-col items-center justify-center h-20 space-y-2 border-primary/10 bg-primary/5 hover:bg-primary/10 hover:text-primary transition-all rounded-xl" 
                onClick={() => {
                    if (selectedFile) {
                        if (selectedFile.name.endsWith('.txt')) {
                            const fullPath = searchQuery ? (ossConfig?.rootPath || '') + selectedFile.name : currentPath + selectedFile.name;
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
                className="flex flex-col items-center justify-center h-20 space-y-2 border-success/10 bg-success/5 hover:bg-success/10 hover:text-success transition-all rounded-xl text-success" 
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
                className="flex flex-col items-center justify-center h-20 space-y-2 border-warning/10 bg-warning/5 hover:bg-warning/10 hover:text-warning transition-all rounded-xl text-warning" 
                onClick={() => {
                    setMenuOpen(false);
                    // Check if txt
                    if (selectedFile?.name.endsWith('.txt')) {
                        setRenameOpen(true);
                    } else {
                        toast.info('Only .txt files supported');
                    }
                }}
            >
                <Pencil className="h-6 w-6" />
                <span className="text-xs font-medium">Rename</span>
            </Button>

            <Button 
                variant="outline" 
                className="flex flex-col items-center justify-center h-20 space-y-2 border-info/10 bg-info/5 hover:bg-info/10 hover:text-info transition-all rounded-xl text-info" 
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
      <RenameDialog 
        open={renameOpen} 
        onOpenChange={setRenameOpen}
        currentName={selectedFile?.name.split('/').pop() || ''}
        onRename={handleRenameConfirm}
      />

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

      {/* Global Actions Menu */}
      <Drawer open={globalMenuOpen} onOpenChange={setGlobalMenuOpen}>
        <DrawerContent>
          <DrawerHeader className="text-left">
            <DrawerTitle>Actions</DrawerTitle>
          </DrawerHeader>
          <div className="p-4 space-y-3">
             <Button 
                variant="outline" 
                className="w-full flex items-center justify-start h-12 space-x-3 border-primary/10 bg-primary/5 hover:bg-primary/10 hover:text-primary transition-all rounded-xl"
                onClick={() => {
                    handleUploadClick();
                    setGlobalMenuOpen(false);
                }}
             >
                <div className="bg-background p-1.5 rounded-lg border border-primary/20">
                    <UploadCloud className="h-5 w-5 text-primary" />
                </div>
                <span className="font-medium">Upload Files</span>
             </Button>
          </div>
          <DrawerFooter className="pt-0">
            <DrawerClose asChild>
              <Button variant="ghost" className="w-full">Cancel</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* Upload Dialog */}
      <UploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        files={filesToUpload}
        initialPath={currentPath}
        onUpload={handleUploadConfirm}
      />

      {/* Batch Delete Dialog */}
      <Dialog open={batchDeleteOpen} onOpenChange={setBatchDeleteOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Confirm Batch Deletion</DialogTitle>
                <DialogDescription>
                    Are you sure you want to delete {selectedFiles.length} items? This action cannot be undone.
                </DialogDescription>
            </DialogHeader>
            <DialogFooter>
                <Button variant="outline" onClick={() => setBatchDeleteOpen(false)}>Cancel</Button>
                <Button variant="destructive" onClick={handleBatchDelete}>Delete</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch Move Dialog */}
      <Dialog open={batchMoveOpen} onOpenChange={setBatchMoveOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Batch Move to...</DialogTitle>
                <DialogDescription>Select destination folder for {selectedFiles.length} items</DialogDescription>
            </DialogHeader>
            <FolderPicker 
                currentPath={currentPath}
                onSelect={handleBatchMove}
                onCancel={() => setBatchMoveOpen(false)}
            />
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default FileManager;
