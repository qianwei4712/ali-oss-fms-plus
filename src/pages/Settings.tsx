import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useConfigStore } from '@/store/configStore';
import { initOSSClient } from '@/utils/oss';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { ArrowLeft, Save, Trash2, Moon, Sun, Eye } from 'lucide-react';
import { fileCacheStore, downloadedTxtStore } from '@/utils/storage';

const Settings = () => {
  const navigate = useNavigate();
  const { ossConfig, theme, setOssConfig, setTheme, clearConfig } = useConfigStore();
  
  const [formData, setFormData] = useState({
    region: '',
    bucket: '',
    accessKeyId: '',
    accessKeySecret: '',
  });
  
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (ossConfig) {
      setFormData({
        region: ossConfig.region,
        bucket: ossConfig.bucket,
        accessKeyId: ossConfig.accessKeyId,
        accessKeySecret: ossConfig.accessKeySecret,
      });
    }
  }, [ossConfig]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    if (!formData.region || !formData.bucket || !formData.accessKeyId || !formData.accessKeySecret) {
      toast.error('Please fill in all fields');
      return;
    }

    setIsLoading(true);
    try {
      const client = initOSSClient(formData);
      // Test connection by listing 1 item
      await client.list({ 'max-keys': 1 }, {});
      
      setOssConfig(formData);
      toast.success('Configuration saved successfully');
      
      // If valid, go home
      setTimeout(() => navigate('/'), 1000);
    } catch (error: any) {
      console.error(error);
      toast.error('Connection failed: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

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
      setFormData({ region: '', bucket: '', accessKeyId: '', accessKeySecret: '' });
      toast.success('Configuration reset');
    }
  };

  return (
    <div className="container max-w-md mx-auto p-4 space-y-6 pb-24">
      <div className="flex items-center space-x-2 mb-6">
        {ossConfig && (
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="h-6 w-6" />
          </Button>
        )}
        <h1 className="text-2xl font-bold">Settings</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>OSS Configuration</CardTitle>
          <CardDescription>
            Enter your Aliyun OSS credentials. stored locally.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="region">Region</Label>
            <Input 
              id="region" 
              name="region" 
              placeholder="oss-cn-hangzhou" 
              value={formData.region} 
              onChange={handleChange} 
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bucket">Bucket Name</Label>
            <Input 
              id="bucket" 
              name="bucket" 
              placeholder="my-bucket" 
              value={formData.bucket} 
              onChange={handleChange} 
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="accessKeyId">Access Key ID</Label>
            <Input 
              id="accessKeyId" 
              name="accessKeyId" 
              type="password"
              placeholder="LTAI..." 
              value={formData.accessKeyId} 
              onChange={handleChange} 
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="accessKeySecret">Access Key Secret</Label>
            <Input 
              id="accessKeySecret" 
              name="accessKeySecret" 
              type="password"
              placeholder="Secret..." 
              value={formData.accessKeySecret} 
              onChange={handleChange} 
            />
          </div>
          
          <Button className="w-full" onClick={handleSave} disabled={isLoading}>
            {isLoading ? 'Testing Connection...' : (
              <>
                <Save className="mr-2 h-4 w-4" /> Save & Connect
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
              <Label>Sepia (Eye Care)</Label>
            </div>
            <Switch checked={theme === 'sepia'} onCheckedChange={() => setTheme('sepia')} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Storage</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button variant="outline" className="w-full" onClick={handleClearCache}>
            <Trash2 className="mr-2 h-4 w-4" /> Clear Local Cache
          </Button>
          
          {ossConfig && (
            <Button variant="destructive" className="w-full" onClick={handleReset}>
              Reset Configuration
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Settings;
