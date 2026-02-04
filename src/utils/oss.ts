import OSS from 'ali-oss';

export interface OSSConfig {
  region: string;
  bucket: string;
  accessKeyId: string;
  accessKeySecret: string;
  secure?: boolean;
}

export interface OSSObject {
  name: string;
  url: string;
  lastModified: string;
  size: number;
  type: 'file' | 'folder';
}

/**
 * Initialize OSS Client
 * @param config OSS Configuration
 * @returns OSS Client Instance
 */
export const initOSSClient = (config: OSSConfig): OSS => {
  return new OSS({
    region: config.region,
    accessKeyId: config.accessKeyId,
    accessKeySecret: config.accessKeySecret,
    bucket: config.bucket,
    secure: config.secure ?? true,
  });
};

/**
 * Check if the object is a folder based on naming convention
 * OSS doesn't have real folders, just objects with '/' suffix or prefixes
 */
export const isFolder = (name: string): boolean => {
  return name.endsWith('/');
};

/**
 * Get parent path
 */
export const getParentPath = (path: string): string => {
  if (!path || path === '/') return '';
  const parts = path.replace(/\/$/, '').split('/');
  parts.pop();
  return parts.length > 0 ? parts.join('/') + '/' : '';
};
