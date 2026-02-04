import localforage from 'localforage';

localforage.config({
  name: 'oss_fms_plus',
  driver: localforage.INDEXEDDB
});

export const fileCacheStore = localforage.createInstance({
  name: 'oss_fms_plus',
  storeName: 'file_cache'
});

export const downloadedTxtStore = localforage.createInstance({
  name: 'oss_fms_plus',
  storeName: 'downloaded_txt'
});

export const recycleBinStore = localforage.createInstance({
  name: 'oss_fms_plus',
  storeName: 'recycle_bin'
});

export interface CachedFile {
  key: string;
  name: string;
  size: number;
  lastModified: string;
  contentType: string;
  parentPath: string;
}

export interface DownloadedFile {
  key: string;
  name: string;
  content: string;
  encoding: string;
  downloadTime: string;
  size: number;
}
