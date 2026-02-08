import { useConfigStore } from '@/store/configStore';

export function useTheme() {
  const { theme, setTheme } = useConfigStore();

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  return {
    theme,
    toggleTheme,
    isDark: theme === 'dark'
  };
} 