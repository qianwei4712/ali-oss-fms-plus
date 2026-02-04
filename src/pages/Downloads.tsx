import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { downloadedTxtStore, DownloadedFile } from '@/utils/storage';
import { formatFileSize, formatDate } from '@/utils/format';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { FileText, Trash2, BookOpen } from 'lucide-react';

const Downloads = () => {
  const navigate = useNavigate();
  const [files, setFiles] = useState<DownloadedFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

  const handleDelete = async (key: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Remove from downloads?')) {
      await downloadedTxtStore.removeItem(key);
      toast.success('Removed from downloads');
      fetchDownloads();
    }
  };

  const handleOpen = (key: string) => {
    // Open reader with offline mode flag or just pass the key and let reader handle it?
    // The reader usually takes a path. If it's offline, maybe we use a special prefix or query param?
    // Let's use query param ?offline=true
    navigate(`/reader/${encodeURIComponent(key)}?offline=true`);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] p-4">
      <h1 className="text-2xl font-bold mb-4">Downloads</h1>
      
      <div className="flex-1 overflow-y-auto space-y-2">
        {isLoading ? (
          [1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)
        ) : files.length === 0 ? (
          <div className="text-center text-muted-foreground mt-10">
            No downloaded files.
          </div>
        ) : (
          files.map((file) => (
            <div 
              key={file.key} 
              className="border rounded-lg p-4 flex items-center justify-between bg-card active:bg-accent"
              onClick={() => handleOpen(file.key)}
            >
              <div className="flex items-center space-x-4 overflow-hidden">
                <div className="p-2 bg-muted rounded-full">
                  <FileText className="h-6 w-6 text-gray-500" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(file.size)} • {formatDate(file.downloadTime)}
                  </p>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="text-destructive"
                onClick={(e) => handleDelete(file.key, e)}
              >
                <Trash2 className="h-5 w-5" />
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Downloads;
