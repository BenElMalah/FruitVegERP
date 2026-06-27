import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../services/api';
import Pagination from '../components/Pagination';

const PAGE_SIZE = 100;

export default function TrucksPage() {
  const { t } = useTranslation();
  const [trucks, setTrucks] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ supplier_name: '', product_name: '', default_price: 0, net_weight: 0, cost_price: 0 });

  useEffect(() => { load(); }, []);

  const load = () => api.trucks.list().then(setTrucks);

  const openAdd = () => {
    setEditId(null);
    setForm({ supplier_name: '', product_name: '', default_price: 0, net_weight: 0, cost_price: 0 });
    setShowModal(true);
  };

  const openEdit = (tr: any) => {
    setEditId(tr.id);
    setForm({ supplier_name: tr.supplier_name, product_name: '', default_price: tr.default_price, net_weight: tr.net_weight, cost_price: tr.cost_price });
    setShowModal(true);
  };

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload: any = {
        supplier_name: form.supplier_name,
        default_price: form.default_price,
        net_weight: form.net_weight,
        cost_price: form.cost_price,
      };
      if (form.product_name) {
        payload.product_name = form.product_name;
      }
      if (editId) await api.trucks.update(editId, payload);
      else await api.trucks.create(payload);
      setShowModal(false);
      load();
    } catch (e: any) {
      setError(e.message || 'Failed to save truck');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm(t('Are you sure?'))) return;
    await api.trucks.delete(id);
    load();
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h4 className="mb-0"><i className="bi bi-truck me-2" />{t('Trucks')}</h4>
        <button className="btn btn-primary" onClick={openAdd}><i className="bi bi-plus-lg me-1" />{t('Add Truck')}</button>
      </div>

      <div className="card">
        <div className="card-body p-0">
          <div className="table-responsive">
          <table className="table table-hover mb-0">
            <thead>
              <tr>
                <th>{t('Supplier')}</th>
                <th>{t('Product')}</th>
                <th>{t('Default Price')}</th>
                <th>{t('Cost Price')}</th>
                <th>{t('Net Weight')}</th>
                <th>{t('Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {trucks.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(tr => (
                <tr key={tr.id}>
                  <td className="fw-medium">{tr.supplier_name}</td>
                  <td>{tr.products?.name}</td>
                  <td>{Number(tr.default_price).toFixed(2)}</td>
                  <td>{Number(tr.cost_price || 0).toFixed(2)}</td>
                  <td>{Number(tr.net_weight).toFixed(2)} kg</td>
                  <td>
                    <button className="btn btn-sm btn-outline-primary me-1" onClick={() => openEdit(tr)} title={t('Edit')}>
                      <i className="bi bi-pencil" />
                    </button>
                    <button className="btn btn-sm btn-outline-danger" onClick={() => remove(tr.id)} title={t('Delete')}>
                      <i className="bi bi-trash" />
                    </button>
                  </td>
                </tr>
              ))}
              {!trucks.length && <tr><td colSpan={6} className="text-center text-muted py-4">{t('No trucks yet')}</td></tr>}
            </tbody>
          </table>
          </div>
          <Pagination total={trucks.length} page={page} pageSize={PAGE_SIZE} onPageChange={setPage} />
        </div>
      </div>

      {showModal && (
        <div className="modal d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{editId ? t('Edit Truck') : t('Add Truck')}</h5>
                <button className="btn-close" onClick={() => setShowModal(false)} />
              </div>
              <div className="modal-body">
                {error && <div className="alert alert-danger py-2">{error}</div>}
                <div className="mb-3">
                  <label className="form-label">{t('Supplier Name')}</label>
                  <input className="form-control" value={form.supplier_name} onChange={e => setForm({ ...form, supplier_name: e.target.value })} placeholder="e.g. Youssef" />
                </div>
                <div className="mb-3">
                  <label className="form-label">{t('Product Name')}</label>
                  <input className="form-control" value={form.product_name} onChange={e => setForm({ ...form, product_name: e.target.value })} placeholder={t('Type product name (e.g. Lemon)')} />
                  <small className="text-muted">If product already exists, a number suffix will be added (e.g. Lemon 1, Lemon 2)</small>
                </div>
                <div className="mb-3">
                  <label className="form-label">{t('Default Price')}</label>
                  <input type="number" step="0.5" className="form-control" value={form.default_price || ''} onChange={e => setForm({ ...form, default_price: e.target.value === '' ? 0 : Number(e.target.value) })} />
                </div>
                <div className="mb-3">
                  <label className="form-label">{t('Net Weight (kg)')}</label>
                  <input type="number" step="1" className="form-control" value={form.net_weight || ''} onChange={e => setForm({ ...form, net_weight: e.target.value === '' ? 0 : Number(e.target.value) })} />
                </div>
                <div className="mb-3">
                  <label className="form-label">{t('Cost Price (per kg)')}</label>
                  <input type="number" step="0.5" className="form-control" value={form.cost_price || ''} onChange={e => setForm({ ...form, cost_price: e.target.value === '' ? 0 : Number(e.target.value) })} placeholder="e.g. 8.00" />
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowModal(false)}>{t('Cancel')}</button>
                <button className="btn btn-primary" onClick={save} disabled={saving || !form.supplier_name || !form.product_name}>
                  {saving && <span className="spinner-border spinner-border-sm me-2" role="status" />}{t('Save')}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
