import { useEffect, useState } from 'react';
import { useConfigStore } from '@/store/configStore';
import { initOSSClient, getParentPath, OSSObject } from '@/utils/oss';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Folder, ArrowLeft, ChevronRight } from 'lucide-react';

export const FolderPicker = ({ 
  currentPath: initialPath, 
  onSelect, 
  onCancel 
}: { 
  currentPath: string;
  onSelect: (path: string) => void;
  onCancel: () => void;
}) => {
  const { ossConfig } = useConfigStore();
  const [path, setPath] = useState(initialPath || ossConfig?.rootPath || '');
  const [folders, setFolders] = useState<OSSObject[]>([]);
  const [loading, setLoading] = useState(false);

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
              // Remove the current path from the name to get the display name
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

    fetchFolders(path);
  }, [path, ossConfig]);

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

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2 border-b pb-2">
         {path !== (ossConfig?.rootPath || '') && (
            <Button variant="ghost" size="icon" onClick={handleBack} className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
         )}
         <div className="text-sm font-medium truncate flex-1">
            {path || 'Root'}
         </div>
      </div>
      
      <div className="h-[200px] overflow-y-auto space-y-1">
        {loading ? (
            <div className="space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
            </div>
        ) : folders.length === 0 ? (
            <div className="text-center text-muted-foreground text-sm py-4">No subfolders</div>
        ) : (
            folders.map(f => (
                <div 
                    key={f.name}
                    className="flex items-center p-2 hover:bg-accent rounded-md cursor-pointer"
                    onClick={() => handleFolderClick(f.name)}
                >
                    <Folder className="h-4 w-4 mr-2 text-blue-500" />
                    <span className="text-sm truncate flex-1">{f.name}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
            ))
        )}
      </div>

      <div className="flex justify-end space-x-2 pt-2">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onSelect(path)}>Move Here</Button>
      </div>
    </div>
  );
};
