import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import Pagination from '../components/Pagination';

const PAGE_SIZE = 100;

export default function ProductsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [products, setProducts] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [edit, setEdit] = useState<any | null>(null);
  const [form, setForm] = useState<{ name: string; unit: string; price: number }>({ name: '', unit: 'kg', price: 0 });
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);

  const [showClientModal, setShowClientModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [clientLoading, setClientLoading] = useState(false);
  const [page, setPage] = useState(1);

  const canEdit = user?.role === 'boss' || user?.role === 'manager';

  const load = () => api.products.list(filterDate).then(setProducts);
  useEffect(() => { load(); }, [filterDate]);
  useEffect(() => { setPage(1); }, [filterDate]);

  const pagedProducts = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return products.slice(start, start + PAGE_SIZE);
  }, [products, page]);

  const openCreate = () => { setEdit(null); setForm({ name: '', unit: 'kg', price: 0 }); setShowModal(true); };
  const openEdit = (p: any) => { setEdit(p); setForm({ name: p.name, unit: p.unit, price: p.price }); setShowModal(true); };

  const save = async () => {
    if (edit) await api.products.update(edit.id, form);
    else await api.products.create(form);
    setShowModal(false);
    load();
  };

  const remove = async (id: string) => {
    if (confirm(t('Delete this product?'))) {
      await api.products.delete(id);
      load();
    }
  };

  const openClients = async (p: any) => {
    setSelectedProduct(p);
    setShowClientModal(true);
    setClientLoading(true);
    try {
      const data = await api.products.clients(p.id);
      setClients(data);
    } catch (e) {
      setClients([]);
    } finally {
      setClientLoading(false);
    }
  };

  const handleBackfill = async () => {
    if (!confirm('This will create missing products from truck data. Continue?')) return;
    try {
      const result = await api.products.backfillFromTrucks();
      alert('Created ' + result.created + ' products from ' + result.total_missing + ' missing');
      load();
    } catch (e: any) {
      alert('Failed: ' + e.message);
    }
  };

  const duplicate = async (p: any) => {
    const baseMatch = p.name.match(/^(.*?)\s*(\d+)$/);
    const baseName = baseMatch ? baseMatch[1].trim() : p.name;
    const nums = products
      .filter(pr => {
        const m = pr.name.match(/^(.*?)\s*(\d+)$/);
        return m ? m[1].trim() === baseName : pr.name === baseName;
      })
      .map(pr => {
        const m = pr.name.match(/.*?\s*(\d+)$/);
        return m ? parseInt(m[1]) : 0;
      });
    const nextNum = Math.max(...nums, -1) + 1;
    const newName = nextNum === 0 ? baseName : `${baseName} ${nextNum}`;
    await api.products.create({ name: newName, unit: p.unit, price: p.price });
    load();
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h4 className="mb-0"><i className="bi bi-basket me-2" />{t('Products')}</h4>
        <div className="d-flex gap-2">
          <input type="date" className="form-control form-control-sm" style={{ width: 160 }} value={filterDate}
            onChange={e => setFilterDate(e.target.value)} />
          {canEdit && <button className="btn btn-outline-warning btn-sm" onClick={handleBackfill} title="Create missing products from trucks"><i className="bi bi-truck me-1" />Backfill</button>}
          {canEdit && <button className="btn btn-primary btn-sm" onClick={openCreate}><i className="bi bi-plus-lg me-1" />{t('Add Product')}</button>}
        </div>
      </div>

      <div className="card">
        <div className="card-body p-0">
          <div className="table-responsive">
          <table className="table table-hover mb-0">
            <thead>
              <tr>
                <th>{t('Product')}</th>
                <th className="text-end" style={{ width: 100 }}>{t('Price')}</th>
                <th className="text-end" style={{ width: 100 }}>{t('Moy/Price')}</th>
                <th>{t('Information')}</th>
              </tr>
            </thead>
            <tbody>
              {pagedProducts.map(p => (
                <tr key={p.id}>
                  <td className="fw-semibold">{p.name}</td>
                  <td className="text-end">{Number(p.price).toFixed(2)}</td>
                  <td className="text-end">
                    <span className={Number(p.moy_price) > 0 ? '' : 'text-muted'}>
                      {Number(p.moy_price) > 0 ? Number(p.moy_price).toFixed(2) : '—'}
                    </span>
                  </td>
                  <td>
                    <button className="btn btn-sm btn-outline-info w-100" onClick={() => openClients(p)}>
                      <i className="bi bi-people me-1" />Clients
                    </button>
                  </td>
                </tr>
              ))}
              {!products.length && <tr><td colSpan={4} className="text-center text-muted py-4">{t('No products for this date')}</td></tr>}
            </tbody>
          </table>
          </div>
          <Pagination total={products.length} page={page} pageSize={PAGE_SIZE} onPageChange={setPage} />
        </div>
      </div>

      {/* Client Details Modal */}
      {showClientModal && (
        <div className="modal d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg modal-dialog-scrollable">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title"><i className="bi bi-people me-2" />{selectedProduct?.name} — Clients</h5>
                <button className="btn-close" onClick={() => setShowClientModal(false)} />
              </div>
              <div className="modal-body p-0">
                {clientLoading ? (
                  <div className="text-center py-5"><div className="spinner-border text-primary" /></div>
                ) : clients.length === 0 ? (
                  <p className="text-muted text-center py-4">No clients have purchased this product yet.</p>
                ) : (
                  <div className="table-responsive">
                  <table className="table table-hover mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>Client</th>
                        <th className="text-end">Caisses</th>
                        <th className="text-end">Weight</th>
                        <th className="text-end">Price</th>
                        <th className="text-end">Due</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clients.map(c => (
                        <tr key={c.client_id}>
                          <td className="fw-medium">
                            {c.client_name}
                            {c.phone && <br />}
                            {c.phone && <small className="text-muted">{c.phone}</small>}
                          </td>
                          <td className="text-end">{c.total_caisses}</td>
                          <td className="text-end">{c.total_weight.toFixed(2)}</td>
                          <td className="text-end">{c.total_price.toFixed(2)}</td>
                          <td className="text-end">
                            <span className={c.total_due > 0 ? 'text-danger fw-bold' : 'text-success'}>
                              {c.total_due.toFixed(2)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowClientModal(false)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{edit ? t('Edit Product') : t('Add Product')}</h5>
                <button className="btn-close" onClick={() => setShowModal(false)} />
              </div>
              <div className="modal-body">
                <div className="mb-3" style={{ position: 'relative' }}>
                  <label className="form-label">{t('Name')}</label>
                  <input className="form-control" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                  {form.name && !edit && (
                    <div className="list-group position-absolute w-100" style={{ zIndex: 10, maxHeight: 150, overflow: 'auto' }}>
                      {products.filter(p => p.name.toLowerCase().includes(form.name.toLowerCase()) && p.name !== form.name).map(p => (
                        <button key={p.id} type="button" className="list-group-item list-group-item-action py-1"
                          onClick={() => setForm({ ...form, name: p.name, unit: p.unit, price: p.price })}>
                          {p.name} <small className="text-muted">({p.unit}, {p.price.toFixed(2)})</small>
                        </button>
                      ))}
                      {products.filter(p => p.name.toLowerCase().includes(form.name.toLowerCase()) && p.name !== form.name).length === 0 && (
                        <div className="list-group-item text-muted small">{t('No matching products')}</div>
                      )}
                    </div>
                  )}
                </div>
                <div className="mb-3">
                  <label className="form-label">{t('Unit')}</label>
                  <select className="form-select" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value as any })}>
                    <option value="kg">{t('kg')}</option>
                    <option value="box">{t('box')}</option>
                    <option value="piece">{t('piece')}</option>
                    <option value="crate">{t('crate')}</option>
                    <option value="bag">{t('bag')}</option>
                    <option value="ton">{t('ton')}</option>
                  </select>
                </div>
                <div className="mb-3">
                  <label className="form-label">{t('Price')}</label>
                  <input type="number" className="form-control" value={form.price || ''} onChange={e => setForm({ ...form, price: e.target.value === '' ? 0 : Number(e.target.value) })} step={0.01} />
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowModal(false)}>{t('Cancel')}</button>
                <button className="btn btn-primary" onClick={save}>{t('Save')}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
