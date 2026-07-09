import { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '../services/api';

const today = () => new Date().toISOString().split('T')[0];

const fmtDate = (d: string) => {
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
};

const shiftDate = (d: string, days: number) => {
  const dt = new Date(d + 'T00:00:00');
  dt.setDate(dt.getDate() + days);
  return dt.toISOString().split('T')[0];
};

export default function BossDailyArrivals() {
  const [date, setDate] = useState(today());
  const [arrivals, setArrivals] = useState<any[]>([]);
  const [caisseTypes, setCaisseTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [a, ct] = await Promise.all([
        api.arrivals.list(date),
        api.caisse.types(),
      ]);
      setArrivals(a);
      setCaisseTypes(ct);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => { load(); }, [load]);

  const calcNetWeight = (weight: number, caisseDetails: any[]) => {
    let tare = 0;
    for (const cd of caisseDetails) {
      const ct = caisseTypes.find((c: any) => c.id === cd.caisse_type_id);
      if (ct) tare += ct.tare * cd.count;
    }
    return Math.max(0, weight - tare);
  };

  const truckMap = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const a of arrivals) {
      const tid = a.truck_id || 'none';
      if (!map.has(tid)) map.set(tid, []);
      map.get(tid)!.push(a);
    }
    return map;
  }, [arrivals]);

  const grandTotals = useMemo(() => {
    let totalNetWeight = 0;
    let totalAmount = 0;
    let totalEntries = 0;
    for (const a of arrivals) {
      const nw = calcNetWeight(a.weight || 0, Array.isArray(a.caisse_details) ? a.caisse_details : []);
      totalNetWeight += nw;
      totalAmount += nw * (a.price || 0);
      totalEntries++;
    }
    return { totalNetWeight, totalAmount, totalEntries };
  }, [arrivals, caisseTypes]);

  const isToday = date === today();

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between mb-4 flex-wrap gap-2">
        <h4 className="mb-0"><i className="bi bi-truck me-2" />Daily Arrivals</h4>
        <div className="d-flex align-items-center gap-2">
          <button className="btn btn-outline-secondary btn-sm" onClick={() => setDate(d => shiftDate(d, -1))}>
            <i className="bi bi-chevron-left" />
          </button>
          <input type="date" className="form-control form-control-sm" value={date}
            onChange={e => setDate(e.target.value)} style={{ width: 170 }} />
          <button className="btn btn-outline-secondary btn-sm" onClick={() => setDate(d => shiftDate(d, 1))}>
            <i className="bi bi-chevron-right" />
          </button>
          {!isToday && (
            <button className="btn btn-outline-primary btn-sm" onClick={() => setDate(today())}>
              <i className="bi bi-calendar-event me-1" />Today
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-5"><div className="spinner-border" /></div>
      ) : arrivals.length === 0 ? (
        <div className="text-center text-muted py-5">
          <i className="bi bi-truck fs-1 d-block mb-2" />
          <p>No arrivals for {fmtDate(date)}.</p>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="row g-3 mb-4">
            <div className="col-6 col-md-3">
              <div className="card border-0 bg-primary bg-opacity-10 h-100">
                <div className="card-body text-center">
                  <i className="bi bi-truck fs-3 text-primary d-block mb-1" />
                  <h3 className="mb-0">{truckMap.size}</h3>
                  <small className="text-muted">Trucks</small>
                </div>
              </div>
            </div>
            <div className="col-6 col-md-3">
              <div className="card border-0 bg-success bg-opacity-10 h-100">
                <div className="card-body text-center">
                  <i className="bi bi-clipboard-data fs-3 text-success d-block mb-1" />
                  <h3 className="mb-0">{grandTotals.totalEntries}</h3>
                  <small className="text-muted">Entries</small>
                </div>
              </div>
            </div>
            <div className="col-6 col-md-3">
              <div className="card border-0 bg-info bg-opacity-10 h-100">
                <div className="card-body text-center">
                  <i className="bi bi-speedometer fs-3 text-info d-block mb-1" />
                  <h3 className="mb-0">{grandTotals.totalNetWeight.toFixed(1)}</h3>
                  <small className="text-muted">Net Weight (kg)</small>
                </div>
              </div>
            </div>
            <div className="col-6 col-md-3">
              <div className="card border-0 bg-warning bg-opacity-10 h-100">
                <div className="card-body text-center">
                  <i className="bi bi-currency-dollar fs-3 text-warning d-block mb-1" />
                  <h3 className="mb-0">{grandTotals.totalAmount.toFixed(2)}</h3>
                  <small className="text-muted">Total Amount</small>
                </div>
              </div>
            </div>
          </div>

          {/* Truck Cards */}
          {Array.from(truckMap.entries()).map(([truckId, truckArrivals]) => {
            const truck = truckArrivals[0]?.trucks;
            let truckNetWeight = 0;
            let truckAmount = 0;
            truckArrivals.forEach((a: any) => {
              const nw = calcNetWeight(a.weight || 0, Array.isArray(a.caisse_details) ? a.caisse_details : []);
              truckNetWeight += nw;
              truckAmount += nw * (a.price || 0);
            });
            return (
              <div key={truckId} className="card border-0 shadow-sm mb-3">
                <div className="card-header bg-white d-flex align-items-center justify-content-between">
                  <div className="d-flex align-items-center gap-2">
                    <div className="rounded-circle bg-primary bg-opacity-10 p-2">
                      <i className="bi bi-truck text-primary" />
                    </div>
                    <div>
                      <strong>{truck?.supplier_name || 'Truck'}</strong>
                      <small className="text-muted ms-2">{truckArrivals.length} entries</small>
                    </div>
                  </div>
                  <div className="d-flex gap-3">
                    <span className="badge bg-info">{truckNetWeight.toFixed(1)} kg</span>
                    <span className="badge bg-warning">{truckAmount.toFixed(2)}</span>
                  </div>
                </div>
                <div className="card-body p-0">
                  <div className="table-responsive">
                    <table className="table table-hover mb-0 align-middle">
                      <thead className="table-light">
                        <tr>
                          <th>#</th>
                          <th>Client</th>
                          <th>Crates</th>
                          <th className="text-end">Weight</th>
                          <th className="text-end">Net Weight</th>
                          <th className="text-end">Amount</th>
                          <th className="text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {truckArrivals.map((a: any, idx: number) => {
                          const nw = calcNetWeight(a.weight || 0, Array.isArray(a.caisse_details) ? a.caisse_details : []);
                          const amt = nw * (a.price || 0);
                          const totalCrates = (Array.isArray(a.caisse_details) ? a.caisse_details : []).reduce((s: number, cd: any) => s + (cd.count || 0), 0);
                          return (
                            <tr key={a.id}>
                              <td className="text-muted">{idx + 1}</td>
                              <td className="fw-semibold">{a.clients?.name || '-'}</td>
                              <td>
                                {(Array.isArray(a.caisse_details) ? a.caisse_details : []).map((cd: any) => {
                                  const ct = caisseTypes.find((c: any) => c.id === cd.caisse_type_id);
                                  return (
                                    <span key={cd.caisse_type_id} className="badge bg-light text-dark me-1 mb-1">
                                      {ct?.name || '?'} x{cd.count}
                                    </span>
                                  );
                                })}
                              </td>
                              <td className="text-end">{Number(a.weight || 0).toFixed(1)} kg</td>
                              <td className="text-end fw-bold">{nw.toFixed(1)} kg</td>
                              <td className="text-end fw-bold">{amt.toFixed(2)}</td>
                              <td className="text-center">
                                <span className={`badge ${a.status === 'delivred' ? 'bg-success' : a.status === 'cancelled' ? 'bg-danger' : 'bg-warning text-dark'}`}>
                                  {a.status}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="table-light">
                        <tr className="fw-bold">
                          <td colSpan={4} className="text-end">Total</td>
                          <td className="text-end">{truckNetWeight.toFixed(1)} kg</td>
                          <td className="text-end">{truckAmount.toFixed(2)}</td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
