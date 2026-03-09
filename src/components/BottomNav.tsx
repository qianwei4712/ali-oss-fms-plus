import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Settings, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUiStore } from '@/store/uiStore';

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isNavBarVisible } = useUiStore();

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className={cn(
      "fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-md h-16 glass-panel rounded-full flex items-center justify-around z-50 shadow-2xl border border-white/10 ring-1 ring-black/5 transition-transform duration-300 ease-in-out",
      isNavBarVisible ? "translate-y-0 -translate-x-1/2" : "translate-y-[200%] -translate-x-1/2"
    )}>
      <button
        onClick={() => navigate('/')}
        className={cn(
          "flex flex-col items-center justify-center w-full h-full space-y-1 transition-all duration-300 relative group",
          isActive('/') ? "text-primary" : "text-muted-foreground hover:text-foreground"
        )}
      >
        <div className={cn("absolute -top-1 w-8 h-1 bg-primary rounded-b-full transition-all duration-300 opacity-0", isActive('/') && "opacity-100 top-0")} />
        <Home className={cn("h-5 w-5 transition-transform duration-300 group-hover:scale-110", isActive('/') && "scale-110")} />
        <span className={cn("text-[10px] font-medium transition-all duration-300", isActive('/') ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 hidden")}>Files</span>
      </button>
      <button
        onClick={() => navigate('/downloads')}
        className={cn(
          "flex flex-col items-center justify-center w-full h-full space-y-1 transition-all duration-300 relative group",
          isActive('/downloads') ? "text-primary" : "text-muted-foreground hover:text-foreground"
        )}
      >
        <div className={cn("absolute -top-1 w-8 h-1 bg-primary rounded-b-full transition-all duration-300 opacity-0", isActive('/downloads') && "opacity-100 top-0")} />
        <Download className={cn("h-5 w-5 transition-transform duration-300 group-hover:scale-110", isActive('/downloads') && "scale-110")} />
        <span className={cn("text-[10px] font-medium transition-all duration-300", isActive('/downloads') ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 hidden")}>Downloads</span>
      </button>
      <button
        onClick={() => navigate('/settings')}
        className={cn(
          "flex flex-col items-center justify-center w-full h-full space-y-1 transition-all duration-300 relative group",
          isActive('/settings') ? "text-primary" : "text-muted-foreground hover:text-foreground"
        )}
      >
        <div className={cn("absolute -top-1 w-8 h-1 bg-primary rounded-b-full transition-all duration-300 opacity-0", isActive('/settings') && "opacity-100 top-0")} />
        <Settings className={cn("h-5 w-5 transition-transform duration-300 group-hover:scale-110", isActive('/settings') && "scale-110")} />
        <span className={cn("text-[10px] font-medium transition-all duration-300", isActive('/settings') ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 hidden")}>Settings</span>
      </button>
    </div>
  );
};

export default BottomNav;
