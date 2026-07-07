import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ClientsPage from './pages/ClientsPage';
import InvoicesPage from './pages/InvoicesPage';
import PaymentsPage from './pages/PaymentsPage';
import CaissePage from './pages/CaissePage';
import UsersPage from './pages/UsersPage';
import DailyArrivals from './pages/DailyArrivals';
import StockPage from './pages/StockPage';
import AlertsPage from './pages/AlertsPage';
import WholesaleInvoiceTracker from './pages/WholesaleInvoiceTracker';
import CrateMovementTracker from './pages/CrateMovementTracker';

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
              <Route path="invoices" element={<InvoicesPage />} />
              <Route path="payments" element={<PaymentsPage />} />
              <Route path="caisse" element={<CaissePage />} />
              <Route path="alerts" element={<AlertsPage />} />
              <Route path="users" element={<ProtectedRoute roles={['boss', 'manager']}><UsersPage /></ProtectedRoute>} />
              <Route path="arrivals" element={<DailyArrivals />} />
              <Route path="stock" element={<ProtectedRoute roles={['boss', 'manager', 'warehouse']}><StockPage /></ProtectedRoute>} />
              <Route path="invoice-tracker" element={<WholesaleInvoiceTracker />} />
              <Route path="crate-tracker" element={<CrateMovementTracker />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
