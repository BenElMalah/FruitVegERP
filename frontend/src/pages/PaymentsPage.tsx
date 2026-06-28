import { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from 'react-i18next';
import Pagination from '../components/Pagination';
import type { Payment } from '../types';

const PAGE_SIZE = 100;

const methodLabels: Record<string, string> = {
  cash: 'Cash',
  bank_transfer: 'Bank Transfer',
  check: 'Check',
  lcn: 'LCN',
};

export default function PaymentsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [form, setForm] = useState<{ client_id: string; amount: number; payment_method: string; notes: string; lcn_date: string }>({ client_id: '', amount: 0, payment_method: 'cash', notes: '', lcn_date: '' });
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [clientSearch, setClientSearch] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [searchClient, setSearchClient] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    load().catch(() => {});
  }, []);
  const load = () => Promise.all([
    api.payments.list().then(setPayments),
    api.clients.list().then(setClients),
    api.invoices.list().then(setInvoices),
  ]).catch(() => {});

  const openCreate = () => {
    setForm({ client_id: '', amount: 0, payment_method: 'cash', notes: '', lcn_date: '' });
    setSelectedInvoiceIds([]);
    setClientSearch('');
    setError('');
    setShowCreate(true);
  };

  const createPayment = async () => {
    if (!form.client_id || selectedInvoiceIds.length === 0 || form.amount <= 0) return;
    try {
      setError('');
      if (selectedInvoiceIds.length === 1) {
        await api.payments.create({
          invoice_id: selectedInvoiceIds[0],
          client_id: form.client_id,
          amount: form.amount,
          payment_method: form.payment_method,
          notes: form.notes,
          lcn_date: form.payment_method === 'lcn' ? form.lcn_date : undefined,
        });
      } else {
        await api.invoices.group({
          invoice_ids: selectedInvoiceIds,
          payment_amount: form.amount,
          payment_method: form.payment_method,
          notes: form.notes,
          lcn_date: form.payment_method === 'lcn' ? form.lcn_date : undefined,
        });
      }
      setShowCreate(false);
      load();
    } catch (err: any) {
      setError(err.message || 'Failed to register payment');
    }
  };

  const canCreate = user?.role === 'boss' || user?.role === 'manager' || user?.role === 'collector';
  const unpaidInvoices = useMemo(() => {
    let list = invoices.filter(i => i.status !== 'paid');
    if (form.client_id) list = list.filter(i => i.client_id === form.client_id);
    return list;
  }, [invoices, form.client_id]);
  const pagedPayments = useMemo(() => {
    let result = payments;

    if (searchClient.trim()) {
      const q = searchClient.toLowerCase();
      result = result.filter(p => (p.clients?.name || '').toLowerCase().includes(q));
    }

    const today = new Date().toISOString().split('T')[0];
    if (!dateFrom && !dateTo) {
      result = result.filter(p => {
        const d = new Date(p.created_at).toISOString().split('T')[0];
        return d === today;
      });
    } else {
      if (dateFrom) result = result.filter(p => p.created_at && p.created_at >= dateFrom);
      if (dateTo) result = result.filter(p => p.created_at && p.created_at <= dateTo + 'T23:59:59');
    }

    const start = (page - 1) * PAGE_SIZE;
    return result.slice(start, start + PAGE_SIZE);
  }, [payments, searchClient, dateFrom, dateTo, page]);

  const filteredCount = useMemo(() => {
    let result = payments;
    if (searchClient.trim()) {
      const q = searchClient.toLowerCase();
      result = result.filter(p => (p.clients?.name || '').toLowerCase().includes(q));
    }
    const today = new Date().toISOString().split('T')[0];
    if (!dateFrom && !dateTo) {
      result = result.filter(p => {
        const d = new Date(p.created_at).toISOString().split('T')[0];
        return d === today;
      });
    } else {
      if (dateFrom) result = result.filter(p => p.created_at && p.created_at >= dateFrom);
      if (dateTo) result = result.filter(p => p.created_at && p.created_at <= dateTo + 'T23:59:59');
    }
    return result.length;
  }, [payments, searchClient, dateFrom, dateTo]);

  const filteredClients = useMemo(() =>
    clientSearch ? clients.filter((c: any) => c.name.toLowerCase().includes(clientSearch.toLowerCase())) : clients
  , [clients, clientSearch]);

  const totalSelectedDue = useMemo(() =>
    unpaidInvoices.filter(i => selectedInvoiceIds.includes(i.id)).reduce((s, i) => s + Number(i.remaining_amount), 0)
  , [unpaidInvoices, selectedInvoiceIds]);

  const allSelected = unpaidInvoices.length > 0 && unpaidInvoices.every(i => selectedInvoiceIds.includes(i.id));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedInvoiceIds([]);
      setForm({ ...form, amount: 0 });
    } else {
      setSelectedInvoiceIds(unpaidInvoices.map(i => i.id));
      setForm({ ...form, amount: unpaidInvoices.reduce((s, i) => s + Number(i.remaining_amount), 0) });
    }
  };

  const toggleInvoice = (id: string, remaining: number) => {
    setSelectedInvoiceIds(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      return next;
    });
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h4 className="mb-0"><i className="bi bi-cash-coin me-2" />{t('Payments')}</h4>
        {canCreate && <button className="btn btn-primary" onClick={openCreate}><i className="bi bi-plus-lg me-1" />{t('Register Payment')}</button>}
      </div>

      <div className="card mb-3 border-0 shadow-sm">
        <div className="card-body py-3">
          <div className="d-flex gap-2 align-items-center flex-wrap">
            <div className="input-group" style={{ maxWidth: 300 }}>
              <span className="input-group-text bg-light"><i className="bi bi-search" /></span>
              <input type="text" className="form-control" placeholder={t('Search client...')}
                value={searchClient}
                onChange={e => { setSearchClient(e.target.value); setPage(1); }}
              />
            </div>
            <button className={`btn ${showDateFilter ? 'btn-secondary' : 'btn-outline-secondary'}`}
              onClick={() => setShowDateFilter(!showDateFilter)}>
              <i className="bi bi-calendar me-1" />{t('Date Filter')}
              {(dateFrom || dateTo) && <span className="badge bg-danger ms-1">!</span>}
            </button>
            {(dateFrom || dateTo) && (
              <button className="btn btn-outline-danger btn-sm" onClick={() => { setDateFrom(''); setDateTo(''); setPage(1); }}>
                <i className="bi bi-x-circle me-1" />{t('Clear')}
              </button>
            )}
            <span className="text-muted ms-auto small">
              {filteredCount} {t('payments')}
            </span>
          </div>
          {showDateFilter && (
            <div className="border-top pt-3 mt-3">
              <div className="d-flex gap-2 align-items-end flex-wrap">
                <div style={{ minWidth: 150 }}>
                  <label className="form-label small text-muted mb-1">{t('From')}</label>
                  <input type="date" className="form-control form-control-sm" value={dateFrom}
                    onChange={e => { setDateFrom(e.target.value); setPage(1); }} />
                </div>
                <div style={{ minWidth: 150 }}>
                  <label className="form-label small text-muted mb-1">{t('To')}</label>
                  <input type="date" className="form-control form-control-sm" value={dateTo}
                    onChange={e => { setDateTo(e.target.value); setPage(1); }} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-body p-0">
          <div className="table-responsive">
          <table className="table table-hover mb-0">
            <thead>
              <tr>
                <th>{t('Invoice')}</th>
                <th>{t('Client')}</th>
                <th>{t('Amount')}</th>
                <th>{t('Method')}</th>
                <th>{t('Date')}</th>
                <th>{t('Collected By')}</th>
              </tr>
            </thead>
            <tbody>
              {pagedPayments.map(p => (
                <tr key={p.id}>
                  <td>{p.invoices?.invoice_number || '-'}</td>
                  <td>{p.clients?.name || '-'}</td>
                  <td className="text-success fw-bold">{Number(p.amount).toFixed(2)}</td>
                  <td><span className="badge bg-secondary">{t(methodLabels[p.payment_method] || p.payment_method.replace('_', ' '))}</span></td>
                  <td><small>{p.payment_method === 'lcn' && (p as any).lcn_date ? (p as any).lcn_date : new Date(p.created_at).toLocaleDateString()}</small></td>
                  <td><small>{(p as any).profiles?.name || '-'}</small></td>
                </tr>
              ))}
              {!pagedPayments.length && <tr><td colSpan={6} className="text-center text-muted py-4">{t('No payments recorded')}</td></tr>}
            </tbody>
          </table>
          </div>
          <Pagination total={filteredCount} page={page} pageSize={PAGE_SIZE} onPageChange={setPage} />
        </div>
      </div>

      {showCreate && (
        <div className="modal d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{t('Register Payment')}</h5>
                <button className="btn-close" onClick={() => setShowCreate(false)} />
              </div>
              <div className="modal-body">
                {error && <div className="alert alert-danger py-2">{error}</div>}
                <div className="mb-3 position-relative">
                  <label className="form-label">{t('Client')}</label>
                  <input type="text" className="form-control" placeholder={t('Search client...')}
                    value={clientSearch}
                    onChange={e => {
                      setClientSearch(e.target.value);
                      setShowClientDropdown(true);
                      const match = clients.find((c: any) => c.name.toLowerCase() === e.target.value.toLowerCase());
                      if (match) { setForm({ ...form, client_id: match.id, amount: 0 }); setSelectedInvoiceIds([]); }
                      else { setForm({ ...form, client_id: '', amount: 0 }); setSelectedInvoiceIds([]); }
                    }}
                    onFocus={() => setShowClientDropdown(true)}
                    onBlur={() => setTimeout(() => setShowClientDropdown(false), 200)}
                  />
                  {showClientDropdown && clientSearch && !form.client_id && (
                    <div className="list-group position-absolute w-100" style={{ zIndex: 1050, maxHeight: 180, overflow: 'auto' }}>
                      {filteredClients.map((c: any) => (
                        <button key={c.id} type="button" className="list-group-item list-group-item-action py-1"
                          onMouseDown={() => {
                            setClientSearch(c.name);
                            setForm({ ...form, client_id: c.id, amount: 0 });
                            setSelectedInvoiceIds([]);
                            setShowClientDropdown(false);
                          }}>
                          <div className="fw-medium">{c.name}</div>
                          <small className="text-muted">{c.phone || c.address || ''}</small>
                        </button>
                      ))}
                      {filteredClients.length === 0 && <div className="list-group-item text-muted small">{t('No clients found')}</div>}
                    </div>
                  )}
                  {form.client_id && clientSearch && (
                    <span className="position-absolute" style={{ right: 10, top: 34 }}><i className="bi bi-check-circle text-success" /></span>
                  )}
                </div>
                {form.client_id && (
                <div className="mb-3">
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <label className="form-label mb-0">{t('Invoices')}</label>
                    {unpaidInvoices.length > 0 && (
                      <button type="button" className="btn btn-link btn-sm p-0" onClick={toggleSelectAll}>
                        {allSelected ? t('Deselect All') : t('Select All')}
                      </button>
                    )}
                  </div>
                  <div className="border rounded" style={{ maxHeight: 200, overflow: 'auto' }}>
                    {unpaidInvoices.length === 0 && (
                      <div className="text-muted small p-2">{t('No unpaid invoices')}</div>
                    )}
                    {unpaidInvoices.map(i => (
                      <label key={i.id} className="d-flex align-items-center gap-2 px-2 py-1 border-bottom mb-0" style={{ cursor: 'pointer' }}>
                        <input type="checkbox" className="form-check-input"
                          checked={selectedInvoiceIds.includes(i.id)}
                          onChange={() => toggleInvoice(i.id, Number(i.remaining_amount))}
                        />
                        <span className="flex-grow-1 small">
                          {i.invoice_number}
                          {i.due_date && <span className="text-muted ms-1">({new Date(i.due_date).toLocaleDateString()})</span>}
                        </span>
                        <span className="fw-bold small">{Number(i.remaining_amount).toFixed(2)}</span>
                      </label>
                    ))}
                  </div>
                  {selectedInvoiceIds.length > 0 && (
                    <div className="text-end mt-1">
                      <small className="text-muted">{selectedInvoiceIds.length} {t('selected')} — </small>
                      <small className="fw-bold">{t('Total due')}: {totalSelectedDue.toFixed(2)}</small>
                    </div>
                  )}
                </div>
                )}
                <div className="mb-3">
                  <label className="form-label">{t('Amount')}</label>
                  <div className="input-group">
                    <input type="number" className="form-control" value={form.amount || ''} onChange={e => setForm({ ...form, amount: e.target.value === '' ? 0 : Number(e.target.value) })} step={0.01} min={0} />
                    {selectedInvoiceIds.length > 0 && (
                      <button type="button" className="btn btn-outline-secondary" onClick={() => setForm({ ...form, amount: totalSelectedDue })}>
                        {t('Pay all')}: {totalSelectedDue.toFixed(2)}
                      </button>
                    )}
                  </div>
                </div>
                <div className="mb-3">
                  <label className="form-label">{t('Method')}</label>
                  <select className="form-select" value={form.payment_method} onChange={e => setForm({ ...form, payment_method: e.target.value as any })}>
                    <option value="cash">{t('Cash')}</option>
                    <option value="bank_transfer">{t('Bank Transfer')}</option>
                    <option value="check">{t('Check')}</option>
                    <option value="lcn">LCN</option>
                  </select>
                </div>
                {form.payment_method === 'lcn' && (
                <div className="mb-3">
                  <label className="form-label">{t('LCN Date')}</label>
                  <input type="date" className="form-control" value={form.lcn_date} onChange={e => setForm({ ...form, lcn_date: e.target.value })} />
                </div>
                )}
                <div className="mb-3">
                  <label className="form-label">{t('Notes')}</label>
                  <textarea className="form-control" rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>{t('Cancel')}</button>
                <button className="btn btn-primary" onClick={createPayment} disabled={!form.client_id || selectedInvoiceIds.length === 0 || form.amount <= 0}>{t('Register Payment')}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
