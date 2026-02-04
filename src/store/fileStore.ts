import { create } from 'zustand';
import { OSSObject, initOSSClient, getParentPath } from '@/utils/oss';
import { useConfigStore } from './configStore';
import { fileCacheStore } from '@/utils/storage';

interface FileState {
  currentPath: string;
  files: OSSObject[];
  isLoading: boolean;
  error: string | null;
  selectedFiles: string[]; // Keys
  searchQuery: string;
  
  setCurrentPath: (path: string) => void;
  setSearchQuery: (query: string) => void;
  toggleSelection: (key: string) => void;
  clearSelection: () => void;
  
  fetchFiles: (refresh?: boolean) => Promise<void>;
  deleteFiles: (keys: string[]) => Promise<void>;
  createFolder: (folderName: string) => Promise<void>;
}

export const useFileStore = create<FileState>((set, get) => ({
  currentPath: '',
  files: [],
  isLoading: false,
  error: null,
  selectedFiles: [],
  searchQuery: '',

  setCurrentPath: (path) => {
    set({ currentPath: path, selectedFiles: [] });
    get().fetchFiles();
  },

  setSearchQuery: (query) => {
    set({ searchQuery: query });
    // If search is active, we might want to trigger a search or filter locally
    // For now, let's assume simple filtering or server-side search if implemented
    // The PRD mentions "Name Search", which usually means listing all and filtering, or using OSS search if available (OSS doesn't have good search).
    // Usually we list with prefix. If searching globally, that's expensive on OSS.
    // "检索目录以及文件...名称搜索" - implies local filter or recursive list.
    // For MVP, let's just filter current view or simple prefix search.
    // If the query is empty, reload current path.
  },

  toggleSelection: (key) => {
    const { selectedFiles } = get();
    if (selectedFiles.includes(key)) {
      set({ selectedFiles: selectedFiles.filter(k => k !== key) });
    } else {
      set({ selectedFiles: [...selectedFiles, key] });
    }
  },

  clearSelection: () => set({ selectedFiles: [] }),

  fetchFiles: async (refresh = false) => {
    const { ossConfig } = useConfigStore.getState();
    const { currentPath } = get();
    
    if (!ossConfig) {
      set({ error: 'OSS configuration missing' });
      return;
    }

    set({ isLoading: true, error: null });

    try {
      // Check cache first if not refreshing
      const cacheKey = `list_${currentPath}`;
      if (!refresh) {
         // TODO: Implement cache expiration logic
         // For now, always fetch fresh from OSS to ensure consistency, 
         // as cache might be stale. PRD emphasizes "Privacy" and "Mobile", 
         // maybe cache is good for offline?
         // Let's stick to live fetch for now, caching file *content* is more important.
      }

      const client = initOSSClient(ossConfig);
      const result = await client.list({
        prefix: currentPath,
        delimiter: '/',
        ['max-keys']: 100, // Pagination todo
      }, {});

      const objects: OSSObject[] = [];

      // Process directories (prefixes)
      if (result.prefixes) {
        result.prefixes.forEach((prefix: string) => {
          // Remove the current path from the name to get the display name
          const name = prefix.replace(currentPath, '').replace(/\/$/, '');
          if (name) { // Avoid empty names
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

      // Process files
      if (result.objects) {
        result.objects.forEach((obj) => {
          // Skip the folder object itself (if it exists as a 0-byte object)
          if (obj.name === currentPath) return;

          objects.push({
            name: obj.name.replace(currentPath, ''),
            url: obj.url,
            lastModified: obj.lastModified,
            size: obj.size,
            type: 'file'
          });
        });
      }

      set({ files: objects, isLoading: false });

    } catch (err: any) {
      console.error(err);
      set({ isLoading: false, error: err.message || 'Failed to fetch files' });
    }
  },

  deleteFiles: async (keys) => {
     const { ossConfig } = useConfigStore.getState();
     if (!ossConfig) return;
     
     set({ isLoading: true });
     try {
       const client = initOSSClient(ossConfig);
       
       // "Move to Trash" logic: rename to trash/original_key
       // OSS Copy then Delete
       // For batch:
       for (const key of keys) {
         const trashKey = `trash/${key}`;
         // Copy
         await client.copy(trashKey, key);
         // Delete
         await client.delete(key);
       }
       
       set({ isLoading: false, selectedFiles: [] });
       get().fetchFiles(true); // Refresh
       
     } catch (err: any) {
       set({ isLoading: false, error: err.message });
     }
  },
  
  createFolder: async (folderName) => {
    const { ossConfig } = useConfigStore.getState();
    const { currentPath } = get();
    if (!ossConfig) return;

    try {
      const client = initOSSClient(ossConfig);
      const key = `${currentPath}${folderName}/`;
      await client.put(key, Buffer.from(''));
      get().fetchFiles(true);
    } catch (err: any) {
      set({ error: err.message });
    }
  }

}));
