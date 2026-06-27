import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import LanguageSwitcher from './LanguageSwitcher';
import { api } from '../services/api';

type NavItem = { path: string; labelKey: string; icon: string };

const navByRole: Record<string, NavItem[]> = {
  collector: [
    { path: '/clients', labelKey: 'Clients', icon: 'bi-people' },
    { path: '/invoices', labelKey: 'Invoices', icon: 'bi-receipt' },
    { path: '/payments', labelKey: 'Collect Payments', icon: 'bi-cash-coin' },
    { path: '/caisse', labelKey: 'Caisses', icon: 'bi-box-seam' },
    { path: '/alerts', labelKey: 'Alerts', icon: 'bi-bell' },
  ],
  manager: [
    { path: '/', labelKey: 'Dashboard', icon: 'bi-grid' },
    { path: '/clients', labelKey: 'Clients', icon: 'bi-people' },
    { path: '/users', labelKey: 'Members', icon: 'bi-person-badge' },
    { path: '/invoices', labelKey: 'Invoices', icon: 'bi-receipt' },
    { path: '/payments', labelKey: 'Payments', icon: 'bi-cash-coin' },
    { path: '/caisse', labelKey: 'Caisses', icon: 'bi-box-seam' },
    { path: '/products', labelKey: 'Products', icon: 'bi-basket' },
    { path: '/arrivals', labelKey: 'Daily Arrivals', icon: 'bi-truck' },
    { path: '/trucks', labelKey: 'Trucks', icon: 'bi-truck-flatbed' },
    { path: '/stock', labelKey: 'Stock', icon: 'bi-boxes' },
    { path: '/alerts', labelKey: 'Alerts', icon: 'bi-bell' },
  ],
  boss: [
    { path: '/', labelKey: 'Dashboard', icon: 'bi-grid' },
    { path: '/users', labelKey: 'Members', icon: 'bi-person-badge' },
    { path: '/clients', labelKey: 'Clients', icon: 'bi-people' },
    { path: '/invoices', labelKey: 'Invoices', icon: 'bi-receipt' },
    { path: '/payments', labelKey: 'Payments', icon: 'bi-cash-coin' },
    { path: '/caisse', labelKey: 'Caisses', icon: 'bi-box-seam' },
    { path: '/products', labelKey: 'Products', icon: 'bi-basket' },
    { path: '/arrivals', labelKey: 'Daily Arrivals', icon: 'bi-truck' },
    { path: '/trucks', labelKey: 'Trucks', icon: 'bi-truck-flatbed' },
    { path: '/stock', labelKey: 'Stock', icon: 'bi-boxes' },
    { path: '/alerts', labelKey: 'Alerts', icon: 'bi-bell' },
  ],
};

export function Layout() {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navItems = navByRole[user?.role as string] || [];

  useEffect(() => {
    api.alerts.unreadCount().then(res => setUnreadCount(res?.count || 0)).catch(() => {});
    const interval = setInterval(() => {
      api.alerts.unreadCount().then(res => setUnreadCount(res?.count || 0)).catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  const sidebarContent = (
    <nav className="d-flex flex-column bg-dark text-white h-100" style={{ width: 240 }}>
      <div className="p-3 border-bottom border-secondary d-flex justify-content-between align-items-center">
          <div className="d-flex align-items-center gap-2">
            <div className="logo-gradient"><i className="bi bi-shop" /></div>
            <div>
              <h5 className="mb-0" style={{ lineHeight: 1.2 }}>{t('Fruit&Veg ERP')}</h5>
              <small className="text-secondary" style={{ fontSize: 11 }}>{user?.name} ({user?.role})</small>
            </div>
          </div>
          <div className="d-flex align-items-center gap-2">
            <Link to="/alerts" className="btn btn-sm btn-outline-light position-relative" title="Notifications">
              <i className="bi bi-bell" />
              {unreadCount > 0 && (
                <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger" style={{ fontSize: 9 }}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </Link>
            <LanguageSwitcher />
          </div>
      </div>
      <div className="flex-grow-1 p-2 overflow-auto">
        {navItems.map(item => (
          <Link
            key={item.path}
            to={item.path}
            className={`d-flex align-items-center gap-2 px-3 py-2 text-decoration-none rounded mb-1 nav-link-mobile ${
              location.pathname === item.path ? 'bg-primary text-white' : 'text-white-50 hover-bg'
            }`}
          >
            <i className={`bi ${item.icon}`} />
            {t(item.labelKey)}
          </Link>
        ))}
      </div>
      <div className="p-3 border-top border-secondary">
        <button className="btn btn-outline-light btn-sm w-100" onClick={() => { logout(); navigate('/login'); }}>
          <i className="bi bi-box-arrow-left me-2" />{t('Logout')}
        </button>
      </div>
    </nav>
  );

  return (
    <div className="d-flex layout-root" style={{ minHeight: '100vh' }}>
      <div className="d-none d-md-flex flex-column" style={{ width: 240, flexShrink: 0 }}>
        {sidebarContent}
      </div>

      {sidebarOpen && <div className="sidebar-backdrop d-md-none" onClick={() => setSidebarOpen(false)} />}

      <div className={`sidebar-mobile d-md-none ${sidebarOpen ? 'open' : ''}`}>
        <button className="btn btn-sm btn-light position-absolute" style={{ top: 8, right: 8, zIndex: 1060 }} onClick={() => setSidebarOpen(false)}>
          <i className="bi bi-x-lg" />
        </button>
        {sidebarContent}
      </div>

      <main className="flex-grow-1 p-3 p-md-4 bg-light" style={{ overflow: 'auto', minWidth: 0 }}>
        <button className="btn btn-outline-secondary d-md-none mb-3" onClick={() => setSidebarOpen(true)}>
          <i className="bi bi-list fs-5" />
        </button>
        <Outlet />
      </main>
    </div>
  );
}
