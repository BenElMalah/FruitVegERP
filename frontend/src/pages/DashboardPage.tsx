import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { api } from '../services/api';
import { Link } from 'react-router-dom';

const today = () => new Date().toISOString().split('T')[0];

export default function DashboardPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [clientCount, setClientCount] = useState(0);
  const [memberCount, setMemberCount] = useState(0);
  const [arrivals, setArrivals] = useState<any[]>([]);
  const [caisseTypes, setCaisseTypes] = useState<any[]>([]);

  useEffect(() => {
    const date = today();
    Promise.all([
      api.clients.list(),
      api.auth.users(),
      api.arrivals.list(date),
      api.caisse.types(),
    ])
      .then(([clients, users, arr, ct]) => {
        setClientCount(clients?.length || 0);
        setMemberCount(users?.length || 0);
        setArrivals(arr || []);
        setCaisseTypes(ct || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const truckMap = new Map<string, any[]>();
  arrivals.forEach((a: any) => {
    const tid = a.truck_id || 'none';
    if (!truckMap.has(tid)) truckMap.set(tid, []);
    truckMap.get(tid)!.push(a);
  });
  const truckCount = truckMap.size;
  const entryCount = arrivals.length;

  const calcNetWeight = (weight: number, caisseDetails: any[]) => {
    let tare = 0;
    for (const cd of caisseDetails) {
      const ct = caisseTypes.find((c: any) => c.id === cd.caisse_type_id);
      if (ct) tare += ct.tare * cd.count;
    }
    return Math.max(0, weight - tare);
  };

  let totalNetWeight = 0;
  let totalAmount = 0;
  arrivals.forEach((a: any) => {
    const details = Array.isArray(a.caisse_details) ? a.caisse_details : [];
    const nw = calcNetWeight(a.weight || 0, details);
    totalNetWeight += nw;
    totalAmount += nw * (a.price || 0);
  });

  const quickLinks = [
    { to: '/arrivals', icon: 'bi-truck', label: 'Daily Arrivals', color: 'primary' },
    { to: '/clients', icon: 'bi-people', label: 'Clients', color: 'success' },
    { to: '/caisse', icon: 'bi-box-seam', label: 'Caisses', color: 'warning' },
    { to: '/users', icon: 'bi-person-badge', label: 'Members', color: 'info' },
    { to: '/stock', icon: 'bi-boxes', label: 'Stock', color: 'secondary' },
    { to: '/alerts', icon: 'bi-bell', label: 'Alerts', color: 'danger' },
  ];

  if (user?.role === 'collector') {
    return (
      <div>
        <h4 className="mb-4"><i className="bi bi-grid me-2" />Dashboard</h4>
        <div className="text-center text-muted py-5">
          <p>Welcome, {user.name}</p>
          <Link to="/caisse" className="btn btn-primary"><i className="bi bi-box-seam me-2" />Go to Caisses</Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h4 className="mb-4"><i className="bi bi-grid me-2" />Dashboard</h4>

      {loading ? (
        <div className="text-center py-5"><div className="spinner-border" /></div>
      ) : (
        <>
          <div className="row g-3 mb-4">
            <div className="col-6 col-md-3">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-body text-center">
                  <i className="bi bi-people fs-3 text-primary d-block mb-1" />
                  <h3 className="mb-0">{clientCount}</h3>
                  <small className="text-muted">Clients</small>
                </div>
              </div>
            </div>
            <div className="col-6 col-md-3">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-body text-center">
                  <i className="bi bi-person-badge fs-3 text-info d-block mb-1" />
                  <h3 className="mb-0">{memberCount}</h3>
                  <small className="text-muted">Members</small>
                </div>
              </div>
            </div>
            <div className="col-6 col-md-3">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-body text-center">
                  <i className="bi bi-truck fs-3 text-success d-block mb-1" />
                  <h3 className="mb-0">{truckCount}</h3>
                  <small className="text-muted">Today's Trucks</small>
                </div>
              </div>
            </div>
            <div className="col-6 col-md-3">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-body text-center">
                  <i className="bi bi-clipboard-data fs-3 text-warning d-block mb-1" />
                  <h3 className="mb-0">{entryCount}</h3>
                  <small className="text-muted">Today's Entries</small>
                </div>
              </div>
            </div>
          </div>

          <div className="row g-3 mb-4">
            <div className="col-md-6">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-body text-center">
                  <small className="text-muted">Today's Net Weight</small>
                  <h4 className="mb-0 mt-1">{totalNetWeight.toFixed(1)} kg</h4>
                </div>
              </div>
            </div>
            <div className="col-md-6">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-body text-center">
                  <small className="text-muted">Today's Total Amount</small>
                  <h4 className="mb-0 mt-1">{totalAmount.toFixed(2)}</h4>
                </div>
              </div>
            </div>
          </div>

          <div className="card border-0 shadow-sm mb-4">
            <div className="card-header bg-white"><strong>Quick Access</strong></div>
            <div className="card-body">
              <div className="d-flex gap-2 flex-wrap">
                {quickLinks.map(link => (
                  <Link key={link.to} to={link.to} className={`btn btn-outline-${link.color}`}>
                    <i className={`bi ${link.icon} me-1`} />{link.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {arrivals.length > 0 && (
            <div className="card border-0 shadow-sm">
              <div className="card-header bg-white"><strong>Today's Arrivals</strong></div>
              <div className="card-body p-0">
                <div className="table-responsive">
                  <table className="table table-hover mb-0 align-middle">
                    <thead className="table-light">
                      <tr>
                        <th>Truck</th>
                        <th>Client</th>
                        <th>Weight</th>
                        <th className="text-end">Net Weight</th>
                        <th className="text-end">Amount</th>
                        <th className="text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {arrivals.map((a: any) => {
                        const details = Array.isArray(a.caisse_details) ? a.caisse_details : [];
                        const nw = calcNetWeight(a.weight || 0, details);
                        return (
                          <tr key={a.id}>
                            <td>{a.trucks?.supplier_name || '-'}</td>
                            <td className="fw-semibold">{a.clients?.name || '-'}</td>
                            <td>{Number(a.weight || 0).toFixed(1)} kg</td>
                            <td className="text-end fw-bold">{nw.toFixed(1)} kg</td>
                            <td className="text-end fw-bold">{(nw * (a.price || 0)).toFixed(2)}</td>
                            <td className="text-center">
                              <span className={`badge ${a.status === 'delivred' ? 'bg-success' : a.status === 'cancelled' ? 'bg-danger' : 'bg-warning text-dark'}`}>
                                {a.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
