import { useEffect, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Outlet } from 'react-router-dom';
import { useConfigStore } from '@/store/configStore';
import BottomNav from '@/components/BottomNav';
import { Toaster } from '@/components/ui/sonner';
import { Skeleton } from '@/components/ui/skeleton';

// Lazy load pages
const FileManager = lazy(() => import('@/pages/FileManager'));
const Settings = lazy(() => import('@/pages/Settings'));
const OSSConfig = lazy(() => import('@/pages/OSSConfig'));
const FilenameCleanConfig = lazy(() => import('@/pages/FilenameCleanConfig'));
const RecycleBin = lazy(() => import('@/pages/RecycleBin'));
const Reader = lazy(() => import('@/pages/Reader'));
const Downloads = lazy(() => import('@/pages/Downloads'));

const MainLayout = () => {
  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden">
      <main id="main-content" className="flex-1 overflow-y-auto relative no-scrollbar pb-24">
        <Suspense fallback={<div className="p-4 space-y-4"><Skeleton className="h-12 w-full glass-card" /><Skeleton className="h-64 w-full glass-card" /></div>}>
          <Outlet />
        </Suspense>
      </main>
      <BottomNav />
    </div>
  );
};

function App() {
  const { theme } = useConfigStore();

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark', 'sepia');
    root.classList.add(theme);
  }, [theme]);

  return (
    <Router>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<FileManager />} />
          <Route path="/downloads" element={<Downloads />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
        <Route path="/settings/oss" element={
          <Suspense fallback={<div className="p-4"><Skeleton className="h-12 w-full" /></div>}>
            <OSSConfig />
          </Suspense>
        } />
        <Route path="/settings/filename-clean" element={
          <Suspense fallback={<div className="p-4"><Skeleton className="h-12 w-full" /></div>}>
            <FilenameCleanConfig />
          </Suspense>
        } />
        <Route path="/settings/recycle" element={
          <Suspense fallback={<div className="p-4"><Skeleton className="h-12 w-full" /></div>}>
            <RecycleBin />
          </Suspense>
        } />
        <Route path="/reader/:path" element={
          <Suspense fallback={<div className="p-4"><Skeleton className="h-full w-full" /></div>}>
            <Reader />
          </Suspense>
        } />
      </Routes>
      <Toaster />
    </Router>
  );
}

export default App;
