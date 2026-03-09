import { useNavigate } from 'react-router-dom';
import { useConfigStore } from '@/store/configStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Settings as SettingsIcon, Trash2, Sun, Moon, Eye, ChevronRight, Database, Archive, Eraser } from 'lucide-react';
import { fileCacheStore, downloadedTxtStore } from '@/utils/storage';
import { toast } from 'sonner';

const Settings = () => {
  const navigate = useNavigate();
  const { ossConfig, theme, setTheme, clearConfig } = useConfigStore();

  const handleClearCache = async () => {
    try {
      await fileCacheStore.clear();
      await downloadedTxtStore.clear();
      toast.success('Cache cleared');
    } catch (error) {
      toast.error('Failed to clear cache');
    }
  };

  const handleReset = () => {
    if (confirm('Are you sure you want to reset all configuration? This will remove your keys from this device.')) {
      clearConfig();
      toast.success('Configuration reset');
    }
  };

  const MenuItem = ({ icon: Icon, title, onClick, destructive = false }: any) => (
    <div 
        className={`group relative flex items-center px-3 py-2.5 glass-card rounded-xl cursor-pointer hover:shadow-lg transition-all duration-300 active:scale-[0.98] border border-white/5 ring-1 ring-white/5 hover:ring-primary/20 hover:border-primary/20 overflow-hidden ${destructive ? 'hover:ring-destructive/20 hover:border-destructive/20' : ''}`}
        onClick={onClick}
    >
        <div className={`p-2 rounded-lg mr-3 transition-colors duration-300 ${destructive ? 'bg-destructive/10 text-destructive group-hover:bg-destructive group-hover:text-destructive-foreground' : 'bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground'}`}>
            <Icon className="h-5 w-5" />
        </div>
        <span className={`flex-1 font-semibold text-sm transition-colors ${destructive ? 'text-destructive' : 'text-foreground group-hover:text-primary'}`}>{title}</span>
        <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary transition-colors" />
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out pointer-events-none" />
    </div>
  );

  return (
    <div className="flex flex-col min-h-full px-4 pt-4 pb-32">
      <div className="px-4 py-3 mb-6 glass-panel rounded-2xl sticky top-4 z-40 border border-white/10 shadow-lg ring-1 ring-black/5 flex items-center space-x-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="h-9 w-9 hover:bg-primary/20 hover:text-primary rounded-xl transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-bold tracking-tight text-glow">Settings</h1>
      </div>

      <div className="space-y-8">
        <div className="space-y-3">
          <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-2">General</h2>
          <MenuItem 
              icon={SettingsIcon} 
              title="OSS Configuration" 
              onClick={() => navigate('/settings/oss')} 
          />
          <MenuItem 
              icon={Archive} 
              title="Recycle Bin" 
              onClick={() => navigate('/settings/recycle')} 
          />
          <MenuItem 
              icon={Eraser} 
              title="Filename Cleaning" 
              onClick={() => navigate('/settings/filename-clean')} 
          />
        </div>

        <div className="space-y-3">
          <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-2">Appearance</h2>
          <Card className="glass-card border-white/10 shadow-sm rounded-2xl overflow-hidden">
              <CardContent className="p-0">
                  <div className="flex items-center justify-between p-4 border-b border-white/5 hover:bg-white/5 transition-colors">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-yellow-500/10 rounded-lg text-yellow-500">
                          <Sun className="h-5 w-5" />
                        </div>
                        <Label className="font-medium cursor-pointer">Light</Label>
                      </div>
                      <Switch checked={theme === 'light'} onCheckedChange={() => setTheme('light')} />
                  </div>
                  <div className="flex items-center justify-between p-4 border-b border-white/5 hover:bg-white/5 transition-colors">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-slate-500/10 rounded-lg text-slate-500">
                          <Moon className="h-5 w-5" />
                        </div>
                        <Label className="font-medium cursor-pointer">Dark</Label>
                      </div>
                      <Switch checked={theme === 'dark'} onCheckedChange={() => setTheme('dark')} />
                  </div>
                  <div className="flex items-center justify-between p-4 hover:bg-white/5 transition-colors">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-orange-500/10 rounded-lg text-orange-500">
                          <Eye className="h-5 w-5" />
                        </div>
                        <Label className="font-medium cursor-pointer">Sepia</Label>
                      </div>
                      <Switch checked={theme === 'sepia'} onCheckedChange={() => setTheme('sepia')} />
                  </div>
              </CardContent>
          </Card>
        </div>

        <div className="space-y-3">
          <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">Storage</h2>
          <MenuItem 
              icon={Database} 
              title="Clear Local Cache" 
              onClick={handleClearCache} 
          />
          {ossConfig && (
              <MenuItem 
                  icon={Trash2} 
                  title="Reset Configuration" 
                  onClick={handleReset} 
                  destructive
              />
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;
