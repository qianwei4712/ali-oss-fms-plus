import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { downloadedTxtStore, DownloadedFile } from '@/utils/storage';
import { formatFileSize, formatDate } from '@/utils/format';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from 'sonner';
import { FileText, Trash2 } from 'lucide-react';

const Downloads = () => {
  const navigate = useNavigate();
  const [files, setFiles] = useState<DownloadedFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<string | null>(null);

  const fetchDownloads = async () => {
    setIsLoading(true);
    const items: DownloadedFile[] = [];
    await downloadedTxtStore.iterate((value: DownloadedFile) => {
      items.push(value);
    });
    // Sort by download time desc
    items.sort((a, b) => new Date(b.downloadTime).getTime() - new Date(a.downloadTime).getTime());
    setFiles(items);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchDownloads();
  }, []);

  const handleDelete = (key: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFileToDelete(key);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (fileToDelete) {
      await downloadedTxtStore.removeItem(fileToDelete);
      toast.success('Removed from downloads');
      fetchDownloads();
      setDeleteDialogOpen(false);
      setFileToDelete(null);
    }
  };

  const handleOpen = (key: string) => {
    // Open reader with offline mode flag or just pass the key and let reader handle it?
    // The reader usually takes a path. If it's offline, maybe we use a special prefix or query param?
    // Let's use query param ?offline=true
    navigate(`/reader/${encodeURIComponent(key)}?offline=true`);
  };

  return (
    <div className="flex flex-col h-full bg-muted/30">
      <div className="p-4 glass sticky top-0 z-10 flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight">Downloads</h1>
        <div className="text-xs text-muted-foreground font-medium bg-secondary px-2 py-1 rounded-full">
            {files.length} items
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 pb-24 space-y-3 no-scrollbar">
        {isLoading ? (
          [1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)
        ) : files.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground space-y-4">
             <div className="p-4 bg-muted rounded-full">
                <FileText className="h-8 w-8 opacity-50" />
             </div>
             <p>No downloaded files</p>
          </div>
        ) : (
          files.map((file) => (
            <div 
              key={file.key} 
              className="group border border-border/50 rounded-xl p-4 flex items-center justify-between bg-card hover:shadow-md transition-all duration-200 cursor-pointer active:scale-[0.99]"
              onClick={() => handleOpen(file.key)}
            >
              <div className="flex items-center space-x-4 overflow-hidden flex-1">
                <div className="p-2.5 bg-primary/10 rounded-xl text-primary">
                  <FileText className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate text-foreground">{file.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatFileSize(file.size)} • {formatDate(file.downloadTime)}
                  </p>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 -mr-2"
                onClick={(e) => handleDelete(file.key, e)}
              >
                <Trash2 className="h-5 w-5" />
              </Button>
            </div>
          ))
        )}
      </div>
      
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove this file from downloads? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Downloads;
