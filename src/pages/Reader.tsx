import { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useConfigStore } from '@/store/configStore';
import { initOSSClient } from '@/utils/oss';
import { downloadedTxtStore } from '@/utils/storage';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger, DrawerFooter, DrawerClose } from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { ArrowLeft, Settings as SettingsIcon, Moon, Sun, Eye, List, ChevronLeft, ChevronRight } from 'lucide-react';
import chardet from 'chardet';
import { cn } from '@/lib/utils';

interface Chapter {
  title: string;
  content: string;
  index: number;
}

const DEFAULT_REGEX = "(第[零一二三四五六七八九十百千\\d]+章[^\\n]*)";

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
  
  // Chapter State
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [regexPattern, setRegexPattern] = useState(DEFAULT_REGEX);
  const [tempRegex, setTempRegex] = useState(DEFAULT_REGEX); // For input field
  const [isTocOpen, setIsTocOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load saved reader settings
  useEffect(() => {
    const savedSize = localStorage.getItem('reader_fontSize');
    if (savedSize) setFontSize(parseInt(savedSize));
    const savedTheme = localStorage.getItem('reader_theme');
    if (savedTheme) setTheme(savedTheme as any);
    const savedRegex = localStorage.getItem('reader_regex');
    if (savedRegex) {
        setRegexPattern(savedRegex);
        setTempRegex(savedRegex);
    }
  }, []);

  const saveSettings = (newSize: number, newTheme: 'light' | 'dark' | 'sepia') => {
    setFontSize(newSize);
    setTheme(newTheme);
    localStorage.setItem('reader_fontSize', newSize.toString());
    localStorage.setItem('reader_theme', newTheme);
  };

  const saveRegex = () => {
    setRegexPattern(tempRegex);
    localStorage.setItem('reader_regex', tempRegex);
    toast.success('Regex updated, reprocessing chapters...');
  };

  useEffect(() => {
    const loadContent = async () => {
      if (!path) return;
      const key = decodeURIComponent(path);
      setIsLoading(true);

      try {
        let rawContent = '';

        if (isOffline) {
          const file = await downloadedTxtStore.getItem(key) as any;
          if (!file) throw new Error('File not found in downloads');
          rawContent = file.content;
        } else {
          if (!ossConfig) {
            navigate('/settings');
            return;
          }
          const client = initOSSClient(ossConfig);
          const result = await client.get(key);
          if (result.content) {
             const raw = result.content;
             if (typeof raw === 'string') {
               rawContent = raw;
             } else {
               const uint8 = new Uint8Array(raw as any);
               const encoding = chardet.detect(uint8);
               const decoder = new TextDecoder(encoding || 'utf-8');
               rawContent = decoder.decode(uint8);
             }
          }
        }
        setContent(rawContent);
      } catch (err: any) {
        console.error(err);
        toast.error('Failed to load file: ' + err.message);
      } finally {
        setIsLoading(false);
      }
    };

    loadContent();
  }, [path, isOffline, ossConfig, navigate]);

  // Process Chapters
  useEffect(() => {
    if (!content) return;

    try {
        const regex = new RegExp(regexPattern, 'g');
        const matches = [...content.matchAll(regex)];
        
        if (matches.length === 0) {
            setChapters([{ title: 'Full Content', content: content, index: 0 }]);
            setCurrentChapterIndex(0);
            return;
        }

        const newChapters: Chapter[] = [];
        
        // Content before first match
        if (matches[0].index && matches[0].index > 0) {
            newChapters.push({
                title: 'Prolog / Start',
                content: content.substring(0, matches[0].index),
                index: 0
            });
        }

        for (let i = 0; i < matches.length; i++) {
            const match = matches[i];
            const start = match.index!;
            const end = i < matches.length - 1 ? matches[i + 1].index! : content.length;
            
            newChapters.push({
                title: match[0].trim(), // Use the matched string as title (e.g., "第1章...")
                content: content.substring(start, end),
                index: newChapters.length
            });
        }

        setChapters(newChapters);
        setCurrentChapterIndex(0);
    } catch (e) {
        console.error("Regex error", e);
        // Fallback
        setChapters([{ title: 'Full Content', content: content, index: 0 }]);
        setCurrentChapterIndex(0);
    }
  }, [content, regexPattern]);

  // Scroll to top when chapter changes
  useEffect(() => {
    if (scrollRef.current) {
        scrollRef.current.scrollTop = 0;
    }
  }, [currentChapterIndex]);

  const handleNextChapter = () => {
    if (currentChapterIndex < chapters.length - 1) {
        setCurrentChapterIndex(prev => prev + 1);
    } else {
        toast.info('This is the last chapter');
    }
  };

  const handlePrevChapter = () => {
    if (currentChapterIndex > 0) {
        setCurrentChapterIndex(prev => prev - 1);
    } else {
        toast.info('This is the first chapter');
    }
  };

  const themeClasses = {
    light: 'bg-white text-gray-900',
    dark: 'bg-gray-900 text-gray-100',
    sepia: 'bg-[#f4ecd8] text-[#5b4636]',
  };

  const currentChapterContent = chapters[currentChapterIndex]?.content || '';
  const currentChapterTitle = chapters[currentChapterIndex]?.title || '';

  return (
    <div className={cn("min-h-screen flex flex-col transition-colors duration-300 h-screen overflow-hidden", themeClasses[theme])}>
      {/* Header (overlay/fixed) */}
      <div className={cn("flex-none h-14 flex items-center px-4 z-50 bg-background/80 backdrop-blur border-b")}>
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="ml-2 flex-1 min-w-0">
            <h1 className="font-medium truncate text-sm">
                {path ? decodeURIComponent(path).split('/').pop() : 'Reader'}
            </h1>
            <p className="text-xs text-muted-foreground truncate">
                {currentChapterTitle} ({currentChapterIndex + 1}/{chapters.length})
            </p>
        </div>
        
        {/* Table of Contents Trigger */}
        <Drawer open={isTocOpen} onOpenChange={setIsTocOpen}>
            <DrawerTrigger asChild>
                <Button variant="ghost" size="icon">
                    <List className="h-5 w-5" />
                </Button>
            </DrawerTrigger>
            <DrawerContent className="h-[80vh]">
                <DrawerHeader>
                    <DrawerTitle>Table of Contents</DrawerTitle>
                </DrawerHeader>
                <div className="flex-1 overflow-y-auto p-4 space-y-1">
                    {chapters.map((chapter) => (
                        <div 
                            key={chapter.index}
                            className={cn(
                                "p-3 rounded-md cursor-pointer hover:bg-accent text-sm truncate",
                                currentChapterIndex === chapter.index ? "bg-accent font-medium" : ""
                            )}
                            onClick={() => {
                                setCurrentChapterIndex(chapter.index);
                                setIsTocOpen(false);
                            }}
                        >
                            {chapter.title}
                        </div>
                    ))}
                </div>
            </DrawerContent>
        </Drawer>

        {/* Settings Trigger */}
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

              <div className="space-y-2">
                 <Label htmlFor="regex">Chapter Splitting Regex</Label>
                 <div className="flex space-x-2">
                    <Input 
                        id="regex"
                        value={tempRegex}
                        onChange={(e) => setTempRegex(e.target.value)}
                        placeholder="e.g. (第[0-9]+章)"
                    />
                    <Button onClick={saveRegex}>Apply</Button>
                 </div>
                 <p className="text-xs text-muted-foreground">
                    Default: {DEFAULT_REGEX}
                 </p>
              </div>
            </div>
          </DrawerContent>
        </Drawer>
      </div>

      {/* Content */}
      <div 
        ref={scrollRef}
        className="flex-1 p-4 overflow-y-auto whitespace-pre-wrap leading-relaxed outline-none"
        style={{ fontSize: `${fontSize}px` }}
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <span className="animate-pulse">Loading content...</span>
          </div>
        ) : (
          <>
            <div className="min-h-[60vh]">
                {currentChapterContent}
            </div>
            
            {/* Navigation Buttons */}
            <div className="flex justify-between items-center py-8 mt-4 border-t">
                <Button 
                    variant="outline" 
                    onClick={handlePrevChapter}
                    disabled={currentChapterIndex === 0}
                >
                    <ChevronLeft className="h-4 w-4 mr-2" /> Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                    {currentChapterIndex + 1} / {chapters.length}
                </span>
                <Button 
                    variant="outline" 
                    onClick={handleNextChapter}
                    disabled={currentChapterIndex === chapters.length - 1}
                >
                    Next <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Reader;
