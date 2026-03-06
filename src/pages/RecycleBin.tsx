import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useConfigStore } from '@/store/configStore';
import { initOSSClient, OSSObject, getParentPath } from '@/utils/oss';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { ArrowLeft, RefreshCw, Trash2, RotateCcw, Folder, FileText } from 'lucide-react';
import { SwipeableList, SwipeableListItem, SwipeAction, TrailingActions, Type as ListType } from 'react-swipeable-list';
import 'react-swipeable-list/dist/styles.css';
import { formatFileSize, formatDate } from '@/utils/format';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const RecycleBin = () => {
  const navigate = useNavigate();
  const { ossConfig } = useConfigStore();
  
  const [currentPath, setCurrentPath] = useState('');
  const [files, setFiles] = useState<OSSObject[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [actionType, setActionType] = useState<'restore' | 'delete' | 'empty' | null>(null);
  const [selectedFile, setSelectedFile] = useState<OSSObject | null>(null);

  useEffect(() => {
    if (!ossConfig) {
      navigate('/settings');
      return;
    }
    const recycleRoot = ossConfig.recyclePath || 'trash/';
    if (!currentPath) {
        setCurrentPath(recycleRoot);
    } else {
        fetchFiles(currentPath);
    }
  }, [ossConfig, currentPath, navigate]);

  const fetchFiles = async (path: string) => {
    if (!ossConfig) return;
    setIsLoading(true);
    setError(null);
    try {
      const client = initOSSClient(ossConfig);
      const result = await client.list({
        prefix: path,
        delimiter: '/',
        ['max-keys']: 100,
      }, {});

      const objects: OSSObject[] = [];
      if (result.prefixes) {
        result.prefixes.forEach((prefix: string) => {
          const name = prefix.replace(path, '').replace(/\/$/, '');
          if (name) {
              objects.push({
                name: name,
                url: '',
                lastModified: '',
                size: 0,
                type: 'folder'
              });
          }
        });
      }
      if (result.objects) {
        result.objects.forEach((obj) => {
          if (obj.name === path) return;
          objects.push({
            name: obj.name.replace(path, ''),
            url: obj.url,
            lastModified: obj.lastModified,
            size: obj.size,
            type: 'file'
          });
        });
      }
      setFiles(objects);
    } catch (err: any) {
      console.error(err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    const root = ossConfig?.recyclePath || 'trash/';
    if (currentPath === root) {
        navigate('/settings');
        return;
    }
    const parent = getParentPath(currentPath);
    if (root && !parent.startsWith(root) && parent !== root) {
        setCurrentPath(root);
    } else {
        setCurrentPath(parent);
    }
  };

  const handleFolderClick = (folderName: string) => {
    setCurrentPath(currentPath + folderName + '/');
  };

  const onRestore = async () => {
    if (!selectedFile || !ossConfig) return;
    
    const rootPath = ossConfig.rootPath || '';
    const recyclePath = ossConfig.recyclePath || 'trash/';
    const fileKey = currentPath + selectedFile.name;
    
    // Calculate destination
    // If recyclePath is "trash/" and fileKey is "trash/sub/file.txt"
    // and rootPath is "data/"
    // logic in deleteFiles was: destinationKey = key.replace(rootPath, recyclePath);
    // So reverse is: destinationKey = key.replace(recyclePath, rootPath);
    
    let destinationKey = '';
    if (fileKey.startsWith(recyclePath)) {
        destinationKey = fileKey.replace(recyclePath, rootPath);
    } else {
        // Should not happen if we are in recycle bin
        destinationKey = rootPath + selectedFile.name; 
    }

    // Fix double slashes just in case
    destinationKey = destinationKey.replace('//', '/');

    setIsLoading(true);
    try {
        const client = initOSSClient(ossConfig);
        await client.copy(destinationKey, fileKey);
        await client.delete(fileKey);
        toast.success('File restored');
        fetchFiles(currentPath);
    } catch (err: any) {
        toast.error('Restore failed: ' + err.message);
        setIsLoading(false);
    } finally {
        setConfirmOpen(false);
    }
  };

  const onDelete = async () => {
    if (!selectedFile || !ossConfig) return;
    const fileKey = currentPath + selectedFile.name;
    
    setIsLoading(true);
    try {
        const client = initOSSClient(ossConfig);
        await client.delete(fileKey);
        toast.success('Permanently deleted');
        fetchFiles(currentPath);
    } catch (err: any) {
        toast.error('Delete failed: ' + err.message);
        setIsLoading(false);
    } finally {
        setConfirmOpen(false);
    }
  };

  const onEmptyRecycleBin = async () => {
    if (!ossConfig) return;
    setIsLoading(true);
    const client = initOSSClient(ossConfig);
    const recycleRoot = ossConfig.recyclePath || 'trash/';

    try {
      let marker: string | undefined = undefined;
      do {
        // @ts-ignore
        const result = await client.list({
          prefix: recycleRoot,
          'max-keys': 1000,
          marker: marker,
        }, {});

        if (result.objects && result.objects.length > 0) {
          const keys = result.objects.map((o: any) => o.name);
          await client.deleteMulti(keys);
        }

        // @ts-ignore
        marker = result.nextMarker;
      } while (marker);

      toast.success('Recycle Bin emptied');
      fetchFiles(currentPath);
    } catch (err: any) {
      toast.error('Failed to empty recycle bin: ' + err.message);
      setIsLoading(false);
    } finally {
      setConfirmOpen(false);
    }
  };

  const trailingActions = (file: OSSObject) => (
    <TrailingActions>
      <SwipeAction
        onClick={() => {
            setSelectedFile(file);
            setActionType('restore');
            setConfirmOpen(true);
        }}
      >
        <div className="bg-blue-500 flex items-center justify-center px-4 h-full">
          <RotateCcw className="text-white" />
        </div>
      </SwipeAction>
      <SwipeAction
        onClick={() => {
            setSelectedFile(file);
            setActionType('delete');
            setConfirmOpen(true);
        }}
      >
        <div className="bg-red-600 flex items-center justify-center px-4 h-full">
          <Trash2 className="text-white" />
        </div>
      </SwipeAction>
    </TrailingActions>
  );

  return (
    <div className="flex flex-col h-screen bg-muted/30">
      <div className="p-4 glass sticky top-0 z-10 flex items-center space-x-2 shadow-sm">
        <Button variant="ghost" size="icon" onClick={handleBack} className="hover:bg-primary/10 hover:text-primary">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="font-semibold text-lg truncate flex-1 tracking-tight">
            Recycle Bin
        </h1>
        <div className="flex items-center space-x-1">
            <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => {
                    setActionType('empty');
                    setConfirmOpen(true);
                }}
                title="Empty Recycle Bin"
                className="hover:bg-destructive/10 hover:text-destructive"
            >
                <Trash2 className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => fetchFiles(currentPath)} className="hover:bg-primary/10 hover:text-primary">
            <RefreshCw className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoading && files.length === 0 ? (
           <div className="space-y-4">
             <Skeleton className="h-16 w-full rounded-xl" />
             <Skeleton className="h-16 w-full rounded-xl" />
           </div>
        ) : error ? (
           <div className="p-4 text-center text-destructive">{error}</div>
        ) : files.length === 0 ? (
           <div className="flex flex-col items-center justify-center h-64 text-muted-foreground space-y-4">
              <div className="p-4 bg-muted rounded-full">
                 <Trash2 className="h-8 w-8 opacity-50" />
              </div>
              <p>Recycle Bin is empty</p>
           </div>
        ) : (
           <SwipeableList fullSwipe={false} type={ListType.IOS}>
             {files.map(file => (
                <SwipeableListItem
                    key={file.name}
                    trailingActions={trailingActions(file)}
                >
                    <div 
                        className="w-full p-4 border border-border/50 bg-card rounded-xl flex items-center space-x-4 active:scale-[0.98] transition-all duration-200 shadow-sm"
                        onClick={() => file.type === 'folder' ? handleFolderClick(file.name) : null}
                    >
                        <div className={`p-2.5 rounded-xl ${file.type === 'folder' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                            {file.type === 'folder' ? (
                                <Folder className="h-6 w-6" />
                            ) : (
                                <FileText className="h-6 w-6" />
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-medium truncate text-foreground">{file.name}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                {file.type === 'file' ? `${formatFileSize(file.size)} • ` : ''}
                                {formatDate(file.lastModified)}
                            </p>
                        </div>
                    </div>
                </SwipeableListItem>
             ))}
           </SwipeableList>
        )}
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>
                    {actionType === 'restore' 
                        ? 'Restore File' 
                        : actionType === 'empty' 
                            ? 'Empty Recycle Bin' 
                            : 'Permanently Delete'
                    }
                </DialogTitle>
                <DialogDescription>
                    {actionType === 'restore' 
                        ? `Are you sure you want to restore "${selectedFile?.name}"?`
                        : actionType === 'empty'
                            ? 'Are you sure you want to permanently delete all files in the Recycle Bin? This cannot be undone.'
                            : `Are you sure you want to permanently delete "${selectedFile?.name}"? This cannot be undone.`
                    }
                </DialogDescription>
            </DialogHeader>
            <DialogFooter>
                <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
                <Button 
                    variant={actionType === 'delete' || actionType === 'empty' ? "destructive" : "default"} 
                    onClick={() => {
                        if (actionType === 'restore') onRestore();
                        else if (actionType === 'empty') onEmptyRecycleBin();
                        else onDelete();
                    }}
                >
                    {actionType === 'restore' ? 'Restore' : actionType === 'empty' ? 'Empty' : 'Delete'}
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RecycleBin;
