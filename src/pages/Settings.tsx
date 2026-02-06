import { useNavigate } from 'react-router-dom';
import { useConfigStore } from '@/store/configStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Settings as SettingsIcon, Trash2, Sun, Moon, Eye, ChevronRight, Database, Archive } from 'lucide-react';
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
        className={`flex items-center p-4 bg-card rounded-lg border cursor-pointer hover:bg-accent ${destructive ? 'text-red-500' : ''}`}
        onClick={onClick}
    >
        <div className="p-2 bg-muted rounded-full mr-4">
            <Icon className="h-5 w-5" />
        </div>
        <span className="flex-1 font-medium">{title}</span>
        <ChevronRight className="h-5 w-5 text-muted-foreground" />
    </div>
  );

  return (
    <div className="container max-w-md mx-auto p-4 space-y-6 pb-24">
      <div className="flex items-center space-x-2 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
          <ArrowLeft className="h-6 w-6" />
        </Button>
        <h1 className="text-2xl font-bold">Settings</h1>
      </div>

      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">General</h2>
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
      </div>

      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Appearance</h2>
        <Card>
            <CardContent className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                    <Sun className="h-4 w-4" />
                    <Label>Light</Label>
                    </div>
                    <Switch checked={theme === 'light'} onCheckedChange={() => setTheme('light')} />
                </div>
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                    <Moon className="h-4 w-4" />
                    <Label>Dark</Label>
                    </div>
                    <Switch checked={theme === 'dark'} onCheckedChange={() => setTheme('dark')} />
                </div>
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                    <Eye className="h-4 w-4" />
                    <Label>Sepia</Label>
                    </div>
                    <Switch checked={theme === 'sepia'} onCheckedChange={() => setTheme('sepia')} />
                </div>
            </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Storage</h2>
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
  );
};

export default Settings;
