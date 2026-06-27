import { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import Pagination from '../components/Pagination';
import type { StockItem, Warehouse } from '../types';

const PAGE_SIZE = 100;

export default function StockPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<StockItem[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [trucks, setTrucks] = useState<any[]>([]);
  const [selectedWh, setSelectedWh] = useState<string>('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAdjModal, setShowAdjModal] = useState(false);
  const [adjItem, setAdjItem] = useState<StockItem | null>(null);
  const [formProduct, setFormProduct] = useState('');
  const [formQty, setFormQty] = useState('');
  const [formWh, setFormWh] = useState('');
  const [formTruck, setFormTruck] = useState('');
  const [products, setProducts] = useState<any[]>([]);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [qtyInputs, setQtyInputs] = useState<Record<string, string>>({});
  const [showWhModal, setShowWhModal] = useState(false);
  const [whName, setWhName] = useState('');
  const [whLocation, setWhLocation] = useState('');
  const [page, setPage] = useState(1);

  const canEdit = user?.role === 'boss' || user?.role === 'manager';

  const pagedItems = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return items.slice(start, start + PAGE_SIZE);
  }, [items, page]);

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const load = () => {
    api.stock.list(selectedWh || undefined).then(setItems).catch(() => {});
    api.products.list().then(setProducts).catch(() => {});
    api.warehouses.list().then(setWarehouses).catch(() => {});
    api.trucks.list().then(setTrucks).catch(() => {});
  };
  useEffect(() => { load(); }, [selectedWh]);

  const openAdd = () => {
    setFormProduct('');
    setFormQty('');
    setFormWh(selectedWh);
    setFormTruck('');
    setShowAddModal(true);
  };

  const openAdj = (item: StockItem) => {
    setAdjItem(item);
    setFormProduct(item.product_id);
    setFormQty('');
    setFormWh(item.warehouse_id || '');
    setFormTruck(item.truck_id || '');
    setShowAdjModal(true);
  };

  const saveAdd = async () => {
    if (!formProduct || !formQty || Number(formQty) <= 0) return;
    try {
      await api.stock.adjust({ product_id: formProduct, quantity: Number(formQty), warehouse_id: formWh || undefined, truck_id: formTruck || undefined });
      showToast('Stock added', 'success');
      setShowAddModal(false);
      load();
    } catch (err: any) {
      showToast(err.message || 'Failed', 'error');
    }
  };

  const saveAdj = async () => {
    if (!adjItem || !formQty) return;
    try {
      await api.stock.adjust({ product_id: adjItem.product_id, quantity: Number(formQty), warehouse_id: formWh || undefined, truck_id: formTruck || undefined });
      showToast('Stock adjusted', 'success');
      setShowAdjModal(false);
      setAdjItem(null);
      load();
    } catch (err: any) {
      showToast(err.message || 'Failed', 'error');
    }
  };

  const setExactQty = async (item: StockItem) => {
    const qty = Number(qtyInputs[item.id]);
    if (isNaN(qty) || qty < 0) return;
    try {
      await api.stock.update(item.id, qty, item.truck_id);
      showToast('Quantity set', 'success');
      load();
    } catch (err: any) {
      showToast(err.message || 'Failed', 'error');
    }
  };

  const adjustQty = async (item: StockItem, delta: number) => {
    try {
      await api.stock.adjust({ product_id: item.product_id, quantity: delta, warehouse_id: item.warehouse_id || undefined, truck_id: item.truck_id || undefined });
      showToast(`${delta > 0 ? '+' : ''}${delta}`, 'success');
      load();
    } catch (err: any) {
      showToast(err.message || 'Failed', 'error');
    }
  };

  const createWarehouse = async () => {
    if (!whName) return;
    try {
      await api.warehouses.create({ name: whName, location: whLocation || undefined });
      setShowWhModal(false);
      setWhName('');
      setWhLocation('');
      load();
      showToast('Warehouse created', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed', 'error');
    }
  };

  return (
    <div>
      {toast && (
        <div className="fixed-top d-flex justify-content-center pt-3" style={{ zIndex: 9999 }}>
          <div className={`px-4 py-2 rounded-pill text-white fw-semibold shadow-lg ${toast.type === 'success' ? 'bg-success' : 'bg-danger'}`}>
            {toast.msg}
          </div>
        </div>
      )}

      <div className="d-flex justify-content-between align-items-center mb-4">
        <h4 className="mb-0"><i className="bi bi-boxes me-2" />Stock Management</h4>
        <div className="d-flex gap-2">
          <div className="d-flex align-items-center gap-1">
            <select className="form-select form-select-sm" style={{ width: 180 }} value={selectedWh}
              onChange={e => setSelectedWh(e.target.value)}>
              <option value="">All Warehouses</option>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            <button className="btn btn-sm btn-outline-primary" onClick={() => setShowWhModal(true)} title="Manage Warehouses">
              <i className="bi bi-gear" />
            </button>
          </div>
          {canEdit && (
            <button className="btn btn-primary btn-sm" onClick={openAdd}>
              <i className="bi bi-plus-lg me-1" />Add Stock
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-body p-0">
          <div className="table-responsive">
          <table className="table table-hover mb-0">
            <thead>
              <tr>
                <th>Product</th>
                <th>Warehouse</th>
                <th>Truck</th>
                <th className="text-end" style={{ width: 120 }}>Caisses</th>
                <th className="text-center" style={{ width: 260 }}>Quick Adjust</th>
                <th className="text-end" style={{ width: 60 }} />
              </tr>
            </thead>
            <tbody>
              {pagedItems.map(item => (
                <tr key={item.id}>
                  <td className="fw-semibold">{item.products?.name || item.product_name || item.product_id}</td>
                  <td><span className="badge bg-info bg-opacity-25 text-info-emphasis">{item.warehouses?.name || 'Main'}</span></td>
                  <td>
                    {item.trucks?.supplier_name ? (
                      <span className="badge bg-warning bg-opacity-25 text-warning-emphasis">
                        {item.trucks.supplier_name} ({item.products?.name || item.product_name}
                        {item.trucks.created_at ? ' ' + new Date(item.trucks.created_at).toLocaleDateString('en-GB') : ''})
                      </span>
                    ) : (
                      <span className="text-muted small">
                        {item.products?.name || item.product_name}
                        {item.updated_at ? ' (' + new Date(item.updated_at).toLocaleDateString('en-GB') + ')' : ''}
                      </span>
                    )}
                  </td>
                  <td className="text-end">
                    <span className={`fw-bold fs-5 ${Number(item.quantity) <= 0 ? 'text-danger' : 'text-success'}`}>
                      {Number(item.quantity)}
                    </span>
                  </td>
                  <td>
                    <div className="d-flex align-items-center justify-content-center gap-1">
                      <button className="btn btn-sm btn-outline-danger" onClick={() => adjustQty(item, -10)} disabled={!canEdit}>-10</button>
                      <button className="btn btn-sm btn-outline-danger" onClick={() => adjustQty(item, -1)} disabled={!canEdit}>-1</button>
                      <input type="number" step="1" className="form-control form-control-sm text-center mx-1"
                        style={{ width: 65 }} placeholder="Set"
                        value={qtyInputs[item.id] ?? ''}
                        onChange={e => setQtyInputs(prev => ({ ...prev, [item.id]: e.target.value }))} />
                      <button className="btn btn-sm btn-outline-primary" onClick={() => setExactQty(item)} disabled={!canEdit}>Set</button>
                      <button className="btn btn-sm btn-outline-success" onClick={() => adjustQty(item, 1)} disabled={!canEdit}>+1</button>
                      <button className="btn btn-sm btn-outline-success" onClick={() => adjustQty(item, 10)} disabled={!canEdit}>+10</button>
                    </div>
                  </td>
                  <td className="text-end">
                    <button className="btn btn-sm btn-outline-primary" onClick={() => openAdj(item)} disabled={!canEdit} title="Adjust">
                      <i className="bi bi-sliders" />
                    </button>
                  </td>
                </tr>
              ))}
              {!items.length && (
                <tr><td colSpan={6} className="text-center text-muted py-4">No stock items found</td></tr>
              )}
            </tbody>
          </table>
          </div>
          <Pagination total={items.length} page={page} pageSize={PAGE_SIZE} onPageChange={setPage} />
        </div>
      </div>

      {/* Add Stock Modal - positive only */}
      {showAddModal && (
        <div className="modal d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Add Stock</h5>
                <button type="button" className="btn-close" onClick={() => setShowAddModal(false)} />
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label">Product</label>
                  <select className="form-select" value={formProduct} onChange={e => setFormProduct(e.target.value)}>
                    <option value="">-- Select product --</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>
                    ))}
                  </select>
                </div>
                <div className="mb-3">
                  <label className="form-label">Warehouse</label>
                  <select className="form-select" value={formWh} onChange={e => setFormWh(e.target.value)}>
                    <option value="">Main Warehouse</option>
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
                <div className="mb-3">
                  <label className="form-label">Truck</label>
                  <select className="form-select" value={formTruck} onChange={e => setFormTruck(e.target.value)}>
                    <option value="">-- Select truck (optional) --</option>
                    {trucks.map(t => (
                      <option key={t.id} value={t.id}>{t.supplier_name} - {t.products?.name || t.product_id}</option>
                    ))}
                  </select>
                </div>
                <div className="mb-3">
                  <label className="form-label">Quantity (caisses)</label>
                  <input type="number" step="1" min="1" className="form-control" value={formQty}
                    onChange={e => setFormQty(e.target.value)} placeholder="e.g. 50" autoFocus />
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={saveAdd} disabled={!formProduct || !formQty || Number(formQty) <= 0}>Add</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Adjust Stock Modal - +/- allowed */}
      {showAdjModal && adjItem && (
        <div className="modal d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Adjust Stock: {adjItem.products?.name || adjItem.product_name}</h5>
                <button type="button" className="btn-close" onClick={() => { setShowAdjModal(false); setAdjItem(null); }} />
              </div>
              <div className="modal-body">
                <div className="mb-2">
                  <span className="text-muted">Current: </span>
                  <span className="fw-bold fs-5">{Number(adjItem.quantity)}</span>
                  <span className="text-muted ms-2">caisses</span>
                </div>
                <div className="mb-3">
                  <label className="form-label">Warehouse</label>
                  <select className="form-select" value={formWh} onChange={e => setFormWh(e.target.value)}>
                    <option value="">Main Warehouse</option>
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
                <div className="mb-3">
                  <label className="form-label">Truck</label>
                  <select className="form-select" value={formTruck} onChange={e => setFormTruck(e.target.value)}>
                    <option value="">-- Select truck (optional) --</option>
                    {trucks.map(t => (
                      <option key={t.id} value={t.id}>{t.supplier_name} - {t.products?.name || t.product_id}</option>
                    ))}
                  </select>
                </div>
                <div className="mb-3">
                  <label className="form-label">Quantity (+ to add, - to remove)</label>
                  <input type="number" step="1" className="form-control" value={formQty}
                    onChange={e => setFormQty(e.target.value)} placeholder="e.g. 10 or -5" autoFocus />
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => { setShowAdjModal(false); setAdjItem(null); }}>Cancel</button>
                <button className="btn btn-primary" onClick={saveAdj} disabled={!formQty}>Save</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showWhModal && (
        <div className="modal d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Warehouses</h5>
                <button type="button" className="btn-close" onClick={() => setShowWhModal(false)} />
              </div>
              <div className="modal-body">
                {warehouses.map(w => (
                  <div key={w.id} className="d-flex justify-content-between align-items-center py-2 border-bottom">
                    <div>
                      <div className="fw-semibold">{w.name}</div>
                      {w.location && <small className="text-muted">{w.location}</small>}
                    </div>
                    <button className="btn btn-sm btn-outline-danger" onClick={async () => { if (confirm('Delete this warehouse?')) { await api.warehouses.delete(w.id); load(); } }} disabled={user?.role !== 'boss'}>
                      <i className="bi bi-trash" />
                    </button>
                  </div>
                ))}
                <div className="mt-3 pt-3 border-top">
                  <h6 className="fw-semibold mb-2">Add Warehouse</h6>
                  <div className="mb-2">
                    <input type="text" className="form-control form-control-sm" placeholder="Warehouse name" value={whName}
                      onChange={e => setWhName(e.target.value)} />
                  </div>
                  <div className="mb-2">
                    <input type="text" className="form-control form-control-sm" placeholder="Location (optional)" value={whLocation}
                      onChange={e => setWhLocation(e.target.value)} />
                  </div>
                  <button className="btn btn-primary btn-sm" onClick={createWarehouse} disabled={!whName}>Create</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
