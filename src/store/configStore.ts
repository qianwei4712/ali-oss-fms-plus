import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { OSSConfig } from '@/utils/oss';
import { encrypt, decrypt } from '@/utils/crypto';

interface ConfigState {
  ossConfig: OSSConfig | null;
  theme: 'light' | 'dark' | 'sepia';
  setOssConfig: (config: OSSConfig) => void;
  setTheme: (theme: 'light' | 'dark' | 'sepia') => void;
  clearConfig: () => void;
}

// Custom storage that encrypts sensitive data
const encryptedStorage = {
  getItem: (name: string): string | null => {
    const value = localStorage.getItem(name);
    if (!value) return null;
    try {
      // We assume the whole storage string is encrypted or just specific fields?
      // For simplicity, we'll store the JSON string as is, but we could encrypt specific fields.
      // However, the requirement says "encrypted storage".
      // Let's encrypt the entire state JSON string.
      const decrypted = decrypt(value);
      return decrypted || null;
    } catch {
      return null;
    }
  },
  setItem: (name: string, value: string) => {
    const encrypted = encrypt(value);
    localStorage.setItem(name, encrypted);
  },
  removeItem: (name: string) => {
    localStorage.removeItem(name);
  },
};

export const useConfigStore = create<ConfigState>()(
  persist(
    (set) => ({
      ossConfig: null,
      theme: 'light',
      setOssConfig: (config) => set({ ossConfig: config }),
      setTheme: (theme) => {
        set({ theme });
        // Apply theme to document
        const root = window.document.documentElement;
        root.classList.remove('light', 'dark', 'sepia');
        if (theme === 'sepia') {
           // Sepia might be a custom class or just handled in components
           // For now, let's treat it as a specific class
           root.classList.add('sepia');
        } else {
           root.classList.add(theme);
        }
      },
      clearConfig: () => set({ ossConfig: null }),
    }),
    {
      name: 'oss-fms-config',
      storage: createJSONStorage(() => encryptedStorage),
    }
  )
);
