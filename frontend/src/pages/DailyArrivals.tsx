import { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '../services/api';

type Truck = any;
type Arrival = any;
type CaisseType = any;
type Client = any;

interface ArrivalRow {
  id?: string;
  client_id: string;
  caisse_details: { caisse_type_id: string; count: number }[];
  weight: number;
  price: number;
  status: string;
}

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

export default function DailyArrivals() {
  const [date, setDate] = useState(today());
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [arrivals, setArrivals] = useState<Arrival[]>([]);
  const [caisseTypes, setCaisseTypes] = useState<CaisseType[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  const [showTruckModal, setShowTruckModal] = useState(false);
  const [truckProductName, setTruckProductName] = useState('');

  const [editingTruck, setEditingTruck] = useState<Truck | null>(null);
  const [editTruckName, setEditTruckName] = useState('');

  const [selectedTruckId, setSelectedTruckId] = useState<string | null>(null);
  const [showRowModal, setShowRowModal] = useState(false);
  const [editingRow, setEditingRow] = useState<ArrivalRow | null>(null);
  const [rowForm, setRowForm] = useState<ArrivalRow>({
    client_id: '',
    caisse_details: [],
    weight: 0,
    price: 0,
    status: 'en demand',
  });
  const [clientSearch, setClientSearch] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [t, a, ct, c] = await Promise.all([
        api.trucks.list(),
        api.arrivals.list(date),
        api.caisse.types(),
        api.clients.list(),
      ]);
      setTrucks(t);
      setArrivals(a);
      setCaisseTypes(ct);
      setClients(c);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => { load(); }, [load]);

  const filteredClients = useMemo(() => {
    if (!clientSearch) return clients;
    return clients.filter((c: any) => c.name.toLowerCase().startsWith(clientSearch.toLowerCase()));
  }, [clients, clientSearch]);

  const groupedByTruck = useMemo(() => {
    const map = new Map<string, Arrival[]>();
    for (const a of arrivals) {
      const tid = a.truck_id || 'none';
      if (!map.has(tid)) map.set(tid, []);
      map.get(tid)!.push(a);
    }
    return map;
  }, [arrivals]);

  const activeTruckIds = useMemo(() => {
    const idsFromArrivals = new Set(arrivals.map(a => a.truck_id).filter(Boolean));
    return trucks
      .filter(t => {
        if (idsFromArrivals.has(t.id)) return true;
        const created = t.created_at ? new Date(t.created_at).toISOString().split('T')[0] : '';
        return created === date;
      })
      .map(t => t.id);
  }, [trucks, arrivals, date]);

  const calcNetWeight = (weight: number, caisseDetails: { caisse_type_id: string; count: number }[]) => {
    let tare = 0;
    for (const cd of caisseDetails) {
      const ct = caisseTypes.find((c: any) => c.id === cd.caisse_type_id);
      if (ct) tare += ct.tare * cd.count;
    }
    return Math.max(0, weight - tare);
  };

  const calcAmount = (netWeight: number, price: number) => netWeight * price;

  const handleAddTruck = async () => {
    if (!truckProductName.trim()) return;
    try {
      await api.trucks.create({
        supplier_name: truckProductName.trim(),
        product_name: truckProductName.trim(),
        default_price: 0,
      });
      setShowTruckModal(false);
      setTruckProductName('');
      load();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleUpdateTruck = async () => {
    if (!editingTruck || !editTruckName.trim()) return;
    try {
      const product = await api.products.create({ name: editTruckName.trim(), unit: 'kg', price: 0 });
      await api.trucks.update(editingTruck.id, {
        supplier_name: editTruckName.trim(),
        product_id: product.id,
        default_price: 0,
      });
      setEditingTruck(null);
      setEditTruckName('');
      load();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleDeleteTruck = async (truckId: string) => {
    if (!confirm('Delete this truck and all its entries?')) return;
    try {
      const truckArrivals = groupedByTruck.get(truckId) || [];
      for (const a of truckArrivals) {
        await api.arrivals.delete(a.id);
      }
      await api.trucks.delete(truckId);
      load();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleAddRow = async () => {
    if (!selectedTruckId || !rowForm.client_id) return;
    const truck = trucks.find((t: any) => t.id === selectedTruckId);
    if (!truck) return;
    try {
      await api.arrivals.create({
        arrival_date: date,
        truck_id: selectedTruckId,
        client_id: rowForm.client_id,
        product_id: truck.product_id,
        caisse_details: rowForm.caisse_details,
        weight: rowForm.weight,
        price: rowForm.price || truck.default_price,
        status: rowForm.status,
      });
      setShowRowModal(false);
      setEditingRow(null);
      resetRowForm();
      load();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleUpdateRow = async () => {
    if (!editingRow?.id) return;
    try {
      await api.arrivals.update(editingRow.id, {
        client_id: rowForm.client_id,
        caisse_details: rowForm.caisse_details,
        weight: rowForm.weight,
        price: rowForm.price,
        status: rowForm.status,
      });
      setShowRowModal(false);
      setEditingRow(null);
      resetRowForm();
      load();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleDeleteRow = async (id: string) => {
    if (!confirm('Delete this entry?')) return;
    try {
      await api.arrivals.delete(id);
      load();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleUnknownClient = async () => {
    let unknown = clients.find((c: any) => c.name === 'Unknown');
    if (!unknown) {
      unknown = await api.clients.create({ name: 'Unknown' });
      setClients(prev => [...prev, unknown]);
    }
    setRowForm(prev => ({ ...prev, client_id: unknown.id }));
    setClientSearch('Unknown');
    setShowClientDropdown(false);
  };

  const resetRowForm = () => {
    setRowForm({ client_id: '', caisse_details: [], weight: 0, price: 0, status: 'en demand' });
    setClientSearch('');
  };

  const openAddRow = (truckId: string) => {
    setSelectedTruckId(truckId);
    setEditingRow(null);
    resetRowForm();
    setShowRowModal(true);
  };

  const openEditRow = (arrival: Arrival) => {
    setSelectedTruckId(arrival.truck_id);
    setEditingRow(arrival);
    setRowForm({
      client_id: arrival.client_id,
      caisse_details: Array.isArray(arrival.caisse_details) ? arrival.caisse_details : [],
      weight: arrival.weight || 0,
      price: arrival.price || 0,
      status: arrival.status || 'en demand',
    });
    setClientSearch(arrival.clients?.name || '');
    setShowRowModal(true);
  };

  const addCaisseDetail = () => {
    setRowForm(prev => ({
      ...prev,
      caisse_details: [...prev.caisse_details, { caisse_type_id: '', count: 0 }],
    }));
  };

  const updateCaisseDetail = (index: number, field: string, value: any) => {
    setRowForm(prev => {
      const details = [...prev.caisse_details];
      details[index] = { ...details[index], [field]: value };
      return { ...prev, caisse_details: details };
    });
  };

  const removeCaisseDetail = (index: number) => {
    setRowForm(prev => ({
      ...prev,
      caisse_details: prev.caisse_details.filter((_, i) => i !== index),
    }));
  };

  const totalsForTruck = (truckArrivals: Arrival[]) => {
    let totalNetWeight = 0;
    let totalAmount = 0;
    for (const a of truckArrivals) {
      const nw = calcNetWeight(a.weight || 0, Array.isArray(a.caisse_details) ? a.caisse_details : []);
      totalNetWeight += nw;
      totalAmount += calcAmount(nw, a.price || 0);
    }
    return { totalNetWeight, totalAmount };
  };

  const grandTotals = useMemo(() => {
    let totalNetWeight = 0;
    let totalAmount = 0;
    let totalEntries = 0;
    for (const a of arrivals) {
      const nw = calcNetWeight(a.weight || 0, Array.isArray(a.caisse_details) ? a.caisse_details : []);
      totalNetWeight += nw;
      totalAmount += calcAmount(nw, a.price || 0);
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
          <button className="btn btn-outline-secondary btn-sm" onClick={() => setDate(d => shiftDate(d, -1))} title="Previous day">
            <i className="bi bi-chevron-left" />
          </button>
          <input type="date" className="form-control form-control-sm" value={date}
            onChange={e => setDate(e.target.value)} style={{ width: 170 }} />
          <button className="btn btn-outline-secondary btn-sm" onClick={() => setDate(d => shiftDate(d, 1))} title="Next day">
            <i className="bi bi-chevron-right" />
          </button>
          {!isToday && (
            <button className="btn btn-outline-primary btn-sm" onClick={() => setDate(today())}>
              <i className="bi bi-calendar-event me-1" />Today
            </button>
          )}
          <button className="btn btn-primary btn-sm" onClick={() => { setShowTruckModal(true); setTruckProductName(''); }}>
            <i className="bi bi-plus-lg me-1" />Add Truck
          </button>
        </div>
      </div>

      {!loading && arrivals.length > 0 && (
        <div className="d-flex gap-3 mb-3 flex-wrap">
          <div className="card border-0 shadow-sm px-3 py-2">
            <small className="text-muted">Trucks</small>
            <strong>{activeTruckIds.length}</strong>
          </div>
          <div className="card border-0 shadow-sm px-3 py-2">
            <small className="text-muted">Entries</small>
            <strong>{grandTotals.totalEntries}</strong>
          </div>
          <div className="card border-0 shadow-sm px-3 py-2">
            <small className="text-muted">Total Net Weight</small>
            <strong>{grandTotals.totalNetWeight.toFixed(1)} kg</strong>
          </div>
          <div className="card border-0 shadow-sm px-3 py-2">
            <small className="text-muted">Total Amount</small>
            <strong>{grandTotals.totalAmount.toFixed(2)}</strong>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-5"><div className="spinner-border" /></div>
      ) : activeTruckIds.length === 0 ? (
        <div className="text-center text-muted py-5">
          <i className="bi bi-truck fs-1 d-block mb-2" />
          <p>No trucks for {fmtDate(date)}. Click "Add Truck" to start.</p>
        </div>
      ) : (
        activeTruckIds.map((truckId) => {
          const truckArrivals = groupedByTruck.get(truckId) || [];
          const truck = trucks.find((t: any) => t.id === truckId);
          const { totalNetWeight, totalAmount } = totalsForTruck(truckArrivals);
          return (
            <div key={truckId} className="card border-0 shadow-sm mb-4">
              <div className="card-header bg-white d-flex align-items-center justify-content-between">
                <div className="d-flex align-items-center gap-2">
                  <strong>{truck?.products?.name || truck?.supplier_name || 'Truck'}</strong>
                  <span className="badge bg-secondary">{truckArrivals.length} entries</span>
                  <button className="btn btn-sm btn-outline-secondary" title="Edit product name"
                    onClick={() => { setEditingTruck(truck); setEditTruckName(truck?.products?.name || truck?.supplier_name || ''); }}>
                    <i className="bi bi-pencil" />
                  </button>
                  <button className="btn btn-sm btn-outline-danger" title="Delete truck"
                    onClick={() => handleDeleteTruck(truckId)}>
                    <i className="bi bi-trash" />
                  </button>
                </div>
                <button className="btn btn-outline-primary btn-sm" onClick={() => openAddRow(truckId)}>
                  <i className="bi bi-plus-lg me-1" />Add Entry
                </button>
              </div>
              <div className="card-body p-0">
                {truckArrivals.length === 0 ? (
                  <div className="text-center text-muted py-3">No entries yet. Click "Add Entry".</div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-hover mb-0 align-middle">
                      <thead className="table-light">
                        <tr>
                          <th>#</th>
                          <th>Client</th>
                          <th>Crate Types</th>
                          <th className="text-end">Crates</th>
                          <th className="text-end">Weight</th>
                          <th className="text-end">Net Weight</th>
                          <th className="text-end">Price</th>
                          <th className="text-end">Amount</th>
                          <th className="text-center">Status</th>
                          <th className="text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {truckArrivals.map((a: any, idx: number) => {
                          const nw = calcNetWeight(a.weight || 0, Array.isArray(a.caisse_details) ? a.caisse_details : []);
                          const amt = calcAmount(nw, a.price || 0);
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
                              <td className="text-end">{totalCrates}</td>
                              <td className="text-end">{Number(a.weight || 0).toFixed(1)} kg</td>
                              <td className="text-end fw-bold">{nw.toFixed(1)} kg</td>
                              <td className="text-end">{Number(a.price || 0).toFixed(2)}</td>
                              <td className="text-end fw-bold">{amt.toFixed(2)}</td>
                              <td className="text-center">
                                <span className={`badge ${a.status === 'delivred' ? 'bg-success' : a.status === 'cancelled' ? 'bg-danger' : 'bg-warning text-dark'}`}>
                                  {a.status}
                                </span>
                              </td>
                              <td className="text-center">
                                <button className="btn btn-sm btn-outline-primary me-1" onClick={() => openEditRow(a)} title="Edit">
                                  <i className="bi bi-pencil" />
                                </button>
                                <button className="btn btn-sm btn-outline-danger" onClick={() => handleDeleteRow(a.id)} title="Delete">
                                  <i className="bi bi-trash" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="table-light">
                        <tr className="fw-bold">
                          <td colSpan={5} className="text-end">Total</td>
                          <td className="text-end">{totalNetWeight.toFixed(1)} kg</td>
                          <td></td>
                          <td className="text-end">{totalAmount.toFixed(2)}</td>
                          <td colSpan={2}></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            </div>
          );
        })
      )}

      {showTruckModal && (
        <div className="modal d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Add Truck — {fmtDate(date)}</h5>
                <button className="btn-close" onClick={() => setShowTruckModal(false)} />
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label">Product Name</label>
                  <input type="text" className="form-control" value={truckProductName}
                    onChange={e => setTruckProductName(e.target.value)}
                    placeholder="e.g. Tomatoes" autoFocus
                    onKeyDown={e => e.key === 'Enter' && handleAddTruck()} />
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowTruckModal(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={handleAddTruck}
                  disabled={!truckProductName.trim()}>Add Truck</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editingTruck && (
        <div className="modal d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Edit Product Name</h5>
                <button className="btn-close" onClick={() => setEditingTruck(null)} />
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label">Product Name</label>
                  <input type="text" className="form-control" value={editTruckName}
                    onChange={e => setEditTruckName(e.target.value)} autoFocus
                    onKeyDown={e => e.key === 'Enter' && handleUpdateTruck()} />
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setEditingTruck(null)}>Cancel</button>
                <button className="btn btn-primary" onClick={handleUpdateTruck}
                  disabled={!editTruckName.trim()}>Save</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showRowModal && (
        <div className="modal d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{editingRow ? 'Edit Entry' : 'Add Entry'}</h5>
                <button className="btn-close" onClick={() => { setShowRowModal(false); setEditingRow(null); }} />
              </div>
              <div className="modal-body">
                <div className="mb-3 position-relative">
                  <label className="form-label">Client</label>
                  <input type="text" className="form-control" value={clientSearch}
                    placeholder="Search client..."
                    onChange={e => { setClientSearch(e.target.value); setRowForm({ ...rowForm, client_id: '' }); setShowClientDropdown(true); }}
                    onFocus={() => setShowClientDropdown(true)} />
                  {showClientDropdown && clientSearch && !rowForm.client_id && (
                    <div className="list-group position-absolute w-100" style={{ zIndex: 1050, maxHeight: 180, overflow: 'auto' }}>
                      {filteredClients.map((c: any) => (
                        <button key={c.id} type="button" className="list-group-item list-group-item-action py-1"
                          onMouseDown={() => {
                            setRowForm({ ...rowForm, client_id: c.id });
                            setClientSearch(c.name);
                            setShowClientDropdown(false);
                          }}>
                          <div className="fw-medium">{c.name}</div>
                          <small className="text-muted">{c.phone || ''}</small>
                        </button>
                      ))}
                      {filteredClients.length === 0 && <div className="list-group-item text-muted small">No clients found</div>}
                    </div>
                  )}
                  <button type="button" className="btn btn-sm btn-outline-warning mt-1" onClick={handleUnknownClient}>
                    <i className="bi bi-person-dash me-1" />Unknown Client
                  </button>
                </div>

                <div className="mb-3">
                  <label className="form-label">Crate Types</label>
                  {rowForm.caisse_details.map((cd, idx) => (
                    <div key={idx} className="d-flex gap-2 mb-2 align-items-center">
                      <select className="form-select form-select-sm" style={{ flex: 2 }} value={cd.caisse_type_id}
                        onChange={e => updateCaisseDetail(idx, 'caisse_type_id', e.target.value)}>
                        <option value="">Select type...</option>
                        {caisseTypes.filter((ct: any) => ct.category !== 'client').map((ct: any) => (
                          <option key={ct.id} value={ct.id}>{ct.name} ({ct.tare}kg tare)</option>
                        ))}
                      </select>
                      <input type="number" className="form-control form-control-sm" style={{ width: 80 }} min={0}
                        placeholder="Qty" value={cd.count}
                        onChange={e => updateCaisseDetail(idx, 'count', Number(e.target.value))} />
                      <button className="btn btn-sm btn-outline-danger" onClick={() => removeCaisseDetail(idx)}>
                        <i className="bi bi-x" />
                      </button>
                    </div>
                  ))}
                  <button className="btn btn-sm btn-outline-secondary" onClick={addCaisseDetail}>
                    <i className="bi bi-plus me-1" />Add Crate Type
                  </button>
                </div>

                <div className="row">
                  <div className="col-6 mb-3">
                    <label className="form-label">Weight (kg)</label>
                    <input type="number" className="form-control" step="0.1" min={0} value={rowForm.weight}
                      onChange={e => setRowForm({ ...rowForm, weight: Number(e.target.value) })} />
                  </div>
                  <div className="col-6 mb-3">
                    <label className="form-label">Price (/kg)</label>
                    <input type="number" className="form-control" step="0.01" min={0} value={rowForm.price}
                      onChange={e => setRowForm({ ...rowForm, price: Number(e.target.value) })} />
                  </div>
                </div>

                <div className="row">
                  <div className="col-6 mb-3">
                    <label className="form-label">Net Weight</label>
                    <input type="text" className="form-control fw-bold" readOnly
                      value={`${calcNetWeight(rowForm.weight, rowForm.caisse_details).toFixed(1)} kg`} />
                  </div>
                  <div className="col-6 mb-3">
                    <label className="form-label">Amount</label>
                    <input type="text" className="form-control fw-bold" readOnly
                      value={calcAmount(calcNetWeight(rowForm.weight, rowForm.caisse_details), rowForm.price).toFixed(2)} />
                  </div>
                </div>

                <div className="mb-3">
                  <label className="form-label">Status</label>
                  <select className="form-select" value={rowForm.status}
                    onChange={e => setRowForm({ ...rowForm, status: e.target.value })}>
                    <option value="en demand">En Demand</option>
                    <option value="delivred">Delivered</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => { setShowRowModal(false); setEditingRow(null); }}>Cancel</button>
                <button className="btn btn-primary" onClick={editingRow ? handleUpdateRow : handleAddRow}
                  disabled={!rowForm.client_id}>
                  {editingRow ? 'Save Changes' : 'Add Entry'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
