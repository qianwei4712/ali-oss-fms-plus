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
  const [actionType, setActionType] = useState<'restore' | 'delete' | null>(null);
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

  const trailingActions = (file: OSSObject) => (
    <TrailingActions>
      <SwipeAction
        onClick={() => {
            setSelectedFile(file);
            setActionType('restore');
            setConfirmOpen(true);
        }}
        className="bg-blue-500 flex items-center justify-center px-4"
      >
        <RotateCcw className="text-white" />
      </SwipeAction>
      <SwipeAction
        onClick={() => {
            setSelectedFile(file);
            setActionType('delete');
            setConfirmOpen(true);
        }}
        className="bg-red-600 flex items-center justify-center px-4"
      >
        <Trash2 className="text-white" />
      </SwipeAction>
    </TrailingActions>
  );

  return (
    <div className="flex flex-col h-screen bg-background">
      <div className="p-4 border-b space-y-2 bg-background z-10 sticky top-0 flex items-center">
        <Button variant="ghost" size="icon" onClick={handleBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="font-semibold text-lg truncate flex-1">
            Recycle Bin
        </h1>
        <Button variant="ghost" size="icon" onClick={() => fetchFiles(currentPath)}>
          <RefreshCw className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading && files.length === 0 ? (
           <div className="p-4 space-y-4">
             <Skeleton className="h-16 w-full" />
             <Skeleton className="h-16 w-full" />
           </div>
        ) : error ? (
           <div className="p-4 text-center text-red-500">{error}</div>
        ) : files.length === 0 ? (
           <div className="p-4 text-center text-muted-foreground">Recycle Bin is empty</div>
        ) : (
           <SwipeableList fullSwipe={false} type={ListType.IOS}>
             {files.map(file => (
                <SwipeableListItem
                    key={file.name}
                    trailingActions={trailingActions(file)}
                >
                    <div 
                        className="w-full p-4 border-b bg-background flex items-center space-x-4 active:bg-accent"
                        onClick={() => file.type === 'folder' ? handleFolderClick(file.name) : null}
                    >
                        <div className="p-2 bg-muted rounded-full">
                            {file.type === 'folder' ? (
                                <Folder className="h-6 w-6 text-gray-500" />
                            ) : (
                                <FileText className="h-6 w-6 text-gray-400" />
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{file.name}</p>
                            <p className="text-xs text-muted-foreground">
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
                    {actionType === 'restore' ? 'Restore File' : 'Permanently Delete'}
                </DialogTitle>
                <DialogDescription>
                    {actionType === 'restore' 
                        ? `Are you sure you want to restore "${selectedFile?.name}"?`
                        : `Are you sure you want to permanently delete "${selectedFile?.name}"? This cannot be undone.`
                    }
                </DialogDescription>
            </DialogHeader>
            <DialogFooter>
                <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
                <Button 
                    variant={actionType === 'delete' ? "destructive" : "default"} 
                    onClick={actionType === 'restore' ? onRestore : onDelete}
                >
                    {actionType === 'restore' ? 'Restore' : 'Delete'}
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RecycleBin;
