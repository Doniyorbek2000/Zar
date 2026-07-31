import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './store/auth';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/Login';
import { PosPage } from './pages/Pos';
import { DashboardPage } from './pages/Dashboard';
import { MenuPage } from './pages/Menu';
import { InventoryPage } from './pages/Inventory';
import { KitchenPage } from './pages/Kitchen';
import { ReportsPage } from './pages/Reports';

function Protected({ children }: { children: React.ReactNode }) {
  const user = useAuth((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

export default function App() {
  const user = useAuth((s) => s.user);
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/" element={<Protected><PosPage /></Protected>} />
      <Route path="/kitchen" element={<Protected><KitchenPage /></Protected>} />
      <Route path="/dashboard" element={<Protected><DashboardPage /></Protected>} />
      <Route path="/menu" element={<Protected><MenuPage /></Protected>} />
      <Route path="/inventory" element={<Protected><InventoryPage /></Protected>} />
      <Route path="/reports" element={<Protected><ReportsPage /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
