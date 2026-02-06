import { BrowserRouter as Router, Routes, Route, Outlet } from 'react-router-dom';
import FileManager from '@/pages/FileManager';
import Settings from '@/pages/Settings';
import OSSConfig from '@/pages/OSSConfig';
import RecycleBin from '@/pages/RecycleBin';
import Reader from '@/pages/Reader';
import Downloads from '@/pages/Downloads';
import BottomNav from '@/components/BottomNav';
import { Toaster } from '@/components/ui/sonner';

const MainLayout = () => {
  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <main className="flex-1 overflow-hidden relative">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
};

function App() {
  return (
    <Router>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<FileManager />} />
          <Route path="/downloads" element={<Downloads />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
        <Route path="/settings/oss" element={<OSSConfig />} />
        <Route path="/settings/recycle" element={<RecycleBin />} />
        <Route path="/reader/:path" element={<Reader />} />
      </Routes>
      <Toaster />
    </Router>
  );
}

export default App;
