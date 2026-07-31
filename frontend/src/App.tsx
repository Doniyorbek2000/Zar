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
import { DeliveryPage } from './pages/Delivery';
import { CustomersPage } from './pages/Customers';
import { SettingsPage } from './pages/Settings';
import { QrCodesPage } from './pages/QrCodes';
import { QrMenuPage } from './pages/public/QrMenu';

function Protected({ children }: { children: React.ReactNode }) {
  const user = useAuth((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

export default function App() {
  const user = useAuth((s) => s.user);
  return (
    <Routes>
      {/* Public — QR menyu (mijoz uchun, autentifikatsiyasiz) */}
      <Route path="/m/:tableId" element={<QrMenuPage />} />

      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/" element={<Protected><PosPage /></Protected>} />
      <Route path="/kitchen" element={<Protected><KitchenPage /></Protected>} />
      <Route path="/delivery" element={<Protected><DeliveryPage /></Protected>} />
      <Route path="/dashboard" element={<Protected><DashboardPage /></Protected>} />
      <Route path="/menu" element={<Protected><MenuPage /></Protected>} />
      <Route path="/inventory" element={<Protected><InventoryPage /></Protected>} />
      <Route path="/customers" element={<Protected><CustomersPage /></Protected>} />
      <Route path="/reports" element={<Protected><ReportsPage /></Protected>} />
      <Route path="/qr-codes" element={<Protected><QrCodesPage /></Protected>} />
      <Route path="/settings" element={<Protected><SettingsPage /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
