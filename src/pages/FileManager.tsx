import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useConfigStore } from '@/store/configStore';
import { useFileStore } from '@/store/fileStore';
import { downloadedTxtStore, DownloadedFile } from '@/utils/storage';
import { initOSSClient, getParentPath } from '@/utils/oss';
import { formatFileSize, formatDate } from '@/utils/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Folder, FileText, ArrowLeft, Search, RefreshCw, Trash2, Download } from 'lucide-react';
import { SwipeableList, SwipeableListItem, SwipeAction, TrailingActions, Type as ListType } from 'react-swipeable-list';
import 'react-swipeable-list/dist/styles.css';

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
    searchQuery,
    setSearchQuery
  } = useFileStore();

  useEffect(() => {
    if (!ossConfig) {
      navigate('/settings');
    } else {
      fetchFiles();
    }
  }, [ossConfig, navigate, currentPath]);

  const handleFolderClick = (folderName: string) => {
    setCurrentPath(currentPath + folderName + '/');
  };

  const handleFileClick = (fileName: string) => {
    // Only support txt for now as per requirements
    if (fileName.endsWith('.txt')) {
      const fullPath = currentPath + fileName;
      navigate(`/reader/${encodeURIComponent(fullPath)}`);
    } else {
      toast.info('Only .txt files are supported for reading');
    }
  };

  const handleBack = () => {
    const parent = getParentPath(currentPath);
    setCurrentPath(parent);
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
        encoding: 'UTF-8', // Detection logic should be in reader or here, for now default
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

  const handleDelete = async (fileName: string) => {
    if (confirm(`Delete ${fileName}?`)) {
      await deleteFiles([currentPath + fileName]);
      toast.success('File deleted');
    }
  };

  const filteredFiles = files.filter(f => 
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
        destructive={true}
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
          {currentPath && (
            <Button variant="ghost" size="icon" onClick={handleBack}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <h1 className="font-semibold text-lg truncate flex-1">
            {currentPath || 'Home'}
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
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* File List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && files.length === 0 ? (
          <div className="p-4 space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : error ? (
          <div className="p-4 text-center text-red-500">{error}</div>
        ) : filteredFiles.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">No files found</div>
        ) : (
          <SwipeableList fullSwipe={false} type={ListType.IOS}>
            {filteredFiles.map((file) => (
              <SwipeableListItem
                key={file.name}
                trailingActions={trailingActions(file.name, file.type === 'folder')}
              >
                <div 
                  className="w-full p-4 border-b bg-background flex items-center space-x-4 active:bg-accent"
                  onClick={() => file.type === 'folder' ? handleFolderClick(file.name) : handleFileClick(file.name)}
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
                    </p>
                  </div>
                </div>
              </SwipeableListItem>
            ))}
          </SwipeableList>
        )}
      </div>
    </div>
  );
};

export default FileManager;
