import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Settings, Download } from 'lucide-react';
import { cn } from '@/lib/utils';

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="fixed bottom-0 left-0 right-0 h-16 glass flex items-center justify-around z-50 pb-safe shadow-[0_-1px_10px_rgba(0,0,0,0.05)]">
      <button
        onClick={() => navigate('/')}
        className={cn(
          "flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors duration-200",
          isActive('/') ? "text-primary" : "text-muted-foreground hover:text-foreground"
        )}
      >
        <Home className={cn("h-6 w-6 transition-transform duration-200", isActive('/') && "scale-110")} />
        <span className="text-[10px] font-medium">Files</span>
      </button>
      <button
        onClick={() => navigate('/downloads')}
        className={cn(
          "flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors duration-200",
          isActive('/downloads') ? "text-primary" : "text-muted-foreground hover:text-foreground"
        )}
      >
        <Download className={cn("h-6 w-6 transition-transform duration-200", isActive('/downloads') && "scale-110")} />
        <span className="text-[10px] font-medium">Downloads</span>
      </button>
      <button
        onClick={() => navigate('/settings')}
        className={cn(
          "flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors duration-200",
          isActive('/settings') ? "text-primary" : "text-muted-foreground hover:text-foreground"
        )}
      >
        <Settings className={cn("h-6 w-6 transition-transform duration-200", isActive('/settings') && "scale-110")} />
        <span className="text-[10px] font-medium">Settings</span>
      </button>
    </div>
  );
};

export default BottomNav;
