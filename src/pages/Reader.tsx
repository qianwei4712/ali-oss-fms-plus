import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useConfigStore } from '@/store/configStore';
import { initOSSClient } from '@/utils/oss';
import { downloadedTxtStore } from '@/utils/storage';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer';
import { toast } from 'sonner';
import { ArrowLeft, Settings as SettingsIcon, Moon, Sun, Eye } from 'lucide-react';
import chardet from 'chardet';
import { cn } from '@/lib/utils';

const Reader = () => {
  const { path } = useParams();
  const [searchParams] = useSearchParams();
  const isOffline = searchParams.get('offline') === 'true';
  const navigate = useNavigate();
  const { ossConfig } = useConfigStore();
  
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [fontSize, setFontSize] = useState(16);
  const [theme, setTheme] = useState<'light' | 'dark' | 'sepia'>('light');

  // Load saved reader settings (could be in a store)
  useEffect(() => {
    const savedSize = localStorage.getItem('reader_fontSize');
    if (savedSize) setFontSize(parseInt(savedSize));
    const savedTheme = localStorage.getItem('reader_theme');
    if (savedTheme) setTheme(savedTheme as any);
  }, []);

  const saveSettings = (newSize: number, newTheme: 'light' | 'dark' | 'sepia') => {
    setFontSize(newSize);
    setTheme(newTheme);
    localStorage.setItem('reader_fontSize', newSize.toString());
    localStorage.setItem('reader_theme', newTheme);
  };

  useEffect(() => {
    const loadContent = async () => {
      if (!path) return;
      const key = decodeURIComponent(path);
      setIsLoading(true);

      try {
        let arrayBuffer: ArrayBuffer;

        if (isOffline) {
          const file = await downloadedTxtStore.getItem(key) as any;
          if (!file) throw new Error('File not found in downloads');
          // If content is stored as string, convert to buffer for consistency or just use it
          // In Downloads.tsx we stored as string (UTF-8).
          setContent(file.content);
          setIsLoading(false);
          return;
        } else {
          if (!ossConfig) {
            navigate('/settings');
            return;
          }
          const client = initOSSClient(ossConfig);
          const result = await client.get(key);
          // client.get returns content as Buffer/ArrayBuffer in browser?
          // Ali-OSS in browser usually returns content as Blob or Buffer depending on config?
          // Default is usually Buffer-like.
          if (result.content) {
             // In browser, it might be a Uint8Array or ArrayBuffer
             const raw = result.content;
             if (typeof raw === 'string') {
               setContent(raw);
             } else {
               // It's a buffer/array. Detect encoding.
               // chardet needs Uint8Array
               const uint8 = new Uint8Array(raw as any);
               const encoding = chardet.detect(uint8);
               const decoder = new TextDecoder(encoding || 'utf-8');
               setContent(decoder.decode(uint8));
             }
          }
        }
      } catch (err: any) {
        console.error(err);
        toast.error('Failed to load file: ' + err.message);
      } finally {
        setIsLoading(false);
      }
    };

    loadContent();
  }, [path, isOffline, ossConfig, navigate]);

  const themeClasses = {
    light: 'bg-white text-gray-900',
    dark: 'bg-gray-900 text-gray-100',
    sepia: 'bg-[#f4ecd8] text-[#5b4636]',
  };

  return (
    <div className={cn("min-h-screen flex flex-col transition-colors duration-300", themeClasses[theme])}>
      {/* Header (overlay/fixed) */}
      <div className={cn("fixed top-0 left-0 right-0 h-14 flex items-center px-4 z-50 transition-opacity opacity-0 hover:opacity-100 focus-within:opacity-100 active:opacity-100 bg-background/80 backdrop-blur border-b")}>
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <span className="ml-2 font-medium truncate flex-1">{path ? decodeURIComponent(path).split('/').pop() : 'Reader'}</span>
        
        <Drawer>
          <DrawerTrigger asChild>
            <Button variant="ghost" size="icon">
              <SettingsIcon className="h-5 w-5" />
            </Button>
          </DrawerTrigger>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Reader Settings</DrawerTitle>
            </DrawerHeader>
            <div className="p-4 space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Font Size</span>
                  <span className="text-sm text-muted-foreground">{fontSize}px</span>
                </div>
                <Slider 
                  value={[fontSize]} 
                  min={12} 
                  max={32} 
                  step={1} 
                  onValueChange={(vals) => saveSettings(vals[0], theme)} 
                />
              </div>
              
              <div className="space-y-2">
                <span className="text-sm font-medium">Theme</span>
                <div className="flex space-x-2">
                  <Button 
                    variant={theme === 'light' ? 'default' : 'outline'} 
                    className="flex-1"
                    onClick={() => saveSettings(fontSize, 'light')}
                  >
                    <Sun className="h-4 w-4 mr-2" /> Light
                  </Button>
                  <Button 
                    variant={theme === 'dark' ? 'default' : 'outline'} 
                    className="flex-1"
                    onClick={() => saveSettings(fontSize, 'dark')}
                  >
                    <Moon className="h-4 w-4 mr-2" /> Dark
                  </Button>
                  <Button 
                    variant={theme === 'sepia' ? 'default' : 'outline'} 
                    className="flex-1"
                    onClick={() => saveSettings(fontSize, 'sepia')}
                  >
                    <Eye className="h-4 w-4 mr-2" /> Sepia
                  </Button>
                </div>
              </div>
            </div>
          </DrawerContent>
        </Drawer>
      </div>

      {/* Content */}
      <div 
        className="flex-1 p-4 pt-16 pb-16 overflow-y-auto whitespace-pre-wrap leading-relaxed outline-none"
        style={{ fontSize: `${fontSize}px` }}
        onClick={(e) => {
          // Toggle header visibility logic could go here, 
          // but CSS hover is simpler for MVP
        }}
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <span className="animate-pulse">Loading content...</span>
          </div>
        ) : (
          content
        )}
      </div>
    </div>
  );
};

export default Reader;
