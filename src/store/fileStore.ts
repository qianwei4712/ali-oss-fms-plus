import { create } from 'zustand';
import { OSSObject, initOSSClient, getParentPath } from '@/utils/oss';
import { useConfigStore } from './configStore';
import { fileCacheStore, downloadedTxtStore, DownloadedFile } from '@/utils/storage';

interface FileState {
  currentPath: string;
  files: OSSObject[];
  isLoading: boolean;
  error: string | null;
  selectedFiles: string[]; // Keys
  searchQuery: string;
  searchResults: OSSObject[];
  isSearching: boolean;
  nextMarker: string | null;
  hasMore: boolean;
  searchNextToken: string | null;
  hasMoreSearch: boolean;
  
  setCurrentPath: (path: string) => void;
  setSearchQuery: (query: string) => void;
  fetchMoreSearchResults: () => Promise<void>;
  toggleSelection: (key: string) => void;
  clearSelection: () => void;
  
  isSelectionMode: boolean;
  toggleSelectionMode: () => void;
  setSelectionMode: (mode: boolean) => void;
  selectAll: (keys: string[]) => void;
  
  fetchFiles: (refresh?: boolean) => Promise<void>;
  loadMore: () => Promise<void>;
  deleteFiles: (keys: string[]) => Promise<void>;
  createFolder: (folderName: string) => Promise<void>;
  renameFile: (oldKey: string, newName: string) => Promise<void>;
  moveFile: (sourceKey: string, destinationPath: string) => Promise<void>;
  moveFiles: (sourceKeys: string[], destinationPath: string) => Promise<void>;
  uploadFiles: (files: File[], destinationPath: string) => Promise<void>;
}

