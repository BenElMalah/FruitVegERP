import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../services/api';

export default function ArrivalsPage() {
  const { t } = useTranslation();
  const [arrivals, setArrivals] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [caisseTypes, setCaisseTypes] = useState<any[]>([]);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ product_id: '', caisse_type_id: '', quantity: 1, notes: '' });

  useEffect(() => { load(); loadProducts(); loadCaisseTypes(); }, []);
  const load = () => api.arrivals.list(date).then(setArrivals);
  const loadProducts = () => api.products.list().then(setProducts);
  const loadCaisseTypes = () => api.caisse.types().then(setCaisseTypes);

  const openAdd = () => {
    setEditId(null);
    setForm({ product_id: '', caisse_type_id: '', quantity: 1, notes: '' });
    setShowModal(true);
  };

  const openEdit = (a: any) => {
    setEditId(a.id);
    setForm({ product_id: a.product_id, caisse_type_id: a.caisse_type_id, quantity: a.quantity, notes: a.notes || '' });
    setShowModal(true);
  };

  const save = async () => {
    const payload = { arrival_date: date, ...form };
    if (editId) await api.arrivals.update(editId, payload);
    else await api.arrivals.create(payload);
    setShowModal(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm(t('Are you sure?'))) return;
    await api.arrivals.delete(id);
    load();
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h4 className="mb-0"><i className="bi bi-truck me-2" />{t('Daily Arrivals')}</h4>
        <div className="d-flex gap-2 align-items-center">
          <input type="date" className="form-control form-control-sm" style={{ width: 180 }} value={date}
            onChange={e => { setDate(e.target.value); }} />
          <button className="btn btn-primary btn-sm" onClick={load}><i className="bi bi-arrow-clockwise me-1" />{t('Refresh')}</button>
          <button className="btn btn-primary" onClick={openAdd}><i className="bi bi-plus-lg me-1" />{t('Add Arrival')}</button>
        </div>
      </div>

      <div className="card">
        <div className="card-body p-0">
          <table className="table table-hover mb-0">
            <thead>
              <tr>
                <th>#</th>
                <th>{t('Product')}</th>
                <th>{t('Caisse Type')}</th>
                <th>{t('Quantity')}</th>
                <th>{t('Notes')}</th>
                <th>{t('Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {arrivals.map((a, i) => (
                <tr key={a.id}>
                  <td>{i + 1}</td>
                  <td>{a.products?.name}</td>
                  <td>{a.caisse_types?.name}</td>
                  <td>{a.quantity}</td>
                  <td><small className="text-muted">{a.notes}</small></td>
                  <td>
                    <button className="btn btn-sm btn-outline-primary me-1" onClick={() => openEdit(a)} title={t('Edit')}>
                      <i className="bi bi-pencil" />
                    </button>
                    <button className="btn btn-sm btn-outline-danger" onClick={() => remove(a.id)} title={t('Delete')}>
                      <i className="bi bi-trash" />
                    </button>
                  </td>
                </tr>
              ))}
              {!arrivals.length && <tr><td colSpan={6} className="text-center text-muted py-4">{t('No arrivals for this date')}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{editId ? t('Edit Arrival') : t('Add Arrival')}</h5>
                <button className="btn-close" onClick={() => setShowModal(false)} />
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label">{t('Product')}</label>
                  <select className="form-select" value={form.product_id} onChange={e => setForm({ ...form, product_id: e.target.value })}>
                    <option value="">{t('Select')}</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="mb-3">
                  <label className="form-label">{t('Caisse Type')}</label>
                  <select className="form-select" value={form.caisse_type_id} onChange={e => setForm({ ...form, caisse_type_id: e.target.value })}>
                    <option value="">{t('Select')}</option>
                    {caisseTypes.map(ct => <option key={ct.id} value={ct.id}>{ct.name}</option>)}
                  </select>
                </div>
                <div className="mb-3">
                  <label className="form-label">{t('Quantity')}</label>
                  <input type="number" className="form-control" value={form.quantity || ''} onChange={e => setForm({ ...form, quantity: e.target.value === '' ? 0 : Number(e.target.value) })} min={1} />
                </div>
                <div className="mb-3">
                  <label className="form-label">{t('Notes')}</label>
                  <textarea className="form-control" rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowModal(false)}>{t('Cancel')}</button>
                <button className="btn btn-primary" onClick={save} disabled={!form.product_id || !form.caisse_type_id || !form.quantity}>
                  {t('Save')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
