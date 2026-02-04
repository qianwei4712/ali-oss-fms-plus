import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Settings, Download } from 'lucide-react';
import { cn } from '@/lib/utils';

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="fixed bottom-0 left-0 right-0 h-16 bg-background border-t flex items-center justify-around z-50 pb-safe">
      <button
        onClick={() => navigate('/')}
        className={cn(
          "flex flex-col items-center justify-center w-full h-full space-y-1",
          isActive('/') ? "text-primary" : "text-muted-foreground"
        )}
      >
        <Home className="h-6 w-6" />
        <span className="text-xs">Files</span>
      </button>
      <button
        onClick={() => navigate('/downloads')}
        className={cn(
          "flex flex-col items-center justify-center w-full h-full space-y-1",
          isActive('/downloads') ? "text-primary" : "text-muted-foreground"
        )}
      >
        <Download className="h-6 w-6" />
        <span className="text-xs">Downloads</span>
      </button>
      <button
        onClick={() => navigate('/settings')}
        className={cn(
          "flex flex-col items-center justify-center w-full h-full space-y-1",
          isActive('/settings') ? "text-primary" : "text-muted-foreground"
        )}
      >
        <Settings className="h-6 w-6" />
        <span className="text-xs">Settings</span>
      </button>
    </div>
  );
};

export default BottomNav;