export const useFileStore = create<FileState>((set, get) => ({
  currentPath: '',
  files: [],
  isLoading: false,
  error: null,
  selectedFiles: [],
  isSelectionMode: false,
  searchQuery: '',
  searchResults: [],
  isSearching: false,
  nextMarker: null,
  hasMore: false,
  searchNextToken: null,
  hasMoreSearch: false,

  toggleSelectionMode: () => set((state) => ({ isSelectionMode: !state.isSelectionMode, selectedFiles: [] })),
  setSelectionMode: (mode) => set({ isSelectionMode: mode, selectedFiles: [] }),
  selectAll: (keys) => set({ selectedFiles: keys }),

  setCurrentPath: (path) => {
    set({ 
        currentPath: path, 
        selectedFiles: [], 
        isSelectionMode: false, 
        searchQuery: '', 
        searchResults: [], 
        nextMarker: null, 
        hasMore: false,
        searchNextToken: null,
        hasMoreSearch: false
    });
    get().fetchFiles(true);
  },

  setSearchQuery: async (query) => {
    set({ searchQuery: query });
    if (!query.trim()) {
        set({ searchResults: [], isSearching: false, searchNextToken: null, hasMoreSearch: false });
        return;
    }

    const { ossConfig } = useConfigStore.getState();
    if (!ossConfig) return;

    set({ isSearching: true, error: null, searchResults: [], searchNextToken: null, hasMoreSearch: false });
    
    try {
        const client = initOSSClient(ossConfig);
        const rootPath = ossConfig.rootPath || '';
        
        let marker = null;
        let isTruncated = true;
        const matches: OSSObject[] = [];
        const lowerQuery = query.toLowerCase();
        
        // Scan up to 5000 items per search action to prevent infinite loops on huge buckets
        let itemsScanned = 0;
        const maxItemsToScan = 50000;

        while (isTruncated && itemsScanned < maxItemsToScan) {
            const result = await client.list({
                prefix: rootPath,
                marker: marker || undefined,
                'max-keys': 1000
            }, {});

            if (result.objects) {
                for (const obj of result.objects) {
                    itemsScanned++;
                    if (obj.name === rootPath) continue;

                    const relativePath = obj.name.startsWith(rootPath) 
                        ? obj.name.slice(rootPath.length) 
                        : obj.name;
                    
                    const fileName = relativePath.split('/').pop() || '';
                    const isDir = obj.name.endsWith('/');
                    
                    if (fileName.toLowerCase().includes(lowerQuery)) {
                        matches.push({
                            name: relativePath,
                            url: obj.url,
                            lastModified: obj.lastModified,
                            size: obj.size,
                            type: isDir ? 'folder' : 'file'
                        });
                    }
                }
            }

            isTruncated = result.isTruncated;
            marker = result.nextMarker;
        }
        
        set({ 
            searchResults: matches, 
            isSearching: false,
            searchNextToken: isTruncated ? marker : null,
            hasMoreSearch: isTruncated
        });
    } catch (err: any) {
        console.error("Search failed", err);
        set({ isSearching: false, error: "Search failed: " + err.message });
    }
  },

  fetchMoreSearchResults: async () => {
    const { ossConfig } = useConfigStore.getState();
    const { searchQuery, searchNextToken, hasMoreSearch, isSearching, searchResults } = get();

    if (!ossConfig || !hasMoreSearch || isSearching || !searchNextToken) return;

    set({ isSearching: true, error: null });

    try {
        const client = initOSSClient(ossConfig);
        const rootPath = ossConfig.rootPath || '';
        
        let marker = searchNextToken;
        let isTruncated = true;
        const newMatches: OSSObject[] = [];
        const lowerQuery = searchQuery.toLowerCase();
        
        let itemsScanned = 0;
        const maxItemsToScan = 5000;

        while (isTruncated && itemsScanned < maxItemsToScan) {
            const result = await client.list({
                prefix: rootPath,
                marker: marker || undefined,
                'max-keys': 1000
            }, {});

            if (result.objects) {
                for (const obj of result.objects) {
                    itemsScanned++;
                    if (obj.name === rootPath) continue;

                    const relativePath = obj.name.startsWith(rootPath) 
                        ? obj.name.slice(rootPath.length) 
                        : obj.name;
                    
                    const fileName = relativePath.split('/').pop() || '';
                    const isDir = obj.name.endsWith('/');
                    
                    if (fileName.toLowerCase().includes(lowerQuery)) {
                        const exists = searchResults.some(r => r.name === relativePath);
                        if (!exists) {
                            newMatches.push({
                                name: relativePath,
                                url: obj.url,
                                lastModified: obj.lastModified,
                                size: obj.size,
                                type: isDir ? 'folder' : 'file'
                            });
                        }
                    }
                }
            }

            isTruncated = result.isTruncated;
            marker = result.nextMarker;
        }
        
        set({ 
            searchResults: [...searchResults, ...newMatches], 
            isSearching: false,
            searchNextToken: isTruncated ? marker : null,
            hasMoreSearch: isTruncated
        });
    } catch (err: any) {
        console.error("Load more search failed", err);
        set({ isSearching: false, error: err.message });
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
    const { currentPath } = get();
    
    if (!ossConfig) {
      set({ error: 'OSS configuration missing' });
      return;
    }

    // Use rootPath if currentPath is empty
    const rootPath = ossConfig.rootPath || '';
    const effectivePath = currentPath || rootPath;

    set({ isLoading: true, error: null });
    if (refresh) {
        set({ files: [], nextMarker: null, hasMore: false });
    }

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
        ['max-keys']: 100,
        marker: refresh ? undefined : get().nextMarker || undefined,
      }, {});

      const objects: OSSObject[] = [];

      // Process directories (prefixes)
      // Only add directories if it's the first page (no marker) or if OSS returns prefixes in subsequent pages (it does)
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

      set((state) => {
        let newFiles = [];
        if (refresh) {
            newFiles = objects;
        } else {
            // Deduplicate when loading more
            // Create a Set of existing identifiers "type:name"
            const existingSet = new Set(state.files.map(f => `${f.type}:${f.name}`));
            newFiles = [...state.files];
            
            objects.forEach(obj => {
                const id = `${obj.type}:${obj.name}`;
                if (!existingSet.has(id)) {
                    newFiles.push(obj);
                }
            });
        }

        return { 
            files: newFiles, 
            isLoading: false,
            nextMarker: result.nextMarker || null,
            hasMore: !!result.nextMarker
        };
      });

    } catch (err: any) {
      console.error(err);
      set({ isLoading: false, error: err.message || 'Failed to fetch files' });
    }
  },

  loadMore: async () => {
      const { hasMore, isLoading, isSearching, hasMoreSearch } = get();
      if (isLoading) return;

      if (isSearching) {
          if (hasMoreSearch) {
              await get().fetchMoreSearchResults();
          }
      } else {
          if (hasMore) {
              await get().fetchFiles(false);
          }
      }
  },

  deleteFiles: async (keys) => {
     const { ossConfig } = useConfigStore.getState();
     if (!ossConfig) return;
     
     const rootPath = ossConfig.rootPath || '';
     const recyclePath = ossConfig.recyclePath || 'trash/';
     const { currentPath, files, searchResults, isSearching } = get();

     // Optimistic Update
     const previousFiles = files;
     const previousSearchResults = searchResults;

     const effectivePath = currentPath || rootPath;

     // Helper to check if a file in state matches one of the keys to delete
     const shouldRemove = (file: OSSObject, isSearchResult: boolean) => {
         // If search result, file.name is relative to rootPath
         // If normal file, file.name is relative to currentPath
         const fullPath = isSearchResult 
            ? (rootPath + file.name)
            : (effectivePath + file.name);
         
         // Handle folder slash
         const normalizedFullPath = file.type === 'folder' && !fullPath.endsWith('/') 
            ? fullPath + '/' 
            : fullPath;
            
         return keys.includes(normalizedFullPath) || keys.includes(fullPath);
     };

     set({
         files: files.filter(f => !shouldRemove(f, false)),
         searchResults: searchResults.filter(f => !shouldRemove(f, true)),
         selectedFiles: []
     });

     try {
       const client = initOSSClient(ossConfig);
       
       for (const key of keys) {
         // Determine destination key in recycle bin
         let destinationKey = '';
         
         if (rootPath && key.startsWith(rootPath)) {
            destinationKey = key.replace(rootPath, recyclePath);
         } else {
            destinationKey = recyclePath + key;
         }

         destinationKey = destinationKey.replace('//', '/');

         await client.copy(destinationKey, key);
         await client.delete(key);
       }
       
       // Success - state is already updated. 
       // Optionally trigger a background refresh to ensure consistency, 
       // but strictly not necessary if we trust the logic.
       // get().fetchFiles(false); 
       
     } catch (err: any) {
       // Revert
       set({ 
           files: previousFiles, 
           searchResults: previousSearchResults,
           error: err.message 
       });
       // Force refresh to be safe
       get().fetchFiles(true);
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
    const pathParts = oldKey.split('/');
    pathParts.pop(); 
    const folderPath = pathParts.join('/');
    const newKey = folderPath ? `${folderPath}/${newName}` : newName;

    const { files, searchResults } = get();
    const previousFiles = files;
    const previousSearchResults = searchResults;

    // Optimistic Update
    const updateFile = (list: OSSObject[], isSearchResult: boolean) => {
        return list.map(f => {
             const rootPath = ossConfig.rootPath || '';
             // If search result, name is relative to root. oldKey is full path (root+name).
             // If normal file, name is relative to currentPath. oldKey is full path.
             // It's easier to check if oldKey ends with f.name (loose check) or reconstruct.
             
             // Let's use exact match logic similar to delete
             // But here we know oldKey.
             
             // Construct what the full path of 'f' would be
             let fFullPath = '';
             if (isSearchResult) {
                 fFullPath = rootPath + f.name;
             } else {
                 const effectivePath = get().currentPath || rootPath;
                 fFullPath = effectivePath + f.name;
             }
             
             if (fFullPath === oldKey) {
                 // Found it. Update name.
                 // For display name (f.name), we need to replace the filename part.
                 const parts = f.name.split('/');
                 parts.pop(); // remove old name
                 const newRelativeName = parts.length > 0 ? parts.join('/') + '/' + newName : newName;
                 return { ...f, name: newRelativeName };
             }
             return f;
        });
    };

    set({
        files: updateFile(files, false),
        searchResults: updateFile(searchResults, true),
        isLoading: true // Keep loading true to show activity indicator if needed, or remove for pure optimistic
    });

    try {
      const client = initOSSClient(ossConfig);
      await client.copy(newKey, oldKey);
      await client.delete(oldKey);

      // Update downloadedTxtStore if exists
      const downloadedFile = await downloadedTxtStore.getItem<DownloadedFile>(oldKey);
      if (downloadedFile) {
          const newDownloadedFile: DownloadedFile = {
              ...downloadedFile,
              key: newKey,
              name: newName
          };
          await downloadedTxtStore.setItem(newKey, newDownloadedFile);
          await downloadedTxtStore.removeItem(oldKey);
      }

      set({ isLoading: false });
      // get().fetchFiles(true); // No need to refresh if optimistic worked
    } catch (err: any) {
      set({ 
          files: previousFiles, 
          searchResults: previousSearchResults,
          isLoading: false, 
          error: err.message 
      });
      throw err;
    }
  },

  moveFile: async (sourceKey, destinationPath) => {
    const { ossConfig } = useConfigStore.getState();
    if (!ossConfig) return;

    const fileName = sourceKey.split('/').pop();
    if (!fileName) return;

    const newKey = destinationPath + fileName;
    if (sourceKey === newKey) return;

    const { files, searchResults } = get();
    const previousFiles = files;
    const previousSearchResults = searchResults;

    // Optimistic: Remove from current list (since it moved)
    // Note: If we are in search results, we should technically update the path, not remove it?
    // But usually move implies it goes somewhere else.
    // If I move "a.txt" to "sub/a.txt", and I am searching for "a", it should still show up but with new path?
    // For simplicity, let's remove it from view or update it.
    // Given the UI doesn't support live update of search paths easily, removing it is safer to avoid broken links.
    
    // Logic: Remove from current view
    const shouldRemove = (f: OSSObject, isSearchResult: boolean) => {
         const rootPath = ossConfig.rootPath || '';
         let fFullPath = '';
         if (isSearchResult) {
             fFullPath = rootPath + f.name;
         } else {
             const effectivePath = get().currentPath || rootPath;
             fFullPath = effectivePath + f.name;
         }
         return fFullPath === sourceKey;
    };

    set({
        files: files.filter(f => !shouldRemove(f, false)),
        searchResults: searchResults.filter(f => !shouldRemove(f, true)),
        isLoading: true 
    });

    try {
      const client = initOSSClient(ossConfig);
      await client.copy(newKey, sourceKey);
      await client.delete(sourceKey);

      // Update downloadedTxtStore if exists
      const downloadedFile = await downloadedTxtStore.getItem<DownloadedFile>(sourceKey);
      if (downloadedFile) {
          const newDownloadedFile: DownloadedFile = {
              ...downloadedFile,
              key: newKey
          };
          await downloadedTxtStore.setItem(newKey, newDownloadedFile);
          await downloadedTxtStore.removeItem(sourceKey);
      }

      set({ isLoading: false });
      // get().fetchFiles(true);
    } catch (err: any) {
      set({ 
          files: previousFiles, 
          searchResults: previousSearchResults,
          isLoading: false, 
          error: err.message 
      });
      throw err;
    }
  },

  moveFiles: async (sourceKeys, destinationPath) => {
    const { ossConfig } = useConfigStore.getState();
    if (!ossConfig) return;

    // Filter out keys where source === destination (already in folder)
    const keysToMove = sourceKeys.filter(key => {
        const fileName = key.split('/').pop();
        if (!fileName) return false;
        const newKey = destinationPath + fileName;
        return key !== newKey;
    });

    if (keysToMove.length === 0) return;

    const { files, searchResults } = get();
    const previousFiles = files;
    const previousSearchResults = searchResults;

    // Optimistic Update: Remove from current view
    const shouldRemove = (f: OSSObject, isSearchResult: boolean) => {
         const rootPath = ossConfig.rootPath || '';
         let fFullPath = '';
         if (isSearchResult) {
             fFullPath = rootPath + f.name;
         } else {
             const effectivePath = get().currentPath || rootPath;
             fFullPath = effectivePath + f.name;
         }
         return keysToMove.includes(fFullPath);
    };

    set({
        files: files.filter(f => !shouldRemove(f, false)),
        searchResults: searchResults.filter(f => !shouldRemove(f, true)),
        isLoading: true,
        selectedFiles: [] // Clear selection after move start
    });

    try {
      const client = initOSSClient(ossConfig);
      
      // Process sequentially to avoid rate limits or errors, or parallel with limit?
      // Simple loop for now.
      for (const sourceKey of keysToMove) {
          const fileName = sourceKey.split('/').pop();
          if (!fileName) continue;
          
          const newKey = destinationPath + fileName;
          
          await client.copy(newKey, sourceKey);
          await client.delete(sourceKey);

          // Update downloadedTxtStore if exists
          const downloadedFile = await downloadedTxtStore.getItem<DownloadedFile>(sourceKey);
          if (downloadedFile) {
              const newDownloadedFile: DownloadedFile = {
                  ...downloadedFile,
                  key: newKey
              };
              await downloadedTxtStore.setItem(newKey, newDownloadedFile);
              await downloadedTxtStore.removeItem(sourceKey);
          }
      }

      set({ isLoading: false });
      // get().fetchFiles(true);
    } catch (err: any) {
      set({ 
          files: previousFiles, 
          searchResults: previousSearchResults,
          isLoading: false, 
          error: err.message 
      });
      throw err;
    }
  },

  uploadFiles: async (files, destinationPath) => {
    const { ossConfig } = useConfigStore.getState();
    if (!ossConfig) throw new Error("OSS Config missing");

    set({ isLoading: true, error: null });

    try {
        const client = initOSSClient(ossConfig);
        
        // Upload sequentially or parallel? Parallel is faster.
        const uploadPromises = files.map(file => {
            const key = destinationPath + file.name;
            return client.put(key, file);
        });

        await Promise.all(uploadPromises);
        
        set({ isLoading: false });
        get().fetchFiles(true);
    } catch (err: any) {
        set({ isLoading: false, error: err.message || 'Upload failed' });
        throw err;
    }
  }

}));
