import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useRealtime } from '../hooks/useRealtime';
import { api } from '../services/api';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import DashboardCharts from '../components/DashboardCharts';

export default function DashboardPage() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [tab, setTab] = useState<'overview' | 'arrivals'>('overview');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  const [missingCaisses, setMissingCaisses] = useState<any[]>([]);

  const [arrivals, setArrivals] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [caisseTypes, setCaisseTypes] = useState<any[]>([]);
  const [arrivalDate] = useState(new Date().toISOString().split('T')[0]);
  const [showArrivalModal, setShowArrivalModal] = useState(false);
  const [editArrivalId, setEditArrivalId] = useState<string | null>(null);
  const [arrivalForm, setArrivalForm] = useState({ product_id: '', caisse_type_id: '', quantity: 1, notes: '' });

  useEffect(() => {
    if (user?.role === 'collector') { setLoading(false); return; }
    Promise.all([
      api.dashboard.summary(),
      api.caisse.missing(),
      api.products.list(),
      api.caisse.types(),
    ])
      .then(([summary, missing, prods, ctypes]) => {
        setData(summary);
        setMissingCaisses(missing);
        setProducts(prods);
        setCaisseTypes(ctypes);
        setUnreadNotifications(summary?.unread_notifications || 0);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => {
    api.alerts.unreadCount().then(res => setUnreadNotifications(res?.count || 0)).catch(() => {});
  }, [user]);

  useEffect(() => {
    if (tab === 'arrivals') {
      api.arrivals.list(arrivalDate).then(setArrivals);
    }
  }, [tab, arrivalDate]);

  const refreshDashboard = useCallback(() => {
    if (user?.role === 'collector') return;
    Promise.all([
      api.dashboard.summary(),
      api.caisse.missing(),
    ])
      .then(([summary, missing]) => {
        setData(summary);
        setMissingCaisses(missing);
        setUnreadNotifications(summary?.unread_notifications || 0);
      })
      .catch(() => {});
  }, [user]);

  useRealtime(refreshDashboard, user?.role !== 'collector');

  const openAddArrival = () => {
    setEditArrivalId(null);
    setArrivalForm({ product_id: '', caisse_type_id: '', quantity: 1, notes: '' });
    setShowArrivalModal(true);
  };

  const openEditArrival = (a: any) => {
    setEditArrivalId(a.id);
    setArrivalForm({ product_id: a.product_id, caisse_type_id: a.caisse_type_id, quantity: a.quantity, notes: a.notes || '' });
    setShowArrivalModal(true);
  };

  const saveArrival = async () => {
    const payload = { arrival_date: arrivalDate, ...arrivalForm };
    if (editArrivalId) await api.arrivals.update(editArrivalId, payload);
    else await api.arrivals.create(payload);
    setShowArrivalModal(false);
    api.arrivals.list(arrivalDate).then(setArrivals);
  };

  const removeArrival = async (id: string) => {
    if (!confirm(t('Are you sure?'))) return;
    await api.arrivals.delete(id);
    api.arrivals.list(arrivalDate).then(setArrivals);
  };

  const refreshUnreadCount = async () => {
    const res = await api.alerts.unreadCount();
    setUnreadNotifications(res?.count || 0);
  };

  if (loading) return <div className="d-flex justify-content-center mt-5"><div className="spinner-border text-primary" /></div>;

  if (user?.role === 'collector') {
    return (
      <div>
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h4 className="mb-0"><i className="bi bi-grid me-2" />{t('Quick Access')}</h4>
          <Link to="/alerts" className="btn btn-outline-primary btn-sm position-relative">
            <i className="bi bi-bell me-1" />{t('Alerts')}
            {unreadNotifications > 0 && (
              <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger">
                {unreadNotifications}
              </span>
            )}
          </Link>
        </div>

        <div className="row g-3">
          <div className="col-md-4">
            <Link to="/clients" className="card text-decoration-none text-dark h-100">
              <div className="card-body text-center py-5">
                <i className="bi bi-people display-3 text-primary" />
                <h5 className="mt-3">{t('Clients')}</h5>
                <p className="text-muted small">{t('View clients and their balances')}</p>
              </div>
            </Link>
          </div>
          <div className="col-md-4">
            <Link to="/invoices" className="card text-decoration-none text-dark h-100">
              <div className="card-body text-center py-5">
                <i className="bi bi-receipt display-3 text-info" />
                <h5 className="mt-3">{t('Invoices')}</h5>
                <p className="text-muted small">{t('View invoices and download PDFs')}</p>
              </div>
            </Link>
          </div>
          <div className="col-md-4">
            <Link to="/payments" className="card text-decoration-none text-dark h-100">
              <div className="card-body text-center py-5">
                <i className="bi bi-cash-coin display-3 text-success" />
                <h5 className="mt-3">{t('Collect Payments')}</h5>
                <p className="text-muted small">{t('Record payments from clients')}</p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (error) return (
    <div>
      <div className="alert alert-danger">
        <strong>{t('Failed to load dashboard:')}</strong> {error}<br />
        <small>{t('Make sure the backend is running on port 3001.')}</small>
      </div>
    </div>
  );

  const canManageArrivals = user?.role === 'boss' || user?.role === 'manager' || user?.role === 'warehouse';

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h4 className="mb-0"><i className="bi bi-grid me-2" />{t('Dashboard')}</h4>
        {(user?.role === 'manager' || user?.role === 'boss') && (
          <Link to="/alerts" className="btn btn-outline-primary btn-sm position-relative">
            <i className="bi bi-bell me-1" />{t('Alerts')}
            {unreadNotifications > 0 && (
              <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger">
                {unreadNotifications}
              </span>
            )}
          </Link>
        )}
      </div>

      <ul className="nav nav-tabs mb-3">
        <li className="nav-item">
          <button className={`nav-link ${tab === 'overview' ? 'active' : ''}`} onClick={() => setTab('overview')}>
            <i className="bi bi-speedometer2 me-1" />{t('Overview')}
          </button>
        </li>
        {canManageArrivals && (
          <li className="nav-item">
            <button className={`nav-link ${tab === 'arrivals' ? 'active' : ''}`} onClick={() => setTab('arrivals')}>
              <i className="bi bi-truck me-1" />{t('Daily Arrivals')}
            </button>
          </li>
        )}
      </ul>

      {tab === 'overview' && (
        <>
          {user?.role === 'manager' && (
            <div className="row g-3 mb-4">
              <div className="col-md-3">
                <Link to="/invoices" className="card text-decoration-none text-dark h-100">
                  <div className="card-body text-center py-4">
                    <i className="bi bi-receipt display-4 text-primary" />
                    <h6 className="mt-2">{t('Create Invoice')}</h6>
                  </div>
                </Link>
              </div>
              <div className="col-md-3">
                <Link to="/users" className="card text-decoration-none text-dark h-100">
                  <div className="card-body text-center py-4">
                    <i className="bi bi-person-plus display-4 text-success" />
                    <h6 className="mt-2">{t('Add Member')}</h6>
                  </div>
                </Link>
              </div>
              <div className="col-md-3">
                <Link to="/clients" className="card text-decoration-none text-dark h-100">
                  <div className="card-body text-center py-4">
                    <i className="bi bi-person-badge display-4 text-info" />
                    <h6 className="mt-2">{t('Add Client')}</h6>
                  </div>
                </Link>
              </div>
              <div className="col-md-3">
                <Link to="/caisse" className="card text-decoration-none text-dark h-100">
                  <div className="card-body text-center py-4">
                    <i className="bi bi-arrow-return-left display-4 text-warning" />
                    <h6 className="mt-2">{t('Returned Caisses')}</h6>
                  </div>
                </Link>
              </div>
            </div>
          )}

          {user?.role === 'boss' && (
            <div className="row g-3 mb-4">
              <div className="col-md-3">
                <div className="card border-primary">
                  <div className="card-body">
                    <h6 className="text-muted">{t("Today's Sales")}</h6>
                    <h3 className="text-primary mb-0">{data?.today_sales?.toFixed(2) || '0.00'}</h3>
                  </div>
                </div>
              </div>
              <div className="col-md-3">
                <div className="card border-danger">
                  <div className="card-body">
                    <h6 className="text-muted">{t('Total Unpaid')}</h6>
                    <h3 className="text-danger mb-0">{data?.total_unpaid?.toFixed(2) || '0.00'}</h3>
                  </div>
                </div>
              </div>
              <div className="col-md-3">
                <div className="card border-success">
                  <div className="card-body">
                    <h6 className="text-muted">{t('Collected Today')}</h6>
                    <h3 className="text-success mb-0">{data?.today_collected?.toFixed(2) || '0.00'}</h3>
                  </div>
                </div>
              </div>
              <div className="col-md-3">
                <div className="card border-warning">
                  <div className="card-body">
                    <h6 className="text-muted">{t('Overdue Clients')}</h6>
                    <h3 className="text-warning mb-0">{data?.overdue_count || 0}</h3>
                  </div>
                </div>
              </div>
            </div>
          )}

          {user?.role === 'boss' && data?.stock_alert && (
            <div className="alert alert-warning d-flex align-items-center mb-3" role="alert">
              <i className="bi bi-exclamation-triangle-fill me-2 fs-4" />
              <div>
                <strong>{t('Stock Alert')}:</strong> {t("Today's incoming truck weight")} ({data.stock_alert.today_weight} kg) {t('is less than')} {t("yesterday's delivered orders")} ({data.stock_alert.yesterday_weight} kg).
                <span className="ms-2 fw-bold text-danger">({t('Deficit')}: {data.stock_alert.deficit} kg)</span>
              </div>
            </div>
          )}

          <div className="row g-3">
            <div className="col-md-6">
              <div className="card">
                <div className="card-header"><strong>{t('Overdue Clients')}</strong></div>
                <div className="card-body p-0">
                  <div className="table-responsive">
                  <table className="table table-sm mb-0">
                    <thead><tr><th>{t('Client')}</th><th>{t('Total')}</th><th>{t('Remaining')}</th></tr></thead>
                    <tbody>
                      {data?.overdue_clients?.map((c: any, i: number) => (
                        <tr key={i}><td>{c.name}</td><td>{c.total.toFixed(2)}</td><td className="text-danger">{c.amount.toFixed(2)}</td></tr>
                      ))}
                      {!data?.overdue_clients?.length && <tr><td colSpan={3} className="text-muted text-center py-2">{t('No overdue clients')}</td></tr>}
                    </tbody>
                  </table>
                  </div>
                </div>
              </div>
            </div>
            <div className="col-md-6">
              <div className="card">
                <div className="card-header"><strong>{t('Missing / Returned Caisses')}</strong></div>
                <div className="card-body p-0">
                  <div className="table-responsive">
                  <table className="table table-sm mb-0">
                    <thead><tr><th>{t('Client')}</th><th>{t('Out')}</th><th>{t('Returned')}</th><th>{t('Missing')}</th></tr></thead>
                    <tbody>
                      {missingCaisses.map((c: any, i: number) => (
                        <tr key={i}>
                          <td>{c.client}</td>
                          <td>{c.total_out}</td>
                          <td>{c.total_returned}</td>
                          <td className="text-danger fw-bold">{c.balance}</td>
                        </tr>
                      ))}
                      {!missingCaisses.length && <tr><td colSpan={4} className="text-muted text-center py-2">{t('No missing caisses')}</td></tr>}
                    </tbody>
                  </table>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="row g-3 mt-2">
            <div className="col-md-6">
              <div className="card">
                <div className="card-header d-flex justify-content-between align-items-center">
                  <strong><i className="bi bi-box-seam me-1" />{t('Stock')}</strong>
                  <small className="text-muted fw-normal">{t('Carried from previous days')}</small>
                </div>
                <div className="card-body p-0">
                  <div className="table-responsive">
                  <table className="table table-sm mb-0">
                    <thead><tr><th>{t('Product')}</th><th>{t('Truck')}</th><th>{t('Caisses')}</th></tr></thead>
                    <tbody>
                      {data?.stock?.map((s: any, i: number) => (
                        <tr key={i}>
                          <td>{s.product_name}</td>
                          <td>
                            {s.truck_supplier ? (
                              <span className="badge bg-warning bg-opacity-25 text-warning-emphasis small">
                                {s.truck_supplier}
                              </span>
                            ) : (
                              <span className="text-muted small">
                                {s.product_name} ({new Date().toLocaleDateString('en-GB')})
                              </span>
                            )}
                          </td>
                          <td>{s.quantity}</td>
                        </tr>
                      ))}
                      {(!data?.stock || !data.stock.length) && <tr><td colSpan={3} className="text-muted text-center py-2">{t('No caisses in stock')}</td></tr>}
                    </tbody>
                  </table>
                  </div>
                </div>
              </div>
            </div>
            <div className="col-md-6">
              <div className="card">
                <div className="card-header"><strong>{t('Recent Activity')}</strong></div>
                <div className="card-body p-0">
                  <ul className="list-group list-group-flush">
                    {data?.recent_activities?.slice(0, 10).map((a: any, i: number) => (
                      <li key={i} className="list-group-item py-2">
                        <small className="text-muted">{new Date(a.created_at).toLocaleTimeString()}</small>
                        <div><strong>{a.user}</strong> {a.description}</div>
                      </li>
                    ))}
                    {!data?.recent_activities?.length && <li className="list-group-item text-muted text-center py-2">{t('No recent activity')}</li>}
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {user?.role === 'boss' && <DashboardCharts />}
        </>
      )}

      {tab === 'arrivals' && (
        <>
          <div className="d-flex justify-content-between align-items-center mb-3">
            <div className="text-muted small">{t('Arrivals for')}: <strong>{arrivalDate}</strong></div>
            {canManageArrivals && (
              <button className="btn btn-primary btn-sm" onClick={openAddArrival}>
                <i className="bi bi-plus-lg me-1" />{t('Add Arrival')}
              </button>
            )}
          </div>
          <div className="card">
            <div className="card-body p-0">
              <div className="table-responsive">
              <table className="table table-sm table-hover mb-0">
                <thead>
                  <tr>
                    <th>{t('Client')}</th>
                    <th>{t('Product')}</th>
                    <th>{t('Weight')}</th>
                    <th>{t('Price')}</th>
                    <th>{t('Status')}</th>
                    <th>{t('Notes')}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {arrivals.map((a) => (
                    <tr key={a.id}>
                      <td>{a.clients?.name || <span className="text-muted">-</span>}</td>
                      <td>{a.products?.name}</td>
                      <td>{a.weight ? `${a.weight} kg` : '-'}</td>
                      <td>{a.price ? Number(a.price).toFixed(2) : '-'}</td>
                      <td>
                        <span className={`badge bg-${a.status === 'delivred' ? 'success' : a.status === 'en demand' ? 'warning' : 'secondary'}`}>
                          {t(a.status)}
                        </span>
                      </td>
                      <td><small className="text-muted">{a.notes}</small></td>
                      <td>
                        <div className="btn-group btn-group-sm">
                          <button className="btn btn-outline-primary py-0" onClick={() => openEditArrival(a)} title={t('Edit')}>
                            <i className="bi bi-pencil" />
                          </button>
                          <button className="btn btn-outline-danger py-0" onClick={() => removeArrival(a.id)} title={t('Delete')}>
                            <i className="bi bi-trash" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!arrivals.length && <tr><td colSpan={7} className="text-center text-muted py-4">{t('No arrivals for this date')}</td></tr>}
                </tbody>
              </table>
              </div>
            </div>
          </div>

          {showArrivalModal && (
            <div className="modal d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
              <div className="modal-dialog">
                <div className="modal-content">
                  <div className="modal-header">
                    <h5 className="modal-title">{editArrivalId ? t('Edit Arrival') : t('Add Arrival')}</h5>
                    <button className="btn-close" onClick={() => setShowArrivalModal(false)} />
                  </div>
                  <div className="modal-body">
                    <div className="mb-3">
                      <label className="form-label">{t('Product')}</label>
                      <select className="form-select" value={arrivalForm.product_id} onChange={e => setArrivalForm({ ...arrivalForm, product_id: e.target.value })}>
                        <option value="">{t('Select')}</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                    <div className="mb-3">
                      <label className="form-label">{t('Caisse Type')}</label>
                      <select className="form-select" value={arrivalForm.caisse_type_id} onChange={e => setArrivalForm({ ...arrivalForm, caisse_type_id: e.target.value })}>
                        <option value="">{t('Select')}</option>
                        {caisseTypes.map(ct => <option key={ct.id} value={ct.id}>{ct.name}</option>)}
                      </select>
                    </div>
                    <div className="mb-3">
                      <label className="form-label">{t('Quantity')}</label>
                      <input type="number" className="form-control" value={arrivalForm.quantity || ''} onChange={e => setArrivalForm({ ...arrivalForm, quantity: e.target.value === '' ? 0 : Number(e.target.value) })} min={1} />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">{t('Notes')}</label>
                      <textarea className="form-control" rows={2} value={arrivalForm.notes} onChange={e => setArrivalForm({ ...arrivalForm, notes: e.target.value })} />
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={() => setShowArrivalModal(false)}>{t('Cancel')}</button>
                    <button className="btn btn-primary" onClick={saveArrival} disabled={!arrivalForm.product_id || !arrivalForm.caisse_type_id || !arrivalForm.quantity}>
                      {t('Save')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
