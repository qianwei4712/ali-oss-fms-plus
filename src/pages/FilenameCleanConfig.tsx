import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useConfigStore } from '@/store/configStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Trash2, Plus } from 'lucide-react';
import { toast } from 'sonner';

const FilenameCleanConfig = () => {
  const navigate = useNavigate();
  const { filenameCleanPatterns, addFilenameCleanPattern, removeFilenameCleanPattern } = useConfigStore();
  const [newPattern, setNewPattern] = useState('');

  const handleAdd = () => {
    if (!newPattern.trim()) return;
    if (filenameCleanPatterns.includes(newPattern)) {
      toast.error('Pattern already exists');
      return;
    }
    addFilenameCleanPattern(newPattern);
    setNewPattern('');
    toast.success('Pattern added');
  };

  const handleDelete = (pattern: string) => {
    removeFilenameCleanPattern(pattern);
    toast.success('Pattern removed');
  };

  return (
    <div className="flex flex-col min-h-screen bg-muted/30 pb-24">
      <div className="p-4 glass sticky top-0 z-10 flex items-center space-x-2">
        <Button variant="ghost" size="icon" onClick={() => navigate('/settings')} className="hover:bg-primary/10 hover:text-primary">
          <ArrowLeft className="h-6 w-6" />
        </Button>
        <h1 className="text-xl font-bold tracking-tight">Filename Cleaning</h1>
      </div>

      <div className="p-4 space-y-6">
        <Card className="border-border/50 shadow-sm rounded-xl">
          <CardHeader>
            <CardTitle className="text-lg">Manage Patterns</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex space-x-2">
              <Input
                placeholder="Enter text to remove from filenames..."
                value={newPattern}
                onChange={(e) => setNewPattern(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              />
              <Button onClick={handleAdd}>
                <Plus className="h-4 w-4 mr-2" />
                Add
              </Button>
            </div>

            <div className="space-y-2">
              {filenameCleanPatterns?.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  No patterns configured yet.
                </div>
              ) : (
                filenameCleanPatterns?.map((pattern, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg border border-border/50">
                    <span className="font-mono text-sm">{pattern}</span>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(pattern)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default FilenameCleanConfig;
