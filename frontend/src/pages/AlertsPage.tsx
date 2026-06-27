import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../services/api';
import { Link } from 'react-router-dom';

export default function AlertsPage() {
  const { t } = useTranslation();
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const data = await api.alerts.list();
      setAlerts(data || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const markRead = async (id: string) => {
    await api.alerts.markRead(id);
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, read_status: true } : a));
  };

  const markAllRead = async () => {
    await api.alerts.markAllRead();
    setAlerts(prev => prev.map(a => ({ ...a, read_status: true })));
  };

  const deleteAlert = async (id: string) => {
    try {
      await api.notifications.delete(id);
      setAlerts(prev => prev.filter(a => a.id !== id));
    } catch {}
  };

  const unreadCount = alerts.filter(a => !a.read_status).length;

  const typeIcon = (type: string) => {
    switch (type) {
      case 'invoice': return 'bi-receipt text-primary';
      case 'delivery': return 'bi-truck text-emerald-500';
      case 'payment': return 'bi-cash-coin text-success';
      default: return 'bi-info-circle text-slate-400';
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50/40 flex items-center justify-center">
      <div className="text-slate-400 text-sm">Loading notifications...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50/40">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="logo-gradient">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-800">{t('Notifications')}</h1>
              <p className="text-[11px] text-slate-400">{unreadCount} unread of {alerts.length} total</p>
            </div>
          </div>
          {unreadCount > 0 && (
            <button onClick={markAllRead}
              className="px-3 py-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-all">
              <i className="bi bi-check-all me-1" />Mark all read
            </button>
          )}
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            {error}
          </div>
        )}

        {alerts.length === 0 ? (
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-slate-100 rounded-full flex items-center justify-center">
              <i className="bi bi-bell-slash text-2xl text-slate-300" />
            </div>
            <h3 className="text-sm font-semibold text-slate-600 mb-1">No notifications</h3>
            <p className="text-xs text-slate-400">You're all caught up!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {alerts.map(alert => (
              <div key={alert.id}
                className={`bg-white/80 backdrop-blur-sm rounded-xl p-4 transition-all hover:shadow-sm border-l-4 ${
                  alert.read_status ? 'border-l-slate-200 opacity-70' : 'border-l-indigo-400'
                }`}>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <i className={`bi ${typeIcon(alert.type)} text-sm`} />
                  </div>
                  <div className="flex-grow min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h4 className="text-sm font-semibold text-slate-800">{alert.title}</h4>
                      {!alert.read_status && (
                        <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 text-[9px] font-bold rounded-full uppercase">New</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">{alert.message}</p>
                    <p className="text-[10px] text-slate-400 mt-1">{new Date(alert.created_at).toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {alert.reference_type === 'invoice' && (
                      <Link to="/invoices" className="px-2 py-1 text-[10px] font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all">
                        View
                      </Link>
                    )}
                    {!alert.read_status && (
                      <button onClick={() => markRead(alert.id)}
                        className="px-2 py-1 text-[10px] font-medium text-slate-500 hover:bg-slate-100 rounded-lg transition-all"
                        title="Mark as read">
                        <i className="bi bi-check-lg" />
                      </button>
                    )}
                    <button onClick={() => deleteAlert(alert.id)}
                      className="px-2 py-1 text-[10px] font-medium text-red-400 hover:bg-red-50 rounded-lg transition-all"
                      title="Delete">
                      <i className="bi bi-trash3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
