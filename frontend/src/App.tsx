import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ClientsPage from './pages/ClientsPage';
import CaissePage from './pages/CaissePage';
import UsersPage from './pages/UsersPage';
import DailyArrivals from './pages/DailyArrivals';
import StockPage from './pages/StockPage';
import AlertsPage from './pages/AlertsPage';
import WholesaleInvoiceTracker from './pages/WholesaleInvoiceTracker';
import CrateMovementTracker from './pages/CrateMovementTracker';
import BossDailyArrivals from './pages/BossDailyArrivals';
import BossStock from './pages/BossStock';
import { useAuth } from './hooks/useAuth';

function ArrivalsRoute() {
  const { user } = useAuth();
  return user?.role === 'boss' ? <BossDailyArrivals /> : <DailyArrivals />;
}

function StockRoute() {
  const { user } = useAuth();
  return user?.role === 'boss' ? <BossStock /> : <StockPage />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route index element={<DashboardPage />} />
              <Route path="clients" element={<ClientsPage />} />
              <Route path="caisse" element={<CaissePage />} />
              <Route path="alerts" element={<AlertsPage />} />
              <Route path="users" element={<ProtectedRoute roles={['boss', 'manager']}><UsersPage /></ProtectedRoute>} />
              <Route path="arrivals" element={<ArrivalsRoute />} />
              <Route path="stock" element={<ProtectedRoute roles={['boss', 'manager', 'warehouse']}><StockRoute /></ProtectedRoute>} />
              <Route path="invoice-tracker" element={<WholesaleInvoiceTracker />} />
              <Route path="crate-tracker" element={<CrateMovementTracker />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
