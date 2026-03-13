import { useEffect, useState, useRef, useCallback, useLayoutEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useConfigStore } from '@/store/configStore';
import { useFileStore } from '@/store/fileStore';
import { initOSSClient, getParentPath } from '@/utils/oss';
import { downloadedTxtStore, DownloadedFile } from '@/utils/storage';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger, DrawerFooter, DrawerClose } from '@/components/ui/drawer';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { FolderPicker } from '@/components/FolderPicker';
import { RenameDialog } from '@/components/RenameDialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { ArrowLeft, Settings as SettingsIcon, Moon, Sun, Eye, List, ChevronLeft, ChevronRight, MoreVertical, Trash2, Move, FilePenLine, Check, Download } from 'lucide-react';
import jschardet from 'jschardet';
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
  const { ossConfig, theme, setTheme } = useConfigStore();
  const { deleteFiles, moveFile, renameFile } = useFileStore();
  
  const [content, setContent] = useState('');
  const [rawBuffer, setRawBuffer] = useState<ArrayBuffer | null>(null);
  const [encoding, setEncoding] = useState('auto');
  const [isLoading, setIsLoading] = useState(true);
  const [fontSize, setFontSize] = useState(16);
  
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
  const [isDownloaded, setIsDownloaded] = useState(false);

  // Check if file is downloaded
  useEffect(() => {
    const checkStatus = async () => {
      if (!path) return;
      const key = decodeURIComponent(path);
      try {
        const file = await downloadedTxtStore.getItem(key);
        setIsDownloaded(!!file);
      } catch (e) {
        console.error("Failed to check download status", e);
      }
    };
    checkStatus();
  }, [path]);

  const handleDownload = async () => {
    if (!path || !content) return;
    const key = decodeURIComponent(path);
    const fileName = key.split('/').pop() || 'unknown.txt';
    
    try {
        const downloadedFile: DownloadedFile = {
            key,
            name: fileName,
            content,
            encoding: 'UTF-8', 
            downloadTime: new Date().toISOString(),
            size: new Blob([content]).size
        };
        
        await downloadedTxtStore.setItem(key, downloadedFile);
        setIsDownloaded(true);
        toast.success('Downloaded to offline storage');
        setIsActionsOpen(false);
    } catch (e) {
        toast.error('Failed to download: ' + (e instanceof Error ? e.message : String(e)));
    }
  };

  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Progress restoration state
  const [hasRestoredProgress, setHasRestoredProgress] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [showControls, setShowControls] = useState(false);
  const lastScrollTopRef = useRef(0);
  const isUserInteractingRef = useRef(false);

  const handleScroll = useCallback(() => {
    const scrollTop = window.scrollY;
    const scrollHeight = document.documentElement.scrollHeight;
    const clientHeight = window.innerHeight;
    
    // Always update control visibility logic
    const currentScrollTop = scrollTop;
    const lastScrollTop = lastScrollTopRef.current;
    const scrollDelta = currentScrollTop - lastScrollTop;

    // Ignore bounce/rubber-banding at edges (especially on iOS)
    if (currentScrollTop < 0 || currentScrollTop > (scrollHeight - clientHeight)) {
        return;
    }

    // Only toggle controls if NOT interacting with slider
    if (Math.abs(scrollDelta) > 10 && !isUserInteractingRef.current) {
        if (scrollDelta > 0) {
            setShowControls(false);
        } else if (scrollDelta < 0) {
            setShowControls(true);
        }
        lastScrollTopRef.current = currentScrollTop;
    } else if (isUserInteractingRef.current) {
        lastScrollTopRef.current = currentScrollTop;
    }

    // Calculate progress - ALWAYS update state to match reality
    if (scrollHeight > clientHeight) {
        let progress = (scrollTop / (scrollHeight - clientHeight)) * 100;
        progress = Math.min(100, Math.max(0, progress));
        setScrollProgress(progress);
    } else {
        setScrollProgress(0);
    }
  }, []);

  // Bind window scroll event
  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  const handleProgressChange = useCallback((value: number[]) => {
    const newProgress = value[0];
    
    // Set lock for controls visibility only
    isUserInteractingRef.current = true;
    
    // Update local state
    setScrollProgress(newProgress);
    
    const scrollHeight = document.documentElement.scrollHeight;
    const clientHeight = window.innerHeight;
    const targetScrollTop = (newProgress / 100) * (scrollHeight - clientHeight);
    
    // Directly set scroll position
    window.scrollTo({
        top: targetScrollTop,
        behavior: 'auto' // Instant jump to prevent fighting with slider
    });
    lastScrollTopRef.current = targetScrollTop;
  }, []);

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
        
        // Always attempt to delete from OSS if config is available
        // This satisfies the requirement to delete both remote and local
        await deleteFiles([key]);
        
        await downloadedTxtStore.removeItem(key);
        
        toast.success('File deleted');
        navigate(-1);
    } catch (e: unknown) {
        toast.error('Failed to delete file: ' + (e instanceof Error ? e.message : String(e)));
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
    } catch (e: unknown) {
        toast.error('Failed to move file: ' + (e instanceof Error ? e.message : String(e)));
    }
  };

  const handleRenameConfirm = async (newName: string) => {
    if (!path) return;
    try {
        const key = decodeURIComponent(path);
        // newName already has .txt from RenameDialog
        await renameFile(key, newName);
        toast.success('File renamed');
        setIsRenameOpen(false);
        setIsActionsOpen(false);
        
        // Construct the new path
        const pathParts = key.split('/');
        pathParts.pop();
        const newKey = pathParts.length > 0 ? `${pathParts.join('/')}/${newName}` : newName;
        
        // Navigate to new reader path
        navigate(`/reader/${encodeURIComponent(newKey)}`, { replace: true });
    } catch (e: unknown) {
        toast.error('Failed to rename file: ' + (e instanceof Error ? e.message : String(e)));
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
  // Removed local theme sync logic as we now use global store directly

  const saveFontSize = (newSize: number) => {
    setFontSize(newSize);
    localStorage.setItem('reader_fontSize', newSize.toString());
  };

  const saveTheme = (newTheme: 'light' | 'dark' | 'sepia') => {
    setTheme(newTheme);
    // localStorage.setItem('reader_theme_pref', newTheme); // No longer needed
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
        let buffer: ArrayBuffer;

        if (isOffline) {
          const file = await downloadedTxtStore.getItem(key) as DownloadedFile | null;
          if (!file) throw new Error('File not found in downloads');
          // If offline file was saved as string, we need to convert back to buffer for consistent handling
          // But wait, offline files might have been saved already decoded.
          // Let's check storage format. Currently we save 'content' as string.
          // This means if it was saved wrong, it's wrong forever.
          // Ideally we should save raw buffer or base64.
          // But for now, let's assume if it's string, it's already decoded (or double decoded if wrong).
          // To support re-decoding, we might need to re-fetch or change storage to Blob/ArrayBuffer.
          // Given current constraints, let's just use the string content directly if offline.
          // TODO: Upgrade offline storage to store Blob/ArrayBuffer for better encoding support.
          setContent(file.content);
          setRawBuffer(null); // No raw buffer for offline files (yet)
          setIsLoading(false);
          return;
        } 
        
        if (!ossConfig) {
          navigate('/settings');
          return;
        }
        
        const client = initOSSClient(ossConfig);
        const url = client.signatureUrl(key, { expires: 3600 });
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);
        }
        
        buffer = await response.arrayBuffer();
        setRawBuffer(buffer);
        // Content decoding will be handled by the effect depending on rawBuffer and encoding state
      } catch (err: unknown) {
        console.error(err);
        toast.error('Failed to load file: ' + (err instanceof Error ? err.message : String(err)));
        setIsLoading(false);
      }
    };

    loadContent();
  }, [path, isOffline, ossConfig, navigate]);

  // Handle Decoding
  useEffect(() => {
    if (!rawBuffer) return;
    
    try {
        const uint8Array = new Uint8Array(rawBuffer);
        let targetEncoding = encoding;

        if (targetEncoding === 'auto') {
            // Detect encoding using a larger sample
            let binaryString = '';
            // Check up to 50KB to be more accurate
            const len = Math.min(uint8Array.length, 1024 * 50); 
            for (let i = 0; i < len; i++) {
                binaryString += String.fromCharCode(uint8Array[i]);
            }
            
            const detected = jschardet.detect(binaryString);
            console.log('Detected encoding:', detected);
            
            targetEncoding = detected.encoding || 'utf-8';
            
            // Smart corrections
            const upper = targetEncoding.toUpperCase();
            if (['GB2312', 'GBK'].includes(upper)) {
                targetEncoding = 'GB18030';
            } else if (upper === 'WINDOWS-1252' && detected.confidence < 0.95) {
                // Windows-1252 is often a misinterpretation of GBK
                console.warn('Low confidence Windows-1252 detected, attempting GB18030 fallback');
                targetEncoding = 'GB18030';
            } else if (upper === 'ISO-8859-1' && detected.confidence < 0.95) {
                 // Similar for ISO-8859-1
                 targetEncoding = 'GB18030';
            }
        }

        console.log(`Decoding with: ${targetEncoding}`);
        
        try {
            const decoder = new TextDecoder(targetEncoding);
            const decoded = decoder.decode(uint8Array);
            setContent(decoded);
        } catch (e) {
            console.error(`Failed to decode with ${targetEncoding}`, e);
            // Fallback to UTF-8
            const decoder = new TextDecoder('utf-8');
            setContent(decoder.decode(uint8Array));
            toast.error(`Failed to decode with ${targetEncoding}, falling back to UTF-8`);
        }
    } catch (e) {
        console.error("Decoding error", e);
        toast.error("Error decoding file content");
    } finally {
        setIsLoading(false);
    }
  }, [rawBuffer, encoding]);

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

  const [isSwitching, setIsSwitching] = useState(false);

  // Scroll to top when chapter changes
  useLayoutEffect(() => {
    if (!isSwitching) {
        window.scrollTo(0, 0);
    }
  }, [currentChapterIndex, isSwitching]);

  const handleNextChapter = (e?: React.MouseEvent) => {
    if (e) {
        e.preventDefault();
        e.currentTarget.blur();
    }

    if (currentChapterIndex < chapters.length - 1) {
        // 1. Enter switching state (hides content, resets scroll physically)
        setIsSwitching(true);
        setScrollProgress(0);
        
        // 2. Wait a tick to let the UI update (empty state)
        setTimeout(() => {
            setCurrentChapterIndex(prev => prev + 1);
            // 3. Exit switching state to show new content
            // We use another timeout to ensure the state update has processed
            requestAnimationFrame(() => {
                setIsSwitching(false);
            });
        }, 10);
    } else {
        toast.info('This is the last chapter');
    }
  };

  const handlePrevChapter = (e?: React.MouseEvent) => {
    if (e) {
        e.preventDefault();
        e.currentTarget.blur();
    }

    if (currentChapterIndex > 0) {
        setIsSwitching(true);
        setScrollProgress(0);
        
        setTimeout(() => {
            setCurrentChapterIndex(prev => prev - 1);
            requestAnimationFrame(() => {
                setIsSwitching(false);
            });
        }, 10);
    } else {
        toast.info('This is the first chapter');
    }
  };

  const currentChapterContent = chapters[currentChapterIndex]?.content || '';
  const currentChapterTitle = chapters[currentChapterIndex]?.title || '';

  return (
    <div className={cn("relative min-h-[100dvh] w-full transition-colors duration-300 bg-background text-foreground", theme)}>
      {/* Header (overlay/fixed) */}
      <div className={cn(
        "fixed top-4 left-4 right-4 h-14 flex items-center px-4 z-50 glass-panel rounded-2xl border border-white/10 shadow-lg ring-1 ring-black/5 transition-transform duration-300 ease-in-out",
        showControls ? "translate-y-0" : "-translate-y-[200%]"
      )}>
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="h-9 w-9 hover:bg-primary/20 hover:text-primary rounded-xl transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="ml-3 flex-1 min-w-0">
            <h1 className="font-bold truncate text-sm text-glow">
                {path ? decodeURIComponent(path).split('/').pop() : 'Reader'}
            </h1>
            <p className="text-xs text-muted-foreground truncate font-medium opacity-80">
                {currentChapterTitle} ({currentChapterIndex + 1}/{chapters.length})
            </p>
        </div>
        
        {/* Table of Contents Trigger */}
        <Drawer open={isTocOpen} onOpenChange={setIsTocOpen}>
            <DrawerTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 hover:bg-primary/20 hover:text-primary rounded-xl transition-colors">
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
                                setIsTocOpen(false);
                                if (currentChapterIndex === chapter.index) return;
                                
                                setIsSwitching(true);
                                setScrollProgress(0);
                                
                                setTimeout(() => {
                                    setCurrentChapterIndex(chapter.index);
                                    requestAnimationFrame(() => {
                                        setIsSwitching(false);
                                    });
                                }, 10);
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
            <Button variant="ghost" size="icon" className="h-9 w-9 hover:bg-primary/20 hover:text-primary rounded-xl transition-colors">
              <SettingsIcon className="h-5 w-5" />
            </Button>
          </DrawerTrigger>
          <DrawerContent className={cn("text-foreground glass-panel border-t border-white/10", theme)}>
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
                <span className="text-sm font-medium">Encoding</span>
                <div className="grid grid-cols-2 gap-2">
                    {['auto', 'utf-8', 'GB18030', 'Big5'].map((enc) => (
                        <Button
                            key={enc}
                            variant={encoding === enc ? 'default' : 'outline'}
                            className="justify-between"
                            onClick={() => {
                                setEncoding(enc);
                                setIsLoading(true); // Trigger loading state for visual feedback
                            }}
                        >
                            {enc === 'auto' ? 'Auto Detect' : enc}
                            {encoding === enc && <Check className="h-4 w-4 ml-2" />}
                        </Button>
                    ))}
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
                <Button variant="ghost" size="icon" className="h-9 w-9 hover:bg-primary/20 hover:text-primary rounded-xl transition-colors">
                    <MoreVertical className="h-5 w-5" />
                </Button>
            </DrawerTrigger>
            <DrawerContent className={cn("text-foreground pb-6 glass-panel border-t border-white/10", theme)}>
                <DrawerHeader className="text-left">
                    <DrawerTitle>File Actions</DrawerTitle>
                </DrawerHeader>
                <div className="p-4 grid grid-cols-2 gap-3">
                    <Button 
                        variant="outline" 
                        className="flex flex-col items-center justify-center h-20 space-y-2 border-primary/10 bg-primary/5 hover:bg-primary/10 hover:text-primary transition-all rounded-xl text-primary" 
                        onClick={() => {
                            setIsActionsOpen(false);
                            setIsRenameOpen(true);
                        }}
                    >
                        <FilePenLine className="h-6 w-6" />
                        <span className="text-xs font-medium">Rename</span>
                    </Button>
                    <Button 
                        variant="outline" 
                        className="flex flex-col items-center justify-center h-20 space-y-2 border-info/10 bg-info/5 hover:bg-info/10 hover:text-info transition-all rounded-xl text-info" 
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
                        className="flex flex-col items-center justify-center h-20 space-y-2 border-success/10 bg-success/5 hover:bg-success/10 hover:text-success transition-all rounded-xl text-success disabled:opacity-50 disabled:cursor-not-allowed" 
                        disabled={isDownloaded}
                        onClick={() => {
                            if (!isDownloaded) {
                                handleDownload();
                            }
                        }}
                    >
                        {isDownloaded ? <Check className="h-6 w-6" /> : <Download className="h-6 w-6" />}
                        <span className="text-xs font-medium">{isDownloaded ? 'Downloaded' : 'Download'}</span>
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
        onClick={() => setShowControls(!showControls)}
        className="min-h-[100dvh] w-full break-words overscroll-x-none touch-pan-y whitespace-pre-wrap leading-relaxed outline-none p-4 pb-32 pt-20"
        style={{ fontSize: `${fontSize}px`, overflowAnchor: 'none' }}
        tabIndex={-1}
      >
        {isLoading || isSwitching ? (
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
                    tabIndex={0}
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
                    tabIndex={0}
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
            "fixed bottom-4 left-4 right-4 min-h-16 h-auto pb-0 glass-panel rounded-2xl border border-white/10 shadow-lg ring-1 ring-black/5 flex items-center px-4 z-50 transition-transform duration-300 ease-in-out",
            showControls ? "translate-y-0" : "translate-y-[200%]"
        )}>
            <span className="text-xs text-muted-foreground w-12 text-right mr-4 font-mono select-none font-bold">
                {Math.round(scrollProgress)}%
            </span>
            <Slider
                value={[scrollProgress]}
                max={100}
                step={0.1}
                onValueChange={handleProgressChange}
                onValueCommit={() => {
                    // Keep lock active slightly longer to handle inertia
                    setTimeout(() => {
                        isUserInteractingRef.current = false;
                    }, 200);
                }}
                className="flex-1 cursor-pointer py-4"
            />
        </div>
      )}

      {/* Rename Dialog */}
      <RenameDialog 
        open={isRenameOpen}
        onOpenChange={setIsRenameOpen}
        currentName={path ? decodeURIComponent(path).split('/').pop() || '' : ''}
        onRename={handleRenameConfirm}
        description="Enter a new name for the file."
      />

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
