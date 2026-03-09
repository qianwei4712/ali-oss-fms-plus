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
    <div className="flex flex-col min-h-full px-4 pt-4">
      <div className="px-4 py-3 mb-6 glass-panel rounded-2xl sticky top-4 z-40 border border-white/10 shadow-lg ring-1 ring-black/5 flex items-center justify-between">
        <h1 className="text-lg font-bold tracking-tight text-glow">Downloads</h1>
        <div className="text-xs text-primary-foreground font-medium bg-primary px-3 py-1 rounded-full shadow-sm">
            {files.length} items
        </div>
      </div>
      
      <div className="flex-1 pb-32 space-y-3">
        {isLoading ? (
          [1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-2xl glass-card" />)
        ) : files.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground space-y-4 glass-card rounded-3xl m-4">
             <div className="p-4 bg-primary/10 rounded-full">
                <FileText className="h-8 w-8 text-primary opacity-50" />
             </div>
             <p>No downloaded files</p>
          </div>
        ) : (
          files.map((file) => (
            <div 
              key={file.key} 
              className="group relative glass-card rounded-xl px-3 py-2.5 flex items-center justify-between hover:shadow-lg hover:bg-card/60 transition-all duration-300 cursor-pointer overflow-hidden border border-white/5 ring-1 ring-white/5 hover:ring-primary/20 hover:border-primary/20"
              onClick={() => handleOpen(file.key)}
            >
              <div className="flex items-center space-x-3 overflow-hidden flex-1 z-10">
                <div className="p-2 bg-primary/20 rounded-lg text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-300">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold truncate text-sm text-foreground group-hover:text-primary transition-colors">{file.name}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {formatFileSize(file.size)} • {formatDate(file.downloadTime)}
                  </p>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 -mr-2 z-10 transition-colors h-8 w-8"
                onClick={(e) => handleDelete(file.key, e)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out pointer-events-none" />
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
