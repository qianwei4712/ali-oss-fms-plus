import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useConfigStore } from '@/store/configStore';
import { useFileStore } from '@/store/fileStore';
import { useTheme } from '@/hooks/useTheme';
import { initOSSClient, getParentPath } from '@/utils/oss';
import { downloadedTxtStore } from '@/utils/storage';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger, DrawerFooter, DrawerClose } from '@/components/ui/drawer';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { FolderPicker } from '@/components/FolderPicker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { ArrowLeft, Settings as SettingsIcon, Moon, Sun, Eye, List, ChevronLeft, ChevronRight, MoreVertical, Trash2, Move, FilePenLine, Sparkles } from 'lucide-react';
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
  const { ossConfig, filenameCleanPatterns } = useConfigStore();
  const { deleteFiles, moveFile, renameFile } = useFileStore();
  const { theme: globalTheme } = useTheme();
  
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [fontSize, setFontSize] = useState(16);
  const [theme, setTheme] = useState<'light' | 'dark' | 'sepia'>(() => {
    const saved = localStorage.getItem('reader_theme_pref');
    return (saved as any) || globalTheme;
  });
  
  // Chapter State
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [regexPattern, setRegexPattern] = useState(DEFAULT_REGEX);
  const [tempRegex, setTempRegex] = useState(DEFAULT_REGEX); // For input field
  const [isTocOpen, setIsTocOpen] = useState(false);
  const [isActionsOpen, setIsActionsOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isMoveOpen, setIsMoveOpen] = useState(false);
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Progress restoration state
  const [hasRestoredProgress, setHasRestoredProgress] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [showControls, setShowControls] = useState(false);

  const handleScroll = () => {
    if (scrollRef.current) {
        const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
        if (scrollHeight > clientHeight) {
            const progress = (scrollTop / (scrollHeight - clientHeight)) * 100;
            setScrollProgress(progress);
        } else {
            setScrollProgress(0);
        }
    }
  };

  const handleProgressChange = (value: number[]) => {
    const newProgress = value[0];
    setScrollProgress(newProgress);
    if (scrollRef.current) {
        const { scrollHeight, clientHeight } = scrollRef.current;
        const newScrollTop = (newProgress / 100) * (scrollHeight - clientHeight);
        scrollRef.current.scrollTop = newScrollTop;
    }
  };

  // Auto-scroll to active chapter in TOC
  const scrollToActiveChapter = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      setTimeout(() => {
        node.scrollIntoView({ behavior: 'auto', block: 'center' });
      }, 300);
    }
  }, []);

  const handleDelete = async () => {
    if (!path) return;
    try {
        const key = decodeURIComponent(path);
        
        if (!isOffline) {
            await deleteFiles([key]);
        }
        
        await downloadedTxtStore.removeItem(key);
        
        toast.success('File deleted');
        navigate(-1);
    } catch (e: any) {
        toast.error('Failed to delete file: ' + e.message);
    }
  };

  const handleMove = async (destinationPath: string) => {
    if (!path) return;
    try {
        const key = decodeURIComponent(path);
        await moveFile(key, destinationPath);
        toast.success('File moved');
        setIsMoveOpen(false);
        setIsActionsOpen(false);
        // Navigate to the new location or just go back
        // Going back seems safer as the current path is now invalid
        navigate(-1);
    } catch (e: any) {
        toast.error('Failed to move file: ' + e.message);
    }
  };

  const handleRename = async () => {
    if (!path || !renameValue.trim()) return;
    try {
        const key = decodeURIComponent(path);
        const newName = renameValue.trim();
        await renameFile(key, newName);
        toast.success('File renamed');
        setIsRenameOpen(false);
        setIsActionsOpen(false);
        
        // Construct the new path
        const pathParts = key.split('/');
        pathParts.pop();
        const newKey = pathParts.length > 0 ? `${pathParts.join('/')}/${newName}` : newName;
        
        // Navigate to new reader path
        // We use replace to update the URL without adding a new history entry if we want, 
        // but here maybe pushing is fine? No, replace is better for renaming.
        // However, Reader component depends on path param.
        navigate(`/reader/${encodeURIComponent(newKey)}`, { replace: true });
    } catch (e: any) {
        toast.error('Failed to rename file: ' + e.message);
    }
  };

  // Load saved reader settings
  useEffect(() => {
    const savedSize = localStorage.getItem('reader_fontSize');
    if (savedSize) setFontSize(parseInt(savedSize));
    
    const savedRegex = localStorage.getItem('reader_regex');
    if (savedRegex) {
        setRegexPattern(savedRegex);
        setTempRegex(savedRegex);
    }
  }, []);

  // Sync theme with global settings or saved preference
  useEffect(() => {
    const savedTheme = localStorage.getItem('reader_theme_pref');
    if (savedTheme) {
        setTheme(savedTheme as any);
    } else {
        setTheme(globalTheme);
    }
  }, [globalTheme]);

  const saveFontSize = (newSize: number) => {
    setFontSize(newSize);
    localStorage.setItem('reader_fontSize', newSize.toString());
  };

  const saveTheme = (newTheme: 'light' | 'dark' | 'sepia') => {
    setTheme(newTheme);
    localStorage.setItem('reader_theme_pref', newTheme);
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

  // Reset restored state when path changes
  useEffect(() => {
    setHasRestoredProgress(false);
  }, [path]);

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
        
        // Restore progress
        const savedProgress = localStorage.getItem('reader_progress');
        let initialIndex = 0;
        if (savedProgress && path) {
            try {
                const progressMap = JSON.parse(savedProgress);
                if (typeof progressMap[path] === 'number') {
                    initialIndex = progressMap[path];
                }
            } catch (e) {
                console.error("Failed to parse reader_progress", e);
            }
        }

        if (initialIndex >= 0 && initialIndex < newChapters.length) {
            setCurrentChapterIndex(initialIndex);
        } else {
            setCurrentChapterIndex(0);
        }
        
        // Mark as restored so we can start saving progress
        setHasRestoredProgress(true);
    } catch (e) {
        console.error("Regex error", e);
        // Fallback
        setChapters([{ title: 'Full Content', content: content, index: 0 }]);
        setCurrentChapterIndex(0);
        setHasRestoredProgress(true);
    }
  }, [content, regexPattern, path]);

  // Save progress
  useEffect(() => {
    if (!path || !hasRestoredProgress) return;
    try {
        const savedProgress = localStorage.getItem('reader_progress');
        let progressMap: Record<string, number> = {};
        if (savedProgress) {
            progressMap = JSON.parse(savedProgress);
        }
        progressMap[path] = currentChapterIndex;
        localStorage.setItem('reader_progress', JSON.stringify(progressMap));
    } catch (e) {
        console.error("Failed to save progress", e);
    }
  }, [currentChapterIndex, path, hasRestoredProgress]);

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

  const currentChapterContent = chapters[currentChapterIndex]?.content || '';
  const currentChapterTitle = chapters[currentChapterIndex]?.title || '';

  return (
    <div className={cn("relative h-[100dvh] w-full overflow-hidden transition-colors duration-300 bg-background text-foreground", theme)}>
      {/* Header (overlay/fixed) */}
      <div className={cn(
        "absolute top-0 left-0 right-0 h-14 flex items-center px-4 z-50 bg-background/95 backdrop-blur border-b transition-transform duration-300 ease-in-out",
        showControls ? "translate-y-0" : "-translate-y-full"
      )}>
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
            <DrawerContent className={cn("h-[80vh] text-foreground", theme)}>
                <DrawerHeader>
                    <DrawerTitle>Table of Contents</DrawerTitle>
                </DrawerHeader>
                <div className="flex-1 overflow-y-auto p-4 space-y-1">
                    {chapters.map((chapter) => (
                        <div 
                            key={chapter.index}
                            ref={currentChapterIndex === chapter.index ? scrollToActiveChapter : null}
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
          <DrawerContent className={cn("text-foreground", theme)}>
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
                  onValueChange={(vals) => saveFontSize(vals[0])} 
                />
              </div>
              
              <div className="space-y-2">
                <span className="text-sm font-medium">Theme</span>
                <div className="flex space-x-2">
                  <Button 
                    variant={theme === 'light' ? 'default' : 'outline'} 
                    className="flex-1"
                    onClick={() => saveTheme('light')}
                  >
                    <Sun className="h-4 w-4 mr-2" /> Light
                  </Button>
                  <Button 
                    variant={theme === 'dark' ? 'default' : 'outline'} 
                    className="flex-1"
                    onClick={() => saveTheme('dark')}
                  >
                    <Moon className="h-4 w-4 mr-2" /> Dark
                  </Button>
                  <Button 
                    variant={theme === 'sepia' ? 'default' : 'outline'} 
                    className="flex-1"
                    onClick={() => saveTheme('sepia')}
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

        {/* Actions Trigger */}
        <Drawer open={isActionsOpen} onOpenChange={setIsActionsOpen}>
            <DrawerTrigger asChild>
                <Button variant="ghost" size="icon">
                    <MoreVertical className="h-5 w-5" />
                </Button>
            </DrawerTrigger>
            <DrawerContent className={cn("text-foreground pb-6", theme)}>
                <DrawerHeader className="text-left">
                    <DrawerTitle>File Actions</DrawerTitle>
                </DrawerHeader>
                <div className="p-4 grid grid-cols-3 gap-3">
                    <Button 
                        variant="outline" 
                        className="flex flex-col items-center justify-center h-20 space-y-2 border-primary/10 bg-primary/5 hover:bg-primary/10 hover:text-primary transition-all rounded-xl text-primary" 
                        onClick={() => {
                            setIsActionsOpen(false);
                            // Set initial value for rename
                            if (path) {
                                const key = decodeURIComponent(path);
                                const fileName = key.split('/').pop() || '';
                                setRenameValue(fileName);
                            }
                            setIsRenameOpen(true);
                        }}
                    >
                        <FilePenLine className="h-6 w-6" />
                        <span className="text-xs font-medium">Rename</span>
                    </Button>
                    <Button 
                        variant="outline" 
                        className="flex flex-col items-center justify-center h-20 space-y-2 border-blue-500/10 bg-blue-500/5 hover:bg-blue-500/10 hover:text-blue-600 transition-all rounded-xl text-blue-600" 
                        onClick={() => {
                            setIsActionsOpen(false);
                            setIsMoveOpen(true);
                        }}
                    >
                        <Move className="h-6 w-6" />
                        <span className="text-xs font-medium">Move</span>
                    </Button>
                    <Button 
                        variant="outline" 
                        className="flex flex-col items-center justify-center h-20 space-y-2 border-destructive/10 bg-destructive/5 hover:bg-destructive/10 hover:text-destructive transition-all rounded-xl text-destructive" 
                        onClick={() => {
                            setIsActionsOpen(false);
                            setIsDeleteOpen(true);
                        }}
                    >
                        <Trash2 className="h-6 w-6" />
                        <span className="text-xs font-medium">Delete</span>
                    </Button>
                </div>
                <DrawerFooter className="pt-0">
                    <DrawerClose asChild>
                        <Button variant="ghost" className="w-full">Cancel</Button>
                    </DrawerClose>
                </DrawerFooter>
            </DrawerContent>
        </Drawer>
      </div>

      {/* Content */}
      <div 
        ref={scrollRef}
        onScroll={handleScroll}
        onClick={() => setShowControls(!showControls)}
        className="h-full w-full overflow-y-auto whitespace-pre-wrap leading-relaxed outline-none p-4 pb-32 pt-20"
        style={{ fontSize: `${fontSize}px` }}
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <span className="animate-pulse">Loading content...</span>
          </div>
        ) : (
          <>
            <div className="min-h-[60vh] max-w-3xl mx-auto">
                {currentChapterContent}
            </div>
            
            {/* Navigation Buttons */}
            <div className="flex justify-between items-center py-8 mt-4 border-t max-w-3xl mx-auto" onClick={(e) => e.stopPropagation()}>
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
      
      {/* Progress Footer */}
      {!isLoading && (
        <div className={cn(
            "absolute bottom-0 left-0 right-0 min-h-16 h-auto pb-[env(safe-area-inset-bottom)] bg-background/95 backdrop-blur border-t flex items-center px-4 z-50 transition-transform duration-300 ease-in-out",
            showControls ? "translate-y-0" : "translate-y-full"
        )}>
            <span className="text-xs text-muted-foreground w-12 text-right mr-4 font-mono select-none">
                {Math.round(scrollProgress)}%
            </span>
            <Slider
                value={[scrollProgress]}
                max={100}
                step={1}
                onValueChange={handleProgressChange}
                className="flex-1 cursor-pointer py-4"
            />
        </div>
      )}

      {/* Rename Dialog */}
      <Dialog open={isRenameOpen} onOpenChange={setIsRenameOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Rename File</DialogTitle>
                <DialogDescription>Enter a new name for the file.</DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-3">
                <div className="flex space-x-2">
                    <Input 
                        className="flex-1"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        placeholder="New filename"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                handleRename();
                            }
                        }}
                    />
                    {filenameCleanPatterns && filenameCleanPatterns.length > 0 && (
                        <Button 
                            variant="secondary" 
                            size="icon"
                            onClick={() => {
                                let newValue = renameValue;
                                filenameCleanPatterns.forEach(p => {
                                    newValue = newValue.replaceAll(p, '');
                                });
                                setRenameValue(newValue);
                                toast.success('Applied clean patterns');
                            }}
                            title="Auto Clean Filename"
                        >
                            <Sparkles className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsRenameOpen(false)}>Cancel</Button>
                <Button onClick={handleRename}>Rename</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move Dialog */}
      <Dialog open={isMoveOpen} onOpenChange={setIsMoveOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Move to...</DialogTitle>
                <DialogDescription>Select destination folder</DialogDescription>
            </DialogHeader>
            <FolderPicker 
                currentPath={path ? getParentPath(decodeURIComponent(path)) : ''}
                onSelect={handleMove}
                onCancel={() => setIsMoveOpen(false)}
            />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Confirm Deletion</DialogTitle>
                <DialogDescription>
                    Are you sure you want to delete this file? This action cannot be undone.
                </DialogDescription>
            </DialogHeader>
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>Cancel</Button>
                <Button variant="destructive" onClick={() => {
                    handleDelete();
                    setIsDeleteOpen(false);
                }}>Delete</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default Reader;
