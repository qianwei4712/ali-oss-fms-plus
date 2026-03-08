import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Eraser, Sparkles } from 'lucide-react';
import { useConfigStore } from '@/store/configStore';
import { toast } from 'sonner';

interface RenameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentName: string; // The current full filename (e.g., "example.txt")
  onRename: (newName: string) => Promise<void>;
  title?: string;
  description?: string;
}

export const RenameDialog = ({
  open,
  onOpenChange,
  currentName,
  onRename,
  title = "Rename File",
  description
}: RenameDialogProps) => {
  const { filenameCleanPatterns } = useConfigStore();
  const [value, setValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      // Remove .txt extension for editing
      setValue(currentName.replace(/\.txt$/, ''));
    }
  }, [open, currentName]);

  const handleAutoClean = () => {
    if (!filenameCleanPatterns || filenameCleanPatterns.length === 0) {
      toast.info('No cleaning patterns configured');
      return;
    }
    
    let cleanedName = value;
    const originalName = value;
    
    filenameCleanPatterns.forEach(pattern => {
      cleanedName = cleanedName.split(pattern).join('');
    });
    
    if (cleanedName !== originalName) {
      setValue(cleanedName);
      toast.success('Filename cleaned');
    } else {
      toast.info('No matching patterns found');
    }
  };

  const handleSubmit = async () => {
    if (!value.trim()) return;

    let finalName = value.trim();
    if (!finalName.endsWith('.txt')) {
      finalName += '.txt';
    }

    if (finalName === currentName) {
      onOpenChange(false);
      return;
    }

    setIsSubmitting(true);
    try {
      await onRename(finalName);
      // Only close if successful (parent handles toast/error usually, but we can assume success if no error thrown)
      onOpenChange(false);
    } catch (error) {
      // Parent should handle error toast, or we can catch it here if we want generic error
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="rename-input" className="sr-only">New Name</Label>
            <div className="flex space-x-2">
              <Input 
                id="rename-input"
                value={value} 
                onChange={(e) => setValue(e.target.value)} 
                placeholder="New filename"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSubmit();
                  }
                }}
              />
              <Button 
                variant="outline" 
                size="icon" 
                title="Auto Clean"
                onClick={handleAutoClean}
                type="button"
              >
                {/* Use Eraser or Sparkles depending on preference, Reader used Sparkles, FileManager used Eraser. Let's use Eraser as it implies 'cleaning'. */}
                <Eraser className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>Rename</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
