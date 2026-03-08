import { useEffect, useState } from 'react';
import { useConfigStore } from '@/store/configStore';
import { initOSSClient, getParentPath, OSSObject } from '@/utils/oss';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Folder, ArrowLeft, ChevronRight, FileText, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";

interface UploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  files: File[];
  initialPath: string;
  onUpload: (path: string) => Promise<void>;
}

export const UploadDialog = ({ 
  open, 
  onOpenChange, 
  files, 
  initialPath, 
  onUpload 
}: UploadDialogProps) => {
  const { ossConfig } = useConfigStore();
  const [path, setPath] = useState(initialPath);
  const [folders, setFolders] = useState<OSSObject[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Reset path when dialog opens
  useEffect(() => {
    if (open) {
        setPath(initialPath || ossConfig?.rootPath || '');
    }
  }, [open, initialPath, ossConfig]);

  useEffect(() => {
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

    if (open) {
        fetchFolders(path);
    }
  }, [path, ossConfig, open]);

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

  const handleUpload = async () => {
      setUploading(true);
      try {
          await onUpload(path);
          onOpenChange(false);
          toast.success(`Successfully uploaded ${files.length} files`);
      } catch (error: any) {
          toast.error(`Upload failed: ${error.message}`);
      } finally {
          setUploading(false);
      }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Upload Files</DialogTitle>
          <DialogDescription>
            Selected {files.length} files to upload. Choose destination folder.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
            {/* File List Preview (Collapsible or ScrollArea) */}
            <div className="bg-muted/30 rounded-lg p-3 border">
                <div className="text-xs font-medium text-muted-foreground mb-2">Selected Files:</div>
                <div className="h-24 overflow-y-auto custom-scrollbar pr-2">
                    <div className="space-y-1">
                        {files.map((f, i) => (
                            <div key={i} className="flex items-center text-sm">
                                <FileText className="h-3 w-3 mr-2 opacity-70 flex-shrink-0" />
                                <span className="truncate flex-1">{f.name}</span>
                                <span className="ml-2 text-xs opacity-50 flex-shrink-0">{(f.size / 1024).toFixed(1)}KB</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Path Selection */}
            <div className="flex flex-col border rounded-lg overflow-hidden flex-1 min-h-[200px]">
                <div className="flex items-center space-x-2 bg-muted/50 px-3 py-2 border-b">
                    {path !== (ossConfig?.rootPath || '') && (
                        <Button variant="ghost" size="icon" onClick={handleBack} className="h-6 w-6 flex-shrink-0">
                        <ArrowLeft className="h-3 w-3" />
                        </Button>
                    )}
                    <div className="text-sm font-medium truncate flex-1" title={path}>
                        {path || 'Root'}
                    </div>
                </div>
                
                <div className="flex-1 bg-background overflow-y-auto custom-scrollbar">
                    <div className="p-1">
                        {loading ? (
                            <div className="space-y-2 p-2">
                                <Skeleton className="h-8 w-full" />
                                <Skeleton className="h-8 w-full" />
                            </div>
                        ) : folders.length === 0 ? (
                            <div className="text-center text-muted-foreground text-xs py-8">No subfolders</div>
                        ) : (
                            folders.map(f => (
                                <div 
                                    key={f.name}
                                    className="flex items-center p-2 hover:bg-accent rounded-md cursor-pointer transition-colors"
                                    onClick={() => handleFolderClick(f.name)}
                                >
                                    <Folder className="h-4 w-4 mr-2 text-primary fill-primary/20 flex-shrink-0" />
                                    <span className="text-sm truncate flex-1">{f.name}</span>
                                    <ChevronRight className="h-3 w-3 text-muted-foreground/50 flex-shrink-0" />
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>

        <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={uploading}>Cancel</Button>
            <Button onClick={handleUpload} disabled={uploading}>
                {uploading ? 'Uploading...' : `Upload to ${path === (ossConfig?.rootPath || '') ? 'Root' : path.split('/').slice(-2, -1)[0]}`}
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
