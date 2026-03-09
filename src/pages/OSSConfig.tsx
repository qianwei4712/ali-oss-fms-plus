import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useConfigStore } from '@/store/configStore';
import { initOSSClient } from '@/utils/oss';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { ArrowLeft, Save } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

const OSSConfig = () => {
  const navigate = useNavigate();
  const { ossConfig, setOssConfig } = useConfigStore();
  
  const [formData, setFormData] = useState({
    region: '',
    bucket: '',
    accessKeyId: '',
    accessKeySecret: '',
    rootPath: '',
    recyclePath: '',
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [showCorsHelp, setShowCorsHelp] = useState(false);

  useEffect(() => {
    if (ossConfig) {
      setFormData({
        region: ossConfig.region,
        bucket: ossConfig.bucket,
        accessKeyId: ossConfig.accessKeyId,
        accessKeySecret: ossConfig.accessKeySecret,
        rootPath: ossConfig.rootPath || '',
        recyclePath: ossConfig.recyclePath || '',
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
      navigate('/settings');
    } catch (error: any) {
      console.error(error);
      if (error.name === 'RequestError' || error.status === 0 || error.status === -1 || error.message.includes('Network Error') || error.message.includes('CORS')) {
         setShowCorsHelp(true);
         toast.error('Connection failed: Potential CORS issue');
      } else {
         toast.error('Connection failed: ' + error.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-full px-4 pt-4 pb-32">
      <div className="px-4 py-3 mb-6 glass-panel rounded-2xl sticky top-4 z-40 border border-white/10 shadow-lg ring-1 ring-black/5 flex items-center space-x-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/settings')} className="h-9 w-9 hover:bg-primary/20 hover:text-primary rounded-xl transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-bold tracking-tight text-glow">OSS Configuration</h1>
      </div>

      <div className="space-y-6">
        <Card className="glass-card border-white/10 shadow-sm rounded-2xl overflow-hidden">
        <CardHeader className="border-b border-white/5 pb-4">
          <CardTitle className="text-lg">Credentials & Paths</CardTitle>
          <CardDescription>
            Enter your Aliyun OSS credentials.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 pt-6">
          <div className="space-y-2">
            <Label htmlFor="region" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Region</Label>
            <Input 
              id="region" 
              name="region" 
              placeholder="oss-cn-hangzhou" 
              value={formData.region} 
              onChange={handleChange} 
              className="bg-secondary/20 border-white/10 focus:border-primary/50 focus:ring-primary/20 transition-all rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bucket" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Bucket Name</Label>
            <Input 
              id="bucket" 
              name="bucket" 
              placeholder="my-bucket" 
              value={formData.bucket} 
              onChange={handleChange} 
              className="bg-secondary/20 border-white/10 focus:border-primary/50 focus:ring-primary/20 transition-all rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="accessKeyId" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Access Key ID</Label>
            <Input 
              id="accessKeyId" 
              name="accessKeyId" 
              type="password"
              placeholder="LTAI..." 
              value={formData.accessKeyId} 
              onChange={handleChange} 
              className="bg-secondary/20 border-white/10 focus:border-primary/50 focus:ring-primary/20 transition-all rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="accessKeySecret" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Access Key Secret</Label>
            <Input 
              id="accessKeySecret" 
              name="accessKeySecret" 
              type="password"
              placeholder="Secret..." 
              value={formData.accessKeySecret} 
              onChange={handleChange} 
              className="bg-secondary/20 border-white/10 focus:border-primary/50 focus:ring-primary/20 transition-all rounded-xl"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="rootPath" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Root Path</Label>
              <Input 
                id="rootPath" 
                name="rootPath" 
                placeholder="normal/" 
                value={formData.rootPath} 
                onChange={handleChange} 
                className="bg-secondary/20 border-white/10 focus:border-primary/50 focus:ring-primary/20 transition-all rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="recyclePath" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recycle Path</Label>
              <Input 
                id="recyclePath" 
                name="recyclePath" 
                placeholder="trash/" 
                value={formData.recyclePath} 
                onChange={handleChange} 
                className="bg-secondary/20 border-white/10 focus:border-primary/50 focus:ring-primary/20 transition-all rounded-xl"
              />
            </div>
          </div>
          
          <Button className="w-full rounded-xl h-11 font-semibold shadow-lg shadow-primary/20" onClick={handleSave} disabled={isLoading}>
            {isLoading ? 'Testing Connection...' : (
              <>
                <Save className="mr-2 h-4 w-4" /> Save & Connect
              </>
            )}
          </Button>
        </CardContent>
      </Card>
      </div>

      <Dialog open={showCorsHelp} onOpenChange={setShowCorsHelp}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>⚠️ CORS Configuration Required</DialogTitle>
            <DialogDescription>
              Aliyun OSS rejects browser requests by default. You must configure CORS rules in the OSS Console.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <ol className="list-decimal pl-4 space-y-2">
              <li>Log in to <a href="https://oss.console.aliyun.com/" target="_blank" className="text-primary underline">Aliyun OSS Console</a>.</li>
              <li>Go to your Bucket: <strong>{formData.bucket || 'your-bucket'}</strong>.</li>
              <li>Navigate to <strong>Content Security (数据安全)</strong> -&gt; <strong>Cross-Origin Resource Sharing (跨域设置)</strong>.</li>
              <li>Click <strong>Create Rule</strong> and enter:
                <ul className="list-disc pl-4 mt-1 space-y-1 bg-muted p-2 rounded">
                  <li><strong>Allowed Origins (来源):</strong> <code className="bg-background px-1 rounded">*</code></li>
                  <li><strong>Allowed Methods (允许 Methods):</strong> Select All (GET, PUT, DELETE, POST, HEAD)</li>
                  <li><strong>Allowed Headers (允许 Headers):</strong> <code className="bg-background px-1 rounded">*</code></li>
                  <li><strong>Exposed Headers (暴露 Headers):</strong> <code className="bg-background px-1 rounded">ETag</code></li>
                </ul>
              </li>
              <li>Save and try again.</li>
            </ol>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowCorsHelp(false)}>I have configured it</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OSSConfig;
