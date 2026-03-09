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
    <div className="flex flex-col min-h-full px-4 pt-4 pb-32">
      <div className="px-4 py-3 mb-6 glass-panel rounded-2xl sticky top-4 z-40 border border-white/10 shadow-lg ring-1 ring-black/5 flex items-center space-x-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/settings')} className="h-9 w-9 hover:bg-primary/20 hover:text-primary rounded-xl transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-bold tracking-tight text-glow">Filename Cleaning</h1>
      </div>

      <div className="space-y-6">
        <Card className="glass-card border-white/10 shadow-sm rounded-2xl overflow-hidden">
          <CardHeader className="border-b border-white/5 pb-4">
            <CardTitle className="text-lg">Manage Patterns</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <div className="flex space-x-2">
              <Input
                placeholder="Enter text to remove from filenames..."
                value={newPattern}
                onChange={(e) => setNewPattern(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                className="bg-secondary/20 border-white/10 focus:border-primary/50 focus:ring-primary/20 transition-all rounded-xl"
              />
              <Button onClick={handleAdd} className="rounded-xl px-4 shadow-lg shadow-primary/20">
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
                  <div key={index} className="flex items-center justify-between px-3 py-2 bg-secondary/20 rounded-xl border border-white/5 hover:bg-secondary/30 transition-colors group">
                    <span className="font-mono text-xs px-2 py-0.5 bg-black/10 rounded">{pattern}</span>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(pattern)} className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
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
