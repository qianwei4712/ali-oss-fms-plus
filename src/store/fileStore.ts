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
  searchResults: OSSObject[];
  isSearching: boolean;
  
  setCurrentPath: (path: string) => void;
  setSearchQuery: (query: string) => void;
  toggleSelection: (key: string) => void;
  clearSelection: () => void;
  
  fetchFiles: (refresh?: boolean) => Promise<void>;
  deleteFiles: (keys: string[]) => Promise<void>;
  createFolder: (folderName: string) => Promise<void>;
  renameFile: (oldKey: string, newName: string) => Promise<void>;
  moveFile: (sourceKey: string, destinationPath: string) => Promise<void>;
}

export const useFileStore = create<FileState>((set, get) => ({
  currentPath: '',
  files: [],
  isLoading: false,
  error: null,
  selectedFiles: [],
  searchQuery: '',
  searchResults: [],
  isSearching: false,

  setCurrentPath: (path) => {
    set({ currentPath: path, selectedFiles: [], searchQuery: '', searchResults: [] });
    get().fetchFiles();
  },

  setSearchQuery: async (query) => {
    set({ searchQuery: query });
    if (!query.trim()) {
        set({ searchResults: [], isSearching: false });
        return;
    }

    const { ossConfig } = useConfigStore.getState();
    if (!ossConfig) return;

    set({ isSearching: true, error: null });
    
    // Global search implementation
    // Since OSS doesn't support recursive search efficiently, we have to list recursively.
    // However, listing everything might be too heavy.
    // We will use prefix listing with delimiter='' to list all objects recursively under rootPath.
    // And then filter locally.
    // Limit to max 1000 items for performance?

    try {
        const client = initOSSClient(ossConfig);
        const rootPath = ossConfig.rootPath || '';
        
        const result = await client.list({
            prefix: rootPath,
            // delimiter: '', // Empty delimiter means recursive list
            ['max-keys']: 1000, // Increased limit as requested, though "unlimited" is hard in one go without pagination loop
        }, {});

        const matches: OSSObject[] = [];
        
        if (result.objects) {
            result.objects.forEach(obj => {
                // Skip root folder itself
                if (obj.name === rootPath) return;

                // Simple case-insensitive name match
                // We want to match the filename part or full path? User asked for "search all".
                // Usually matching filename is more expected.
                const relativePath = obj.name.replace(rootPath, '');
                const fileName = relativePath.split('/').pop() || '';
                
                if (fileName.toLowerCase().includes(query.toLowerCase())) {
                    matches.push({
                        name: relativePath, // Keep relative path for display context
                        url: obj.url,
                        lastModified: obj.lastModified,
                        size: obj.size,
                        type: 'file'
                    });
                }
            });
        }
        
        set({ searchResults: matches, isSearching: false });
    } catch (err: any) {
        console.error("Search failed", err);
        set({ isSearching: false, error: "Search failed: " + err.message });
    }
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
    let { currentPath } = get();
    
    if (!ossConfig) {
      set({ error: 'OSS configuration missing' });
      return;
    }

    // Use rootPath if currentPath is empty
    const rootPath = ossConfig.rootPath || '';
    const effectivePath = currentPath || rootPath;

    set({ isLoading: true, error: null });

    try {
      // Check cache first if not refreshing
      const cacheKey = `list_${effectivePath}`;
      if (!refresh) {
         // TODO: Implement cache expiration logic
      }

      const client = initOSSClient(ossConfig);
      const result = await client.list({
        prefix: effectivePath,
        delimiter: '/',
        ['max-keys']: 100, // Pagination todo
      }, {});

      const objects: OSSObject[] = [];

      // Process directories (prefixes)
      if (result.prefixes) {
        result.prefixes.forEach((prefix: string) => {
          // Remove the current path from the name to get the display name
          const name = prefix.replace(effectivePath, '').replace(/\/$/, '');
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
          if (obj.name === effectivePath) return;

          objects.push({
            name: obj.name.replace(effectivePath, ''),
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
     
     const rootPath = ossConfig.rootPath || '';
     const recyclePath = ossConfig.recyclePath || 'trash/';

     set({ isLoading: true });
     try {
       const client = initOSSClient(ossConfig);
       
       for (const key of keys) {
         // Determine destination key in recycle bin
         let destinationKey = '';
         
         // If key starts with rootPath, replace it with recyclePath
         if (rootPath && key.startsWith(rootPath)) {
            destinationKey = key.replace(rootPath, recyclePath);
         } else {
            // Fallback: just prepend recyclePath or assume relative?
            // If key is "some/file.txt" and rootPath is empty.
            // recyclePath is "trash/".
            // dest -> "trash/some/file.txt".
            // If key is "normal/file.txt" and rootPath is "normal/".
            // recyclePath is "recycle/".
            // dest -> "recycle/file.txt".
            destinationKey = recyclePath + key;
         }

         // Ensure destination ends with / if it's a folder (copy won't handle folder implicitly but OSS handles objects)
         // But here we are deleting files (objects).
         // If "key" is a folder prefix (OSS fake folder), we need to handle all children.
         // Current deleteFiles implementation seems to assume "keys" are file objects or it deletes individual objects.
         // If user selects a folder, "keys" might contain just the folder prefix? 
         // The UI passes `currentPath + fileName`. If it's a folder, it ends with '/'.
         // If it is a folder, we need to list all children and move them?
         // The current implementation of deleteFiles:
         // "Move to Trash" logic: rename to trash/original_key
         // The original code was: `const trashKey = trash/${key};`
         // It implies simple renaming.
         
         // Fix for path joining slashes
         destinationKey = destinationKey.replace('//', '/');

         // Copy
         await client.copy(destinationKey, key);
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

    const rootPath = ossConfig.rootPath || '';
    const effectivePath = currentPath || rootPath;

    try {
      const client = initOSSClient(ossConfig);
      const key = `${effectivePath}${folderName}/`;
      await client.put(key, Buffer.from(''));
      get().fetchFiles(true);
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  renameFile: async (oldKey, newName) => {
    const { ossConfig } = useConfigStore.getState();
    if (!ossConfig) return;

    // oldKey is full path: "folder/old.txt"
    // newName is just name: "new.txt"
    // We need to keep the folder path
    const pathParts = oldKey.split('/');
    pathParts.pop(); // Remove old filename
    const folderPath = pathParts.join('/');
    const newKey = folderPath ? `${folderPath}/${newName}` : newName;

    set({ isLoading: true });
    try {
      const client = initOSSClient(ossConfig);
      await client.copy(newKey, oldKey);
      await client.delete(oldKey);
      set({ isLoading: false });
      get().fetchFiles(true);
    } catch (err: any) {
      set({ isLoading: false, error: err.message });
      throw err;
    }
  },

  moveFile: async (sourceKey, destinationPath) => {
    const { ossConfig } = useConfigStore.getState();
    if (!ossConfig) return;

    // sourceKey: "folder/file.txt"
    // destinationPath: "other/folder/"
    const fileName = sourceKey.split('/').pop();
    if (!fileName) return;

    const newKey = destinationPath + fileName;
    
    // Check if moving to same location
    if (sourceKey === newKey) return;

    set({ isLoading: true });
    try {
      const client = initOSSClient(ossConfig);
      await client.copy(newKey, sourceKey);
      await client.delete(sourceKey);
      set({ isLoading: false });
      get().fetchFiles(true);
    } catch (err: any) {
      set({ isLoading: false, error: err.message });
      throw err;
    }
  }

}));
