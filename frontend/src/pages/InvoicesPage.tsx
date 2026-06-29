import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import Pagination from '../components/Pagination';
import type { Invoice } from '../types';

const PAGE_SIZE = 100;

export default function InvoicesPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState<string | null>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [caisseTypes, setCaisseTypes] = useState<any[]>([]);
  const [form, setForm] = useState({ client_id: '', due_date: '', notes: '' });
  const [clientSearch, setClientSearch] = useState('');
  const [editClientSearch, setEditClientSearch] = useState('');
  const [items, setItems] = useState<any[]>([{ product_id: '', count: 1, total_weight: 1, price: 0, caisses: [] }]);
  const [editItems, setEditItems] = useState<any[]>([]);
  const [editForm, setEditForm] = useState({ client_id: '', due_date: '', notes: '' });

  const [searchQuery, setSearchQuery] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [groupedInvoice, setGroupedInvoice] = useState<any>(null);
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);
  const [viewItems, setViewItems] = useState<any[]>([]);
  const [viewLoading, setViewLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'list' | 'quick'>('list');
  const [quickForm, setQuickForm] = useState({ client_id: '', product_id: '', total_weight: 0, caisse_type_id: '', caisse_count: 0, notify_collectors: true });
  const [quickClientSearch, setQuickClientSearch] = useState('');

  useEffect(() => { load(); loadCaisseTypes(); }, []);
  const load = () => Promise.all([
    api.invoices.list().then(setInvoices),
    api.clients.list().then(setClients),
  ]);
  const loadCaisseTypes = () => api.caisse.types().then(setCaisseTypes);

  const loadProducts = async (date?: string) => {
    const today = new Date().toISOString().split('T')[0];
    const d = date || today;
    const data = await api.products.list(d);
    setProducts(data);
  };

  const brandedId = caisseTypes.find((t: any) => t.category === 'branded')?.id || '';

  const defaultCaisses = () => brandedId ? [{ caisse_type_id: brandedId, caisse_count: 1 }] : [];

  const computeNetWeight = (item: any) => {
    const tareSum = (item.caisses || []).reduce((sum: number, c: any) => {
      const ct = caisseTypes.find((ct: any) => ct.id === c.caisse_type_id);
      return sum + (c.caisse_count || 0) * (ct?.tare || 0);
    }, 0);
    return Math.max(0, (item.total_weight || 0) - tareSum);
  };

  const openCreate = () => {
    const today = new Date().toISOString().split('T')[0];
    setForm({ client_id: '', due_date: '', notes: '' });
    setClientSearch('');
    setItems([{ product_id: '', count: 1, total_weight: 1, price: 0, caisses: defaultCaisses() }]);
    setShowCreate(true);
    loadProducts(today);
  };

  const openEditModal = async (inv: Invoice) => {
    const full = await api.invoices.get(inv.id);
    setEditForm({ client_id: full.client_id, due_date: full.due_date || '', notes: full.notes || '' });
    setEditClientSearch(full.clients?.name || '');
    setEditItems((full.invoice_items || []).map((it: any) => ({
      product_id: it.product_id,
      count: 0,
      total_weight: it.total_weight || it.quantity,
      price: it.price,
      caisses: (it.caisses || (it.caisse_type_id ? [{ caisse_type_id: it.caisse_type_id, caisse_count: it.caisse_count || 0 }] : [])),
    })));
    setShowEdit(inv.id);
    loadProducts(full.due_date || undefined);
  };

  const openViewInvoice = async (inv: Invoice) => {
    setViewLoading(true);
    setViewInvoice(inv);
    try {
      const full = await api.invoices.get(inv.id);
      setViewItems(full.invoice_items || []);
    } catch {}
    setViewLoading(false);
  };

  const addCaisse = (i: number, isEdit?: boolean) => {
    const arr = isEdit ? [...editItems] : [...items];
    arr[i] = { ...arr[i], caisses: [...arr[i].caisses, { caisse_type_id: '', caisse_count: 0 }] };
    if (isEdit) setEditItems(arr); else setItems(arr);
  };

  const updateCaisse = (itemIdx: number, caisseIdx: number, field: string, value: any, isEdit?: boolean) => {
    const arr = isEdit ? [...editItems] : [...items];
    const caisses = [...arr[itemIdx].caisses];
    caisses[caisseIdx] = { ...caisses[caisseIdx], [field]: value };
    arr[itemIdx] = { ...arr[itemIdx], caisses };
    if (isEdit) setEditItems(arr); else setItems(arr);
  };

  const removeCaisse = (itemIdx: number, caisseIdx: number, isEdit?: boolean) => {
    const arr = isEdit ? [...editItems] : [...items];
    const caisses = arr[itemIdx].caisses.filter((_: any, idx: number) => idx !== caisseIdx);
    arr[itemIdx] = { ...arr[itemIdx], caisses };
    if (isEdit) setEditItems(arr); else setItems(arr);
  };

  const addItem = (isEdit?: boolean) => {
    const newItem = { product_id: '', count: 1, total_weight: 1, price: 0, caisses: defaultCaisses() };
    if (isEdit) setEditItems([...editItems, newItem]);
    else setItems([...items, newItem]);
  };

  const updateItem = (i: number, field: string, value: any, isEdit?: boolean) => {
    const arr = isEdit ? [...editItems] : [...items];
    arr[i] = { ...arr[i], [field]: value };
    if (field === 'product_id') {
      const p = products.find(pr => pr.id === value);
      if (p) arr[i].price = p.price;
    }
    if (isEdit) setEditItems(arr); else setItems(arr);
  };

  const removeItem = (i: number, isEdit?: boolean) => {
    if (isEdit) setEditItems(editItems.filter((_, idx) => idx !== i));
    else setItems(items.filter((_, idx) => idx !== i));
  };

  const itemTotal = (item: any) => computeNetWeight(item) * (item.price || 0);
  const invoiceTotal = (its: any[]) => its.reduce((s, it) => s + itemTotal(it), 0);

  const prepareItems = (its: any[]) => its.map(it => ({
    product_id: it.product_id,
    total_weight: it.total_weight || 0,
    price: it.price,
    caisses: (it.caisses || []).filter((c: any) => c.caisse_type_id && c.caisse_count > 0),
  }));

  const createInvoice = async () => {
    await api.invoices.create({ ...form, items: prepareItems(items) });
    setShowCreate(false);
    load();
  };

  const saveEdit = async () => {
    await api.invoices.update(showEdit!, { ...editForm, items: prepareItems(editItems) });
    setShowEdit(null);
    load();
  };

  const whatsappShare = (inv: Invoice) => {
    const lines = [
      `┌─────────────────────────────┐`,
      `│     🧾 INVOICE #${inv.invoice_number}       │`,
      `└─────────────────────────────┘`,
      ``,
      `👤 *${inv.clients?.name || ''}*`,
      `📅 ${new Date(inv.due_date || inv.created_at).toLocaleDateString()}`,
      ``,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    ];
    (inv.invoice_items || []).forEach((it: any) => {
      const name = it.products?.name || 'Product';
      const netWeight = it.quantity || it.total_weight || 0;
      lines.push(`📦 ${name}`);
      lines.push(`   ${netWeight}kg × ${Number(it.price).toFixed(2)} = *${Number(it.subtotal).toFixed(2)}*`);
    });
    lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    lines.push(``);
    lines.push(`┌─────────────────────────────┐`);
    lines.push(`│ Total:     ${Number(inv.total).toFixed(2).padStart(10)}     │`);
    lines.push(`│ Paid:      ${Number(inv.paid_amount).toFixed(2).padStart(10)}     │`);
    lines.push(`│ Remaining: ${Number(inv.remaining_amount).toFixed(2).padStart(10)}     │`);
    lines.push(`└─────────────────────────────┘`);
    const text = encodeURIComponent(lines.join('\n'));
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const filteredInvoices = useMemo(() => {
    let result = invoices;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((inv: any) => {
        const clientName = (inv.clients?.name || '').toLowerCase();
        const clientAddress = (inv.clients?.address || '').toLowerCase();
        return clientName.includes(q) || clientAddress.includes(q);
      });
    }
    if (filterDateFrom) result = result.filter((inv: any) => inv.created_at && inv.created_at >= filterDateFrom);
    if (filterDateTo) result = result.filter((inv: any) => inv.created_at && inv.created_at <= filterDateTo + 'T23:59:59');
    return result;
  }, [invoices, searchQuery, filterDateFrom, filterDateTo]);

  const pagedInvoices = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredInvoices.slice(start, start + PAGE_SIZE);
  }, [filteredInvoices, page]);

  const resetFilters = () => {
    setSearchQuery('');
    setFilterDateFrom('');
    setFilterDateTo('');
    setPage(1);
  };
  const hasActiveFilters = searchQuery || filterDateFrom || filterDateTo;

  const quickNetWeight = useMemo(() => {
    const ct = caisseTypes.find((c: any) => c.id === quickForm.caisse_type_id);
    const tare = ct ? (Number(ct.tare) || 0) * (quickForm.caisse_count || 0) : 0;
    return Math.max(0, (quickForm.total_weight || 0) - tare);
  }, [quickForm.total_weight, quickForm.caisse_type_id, quickForm.caisse_count, caisseTypes]);

  const quickProduct = useMemo(() => products.find((p: any) => p.id === quickForm.product_id), [quickForm.product_id, products]);
  const quickPrice = quickProduct ? Number(quickProduct.price) || 0 : 0;
  const quickDue = quickNetWeight * quickPrice;

  const quickFilteredClients = useMemo(() => {
    if (!quickClientSearch.trim()) return clients;
    const q = quickClientSearch.toLowerCase();
    return clients.filter((c: any) => c.name.toLowerCase().includes(q) || (c.phone || '').includes(q) || (c.address || '').toLowerCase().includes(q));
  }, [quickClientSearch, clients]);

  const submitQuickInvoice = async () => {
    if (!quickForm.client_id || !quickForm.product_id || quickForm.total_weight <= 0) return;
    try {
      const caisses = quickForm.caisse_type_id && quickForm.caisse_count > 0
        ? [{ caisse_type_id: quickForm.caisse_type_id, caisse_count: quickForm.caisse_count }]
        : [];
      await api.invoices.create({
        client_id: quickForm.client_id,
        due_date: new Date().toISOString().split('T')[0],
        items: [{ product_id: quickForm.product_id, total_weight: quickForm.total_weight, price: quickPrice, caisses }],
        notify_collectors: quickForm.notify_collectors,
      });
      showToast(t('Invoice created'), 'success');
      setQuickForm({ client_id: '', product_id: '', total_weight: 0, caisse_type_id: '', caisse_count: 0, notify_collectors: true });
      setQuickClientSearch('');
      load();
    } catch (err: any) {
      showToast(err.message || 'Failed', 'error');
    }
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    const toast = document.createElement('div');
    toast.className = `fixed top-4 right-4 z-50 px-4 py-2.5 rounded-xl shadow-lg text-white text-sm font-medium ${type === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  };

  const getBadge = (status: string) => {
    const map: Record<string, string> = { unpaid: 'warning', partial: 'info', paid: 'success', overdue: 'danger' };
    return `badge bg-${map[status] || 'secondary'}`;
  };

  const renderItemRow = (item: any, i: number, isEdit?: boolean) => (
    <tr key={i}>
      <td>
        <select className="form-select form-select-sm" value={item.product_id} onChange={e => updateItem(i, 'product_id', e.target.value, isEdit)}>
          <option value="">{t('Product')}</option>
          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </td>
      <td>
        <input type="number" className="form-control form-control-sm" value={item.count || ''} onChange={e => updateItem(i, 'count', e.target.value === '' ? 0 : Number(e.target.value), isEdit)} min={1} />
      </td>
      <td>
        <input type="number" className="form-control form-control-sm" value={item.total_weight || ''} onChange={e => updateItem(i, 'total_weight', e.target.value === '' ? 0 : Number(e.target.value), isEdit)} step={0.1} min={0.1} />
      </td>
      <td className="text-center pt-2 text-muted small">{computeNetWeight(item).toFixed(2)}</td>
      <td>
        <input type="number" className="form-control form-control-sm" value={item.price || ''} onChange={e => updateItem(i, 'price', e.target.value === '' ? 0 : Number(e.target.value), isEdit)} step={0.01} min={0} />
      </td>
      <td className="text-end fw-bold pt-2">{itemTotal(item).toFixed(2)}</td>
      <td colSpan={3}>
        {item.caisses.map((c: any, ci: number) => {
          const ct = caisseTypes.find((ct: any) => ct.id === c.caisse_type_id);
          const tareStr = ct ? `${(ct.tare || 0).toFixed(3)}kg` : '';
          return (
            <div key={ci} className="d-flex gap-1 mb-1 align-items-center">
              <select className="form-select form-select-sm" style={{ width: 'auto', minWidth: 120 }} value={c.caisse_type_id}
                onChange={e => updateCaisse(i, ci, 'caisse_type_id', e.target.value, isEdit)}>
                <option value="">{t('Type')}</option>
                {caisseTypes.map(ct => <option key={ct.id} value={ct.id}>{ct.name} ({(ct.tare || 0).toFixed(2)}kg)</option>)}
              </select>
              <input type="number" className="form-control form-control-sm" style={{ width: 70 }} value={c.caisse_count || ''}
                onChange={e => updateCaisse(i, ci, 'caisse_count', e.target.value === '' ? 0 : Number(e.target.value), isEdit)} min={0} />
              {tareStr && <small className="text-muted" style={{ minWidth: 52 }}>{tareStr}</small>}
              <button className="btn btn-sm btn-outline-danger py-0" onClick={() => removeCaisse(i, ci, isEdit)}>
                <i className="bi bi-x" />
              </button>
            </div>
          );
        })}
        <button className="btn btn-sm btn-outline-primary py-0 mt-1" onClick={() => addCaisse(i, isEdit)}>
          <i className="bi bi-plus" /> {t('Add caisse type')}
        </button>
      </td>
      <td>
        <button className="btn btn-sm btn-outline-danger py-0" onClick={() => removeItem(i, isEdit)} disabled={(isEdit ? editItems : items).length === 1}>
          <i className="bi bi-x" />
        </button>
      </td>
    </tr>
  );

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h4 className="mb-0"><i className="bi bi-receipt me-2" />{t('Invoices')}</h4>
        {user?.role !== 'collector' && activeTab === 'list' && <button className="btn btn-primary" onClick={openCreate}><i className="bi bi-plus-lg me-1" />{t('Create Invoice')}</button>}
      </div>

      <ul className="nav nav-tabs mb-3">
        <li className="nav-item">
          <button className={`nav-link ${activeTab === 'list' ? 'active' : ''}`} onClick={() => setActiveTab('list')}>
            <i className="bi bi-list-ul me-1" />{t('All Invoices')}
          </button>
        </li>
        <li className="nav-item">
          <button className={`nav-link ${activeTab === 'quick' ? 'active' : ''}`} onClick={() => { setActiveTab('quick'); loadProducts(); }}>
            <i className="bi bi-lightning me-1" />{t('Quick Invoice')}
          </button>
        </li>
      </ul>

      {activeTab === 'quick' ? (
        <div className="card border-0 shadow-sm">
          <div className="card-body">
            <h6 className="mb-3"><i className="bi bi-lightning-fill text-warning me-2" />{t('Quick Invoice — Single Item')}</h6>
            <div className="row g-3">
              <div className="col-md-6 position-relative">
                <label className="form-label">{t('Client')}</label>
                <input className="form-control" placeholder={t('Search client...')} value={quickClientSearch}
                  onChange={e => {
                    setQuickClientSearch(e.target.value);
                    const match = clients.find((c: any) => c.name.toLowerCase() === e.target.value.toLowerCase());
                    if (match) setQuickForm({ ...quickForm, client_id: match.id });
                    else setQuickForm({ ...quickForm, client_id: '' });
                  }} />
                {quickClientSearch && !quickForm.client_id && (
                  <div className="list-group position-absolute w-100" style={{ zIndex: 1050, maxHeight: 200, overflow: 'auto' }}>
                    {quickFilteredClients.slice(0, 20).map((c: any) => (
                      <button key={c.id} type="button" className="list-group-item list-group-item-action py-2"
                        onClick={() => { setQuickClientSearch(c.name); setQuickForm({ ...quickForm, client_id: c.id }); }}>
                        <div className="fw-medium">{c.name}</div>
                        <small className="text-muted">{c.phone || ''} {c.address ? `• ${c.address}` : ''}</small>
                      </button>
                    ))}
                    {quickFilteredClients.length === 0 && <div className="list-group-item text-muted small">{t('No clients found')}</div>}
                  </div>
                )}
                {quickForm.client_id && quickClientSearch && (
                  <span className="position-absolute" style={{ right: 10, top: 34 }}><i className="bi bi-check-circle text-success" /></span>
                )}
              </div>
              <div className="col-md-6">
                <label className="form-label">{t('Product')}</label>
                <select className="form-select" value={quickForm.product_id} onChange={e => setQuickForm({ ...quickForm, product_id: e.target.value })}>
                  <option value="">{t('Select product...')}</option>
                  {products.map((p: any) => <option key={p.id} value={p.id}>{p.name} — {Number(p.price).toFixed(2)}/kg</option>)}
                </select>
              </div>
              <div className="col-md-4">
                <label className="form-label">{t('Total Weight (kg)')}</label>
                <input type="number" step="0.5" min="0.1" className="form-control" value={quickForm.total_weight || ''}
                  onChange={e => setQuickForm({ ...quickForm, total_weight: e.target.value === '' ? 0 : Number(e.target.value) })} />
              </div>
              <div className="col-md-4">
                <label className="form-label">{t('Caisse Type')}</label>
                <select className="form-select" value={quickForm.caisse_type_id} onChange={e => setQuickForm({ ...quickForm, caisse_type_id: e.target.value })}>
                  <option value="">{t('None')}</option>
                  {caisseTypes.map((ct: any) => <option key={ct.id} value={ct.id}>{ct.name} ({(Number(ct.tare) || 0).toFixed(3)}kg)</option>)}
                </select>
              </div>
              <div className="col-md-2">
                <label className="form-label">{t('Caisse Qty')}</label>
                <input type="number" min="0" className="form-control" value={quickForm.caisse_count || ''}
                  onChange={e => setQuickForm({ ...quickForm, caisse_count: e.target.value === '' ? 0 : Number(e.target.value) })} />
              </div>
              <div className="col-md-2 d-flex align-items-end">
                <div className="form-check">
                  <input className="form-check-input" type="checkbox" id="notifyCollectors"
                    checked={quickForm.notify_collectors} onChange={e => setQuickForm({ ...quickForm, notify_collectors: e.target.checked })} />
                  <label className="form-check-label small" htmlFor="notifyCollectors">{t('Notify collectors')}</label>
                </div>
              </div>
            </div>

            <div className="row mt-4 g-3">
              <div className="col-md-3">
                <div className="card bg-light border-0">
                  <div className="card-body text-center py-3">
                    <small className="text-muted d-block">{t('Net Weight')}</small>
                    <strong className="fs-5">{quickNetWeight.toFixed(2)} kg</strong>
                  </div>
                </div>
              </div>
              <div className="col-md-3">
                <div className="card bg-light border-0">
                  <div className="card-body text-center py-3">
                    <small className="text-muted d-block">{t('Price')}</small>
                    <strong className="fs-5">{quickPrice.toFixed(2)}</strong>
                  </div>
                </div>
              </div>
              <div className="col-md-3">
                <div className="card bg-light border-0">
                  <div className="card-body text-center py-3">
                    <small className="text-muted d-block">{t('Due Amount')}</small>
                    <strong className={`fs-5 ${quickDue > 0 ? 'text-primary' : 'text-success'}`}>{quickDue.toFixed(2)}</strong>
                  </div>
                </div>
              </div>
              <div className="col-md-3 d-flex align-items-end">
                <button className="btn btn-primary w-100 py-2" onClick={submitQuickInvoice}
                  disabled={!quickForm.client_id || !quickForm.product_id || quickForm.total_weight <= 0}>
                  <i className="bi bi-send me-1" />{t('Create & Notify')}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
        <div className="card mb-3 border-0 shadow-sm">
        <div className="card-body py-3">
          <div className="d-flex gap-2 align-items-center flex-wrap">
            <div className="input-group" style={{ maxWidth: 360 }}>
              <span className="input-group-text bg-light border-end-0"><i className="bi bi-search" /></span>
              <input
                type="text"
                className="form-control border-start-0 ps-0"
                placeholder="Search client name or address..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              <button className="btn btn-primary" onClick={() => {}}>Search</button>
            </div>
            <button
              className={`btn ${showFilters ? 'btn-secondary' : 'btn-outline-secondary'}`}
              onClick={() => setShowFilters(!showFilters)}
            >
              <i className="bi bi-calendar3 me-1" />Date
              {hasActiveFilters && <span className="badge bg-danger ms-1">!</span>}
            </button>
            {hasActiveFilters && (
              <button className="btn btn-outline-danger btn-sm" onClick={resetFilters}>
                <i className="bi bi-x-circle me-1" />Clear
              </button>
            )}
            <span className="text-muted ms-auto small">
              Showing {filteredInvoices.length} of {invoices.length} invoices
            </span>
          </div>

          {showFilters && (
            <div className="border-top pt-3 mt-3">
              <div className="d-flex gap-2 align-items-end flex-wrap">
                <div style={{ minWidth: 150 }}>
                  <label className="form-label small text-muted mb-1">Date From</label>
                  <input type="date" className="form-control form-control-sm" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} />
                </div>
                <div style={{ minWidth: 150 }}>
                  <label className="form-label small text-muted mb-1">Date To</label>
                  <input type="date" className="form-control form-control-sm" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="card shadow-sm">
        <div className="card-body p-0">
          <div className="table-responsive">
          <table className="table table-hover mb-0">
            <thead>
              <tr>
                <th>#</th>
                <th>{t('Client')}</th>
                <th>{t('Total')}</th>
                <th>{t('Paid')}</th>
                <th>{t('Remaining')}</th>
                <th>{t('Status')}</th>
                <th>{t('Date')}</th>
                <th>{t('Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {pagedInvoices.map(inv => (
                <tr key={inv.id}>
                  <td>
                    <button className="btn btn-link p-0 text-decoration-none fw-semibold" onClick={() => openViewInvoice(inv)}>
                      {inv.invoice_number}
                    </button>
                    {inv.grouped_from && (
                      <span className="badge bg-info bg-opacity-25 text-info-emphasis ms-1 small" title={t('Grouped invoice')}>
                        <i className="bi bi-files" />
                      </span>
                    )}
                  </td>
                  <td>{inv.clients?.name}</td>
                  <td>{inv.total.toFixed(2)}</td>
                  <td>
                    {inv.paid_amount.toFixed(2)}
                    {inv.status === 'paid' && (
                      <span className="text-success ms-1 small">({new Date(inv.updated_at || inv.created_at).toLocaleDateString()} {t('paid')})</span>
                    )}
                  </td>
                  <td className={inv.remaining_amount > 0 ? 'text-danger' : ''}>{inv.remaining_amount.toFixed(2)}</td>
                  <td><span className={getBadge(inv.status)}>{t(inv.status)}</span></td>
                  <td><small>{new Date(inv.due_date || inv.created_at).toLocaleDateString()}</small></td>
                  <td>
                    <div className="btn-group btn-group-sm">
                      {inv.grouped_from && (
                        <button className="btn btn-outline-info" onClick={() => setGroupedInvoice(inv)} title={t('View source invoices')}>
                          <i className="bi bi-files" />
                        </button>
                      )}
                      <a href={api.invoices.pdf(inv.id)} target="_blank" className="btn btn-outline-secondary" title={t('PDF')}>
                        <i className="bi bi-filetype-pdf" />
                      </a>
                      <button className="btn btn-outline-success" onClick={() => whatsappShare(inv)} title={t('Share via WhatsApp')}>
                        <i className="bi bi-whatsapp" />
                      </button>
                      {user?.role !== 'collector' && (
                        <button className="btn btn-outline-primary" onClick={() => openEditModal(inv)} title={t('Edit')}>
                          <i className="bi bi-pencil" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!invoices.length && <tr><td colSpan={8} className="text-center text-muted py-4">{t('No invoices yet')}</td></tr>}
            </tbody>
          </table>
          </div>
          <Pagination total={filteredInvoices.length} page={page} pageSize={PAGE_SIZE} onPageChange={setPage} />
        </div>
      </div>
        </>
      )}

      {showCreate && (
        <div className="modal d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-xl">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{t('Create Invoice')}</h5>
                <button className="btn-close" onClick={() => setShowCreate(false)} />
              </div>
              <div className="modal-body">
                <div className="mb-3 position-relative">
                  <label className="form-label">{t('Client')}</label>
                  <input className="form-control" placeholder={t('Search or type client name...')} value={clientSearch}
                    onChange={e => {
                      setClientSearch(e.target.value);
                      const match = clients.find(c => c.name.toLowerCase() === e.target.value.toLowerCase());
                      if (match) setForm({ ...form, client_id: match.id });
                      else setForm({ ...form, client_id: '' });
                    }} />
                  {clientSearch && !form.client_id && (
                    <div className="list-group position-absolute w-100" style={{ zIndex: 1050, maxHeight: 200, overflow: 'auto' }}>
                      {clients.filter(c => c.name.toLowerCase().includes(clientSearch.toLowerCase())).slice(0, 20).map(c => (
                        <button key={c.id} type="button" className="list-group-item list-group-item-action py-2"
                          onClick={() => { setClientSearch(c.name); setForm({ ...form, client_id: c.id }); }}>
                          <div className="fw-medium">{c.name}</div>
                          <small className="text-muted">{c.phone || ''} {c.address ? `• ${c.address}` : ''}</small>
                        </button>
                      ))}
                      {clients.filter(c => c.name.toLowerCase().includes(clientSearch.toLowerCase())).length === 0 && (
                        <div className="list-group-item text-muted small">{t('No clients found')}</div>
                      )}
                    </div>
                  )}
                  {form.client_id && clientSearch && (
                    <span className="position-absolute" style={{ right: 10, top: 34 }}><i className="bi bi-check-circle text-success" /></span>
                  )}
                </div>
                <div className="mb-3">
                  <label className="form-label">{t('Due Date')}</label>
                  <input type="date" className="form-control" value={form.due_date} onChange={e => {
                    setForm({ ...form, due_date: e.target.value });
                    loadProducts(e.target.value || undefined);
                  }} />
                </div>
                <div className="mb-3">
                  <label className="form-label">{t('Notes')}</label>
                  <textarea className="form-control" rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
                </div>

                <h6>{t('Items')}</h6>
                <div className="table-responsive">
                  <table className="table table-sm mb-2">
                    <thead>
                      <tr>
                        <th style={{ width: '16%' }}>{t('Product')}</th>
                        <th style={{ width: '5%' }}>{t('Count')}</th>
                        <th style={{ width: '8%' }}>{t('Total Weight')}</th>
                        <th style={{ width: '7%' }}>{t('Net Weight')}</th>
                        <th style={{ width: '8%' }}>{t('Price')}</th>
                        <th style={{ width: '8%' }}>{t('Amount')}</th>
                        <th style={{ width: '40%' }}>{t('Caisses')}</th>
                        <th style={{ width: '4%' }}></th>
                      </tr>
                    </thead>
                    <tbody>{items.map((item, i) => renderItemRow(item, i))}</tbody>
                  </table>
                </div>
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <button className="btn btn-sm btn-outline-primary" onClick={() => addItem()}>
                    <i className="bi bi-plus me-1" />{t('Add Item')}
                  </button>
                  <h5 className="mb-0">{t('Total')}: {invoiceTotal(items).toFixed(2)}</h5>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>{t('Cancel')}</button>
                <button className="btn btn-primary" onClick={createInvoice} disabled={!form.client_id || !items[0]?.product_id}>
                  {t('Create Invoice')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showEdit && (
        <div className="modal d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-xl">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{t('Edit Invoice')}</h5>
                <button className="btn-close" onClick={() => setShowEdit(null)} />
              </div>
              <div className="modal-body">
                <div className="mb-3 position-relative">
                  <label className="form-label">{t('Client')}</label>
                  <input className="form-control" placeholder={t('Search or type client name...')} value={editClientSearch}
                    onChange={e => {
                      setEditClientSearch(e.target.value);
                      const match = clients.find(c => c.name.toLowerCase() === e.target.value.toLowerCase());
                      if (match) setEditForm({ ...editForm, client_id: match.id });
                      else setEditForm({ ...editForm, client_id: '' });
                    }} />
                  {editClientSearch && !editForm.client_id && (
                    <div className="list-group position-absolute w-100" style={{ zIndex: 1050, maxHeight: 200, overflow: 'auto' }}>
                      {clients.filter(c => c.name.toLowerCase().includes(editClientSearch.toLowerCase())).slice(0, 20).map(c => (
                        <button key={c.id} type="button" className="list-group-item list-group-item-action py-2"
                          onClick={() => { setEditClientSearch(c.name); setEditForm({ ...editForm, client_id: c.id }); }}>
                          <div className="fw-medium">{c.name}</div>
                          <small className="text-muted">{c.phone || ''} {c.address ? `• ${c.address}` : ''}</small>
                        </button>
                      ))}
                      {clients.filter(c => c.name.toLowerCase().includes(editClientSearch.toLowerCase())).length === 0 && (
                        <div className="list-group-item text-muted small">{t('No clients found')}</div>
                      )}
                    </div>
                  )}
                  {editForm.client_id && editClientSearch && (
                    <span className="position-absolute" style={{ right: 10, top: 34 }}><i className="bi bi-check-circle text-success" /></span>
                  )}
                </div>
                <div className="mb-3">
                  <label className="form-label">{t('Due Date')}</label>
                  <input type="date" className="form-control" value={editForm.due_date} onChange={e => setEditForm({ ...editForm, due_date: e.target.value })} />
                </div>
                <div className="mb-3">
                  <label className="form-label">{t('Notes')}</label>
                  <textarea className="form-control" rows={2} value={editForm.notes} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} />
                </div>

                <h6>{t('Items')}</h6>
                <div className="table-responsive">
                  <table className="table table-sm mb-2">
                    <thead>
                      <tr>
                        <th style={{ width: '16%' }}>{t('Product')}</th>
                        <th style={{ width: '5%' }}>{t('Count')}</th>
                        <th style={{ width: '8%' }}>{t('Total Weight')}</th>
                        <th style={{ width: '7%' }}>{t('Net Weight')}</th>
                        <th style={{ width: '8%' }}>{t('Price')}</th>
                        <th style={{ width: '8%' }}>{t('Amount')}</th>
                        <th style={{ width: '40%' }}>{t('Caisses')}</th>
                        <th style={{ width: '4%' }}></th>
                      </tr>
                    </thead>
                    <tbody>{editItems.map((item, i) => renderItemRow(item, i, true))}</tbody>
                  </table>
                </div>
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <button className="btn btn-sm btn-outline-primary" onClick={() => addItem(true)}>
                    <i className="bi bi-plus me-1" />{t('Add Item')}
                  </button>
                  <h5 className="mb-0">{t('Total')}: {invoiceTotal(editItems).toFixed(2)}</h5>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowEdit(null)}>{t('Cancel')}</button>
                <button className="btn btn-primary" onClick={saveEdit} disabled={!editForm.client_id || !editItems[0]?.product_id}>
                  {t('Save Changes')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {groupedInvoice && (
        <div className="modal d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  <i className="bi bi-files me-2" />{t('Source Invoices')}
                  <span className="badge bg-info bg-opacity-25 text-info-emphasis ms-2">{groupedInvoice.invoice_number}</span>
                </h5>
                <button className="btn-close" onClick={() => setGroupedInvoice(null)} />
              </div>
              <div className="modal-body">
                <p className="text-muted small mb-3">{t('This invoice was created by grouping the following invoices')}:</p>
                <table className="table table-sm mb-3">
                  <thead>
                    <tr>
                      <th>{t('Invoice')}</th>
                      <th className="text-end">{t('Remaining')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(groupedInvoice.grouped_from || []).map((g: any, i: number) => (
                      <tr key={i}>
                        <td>{g.invoice_number}</td>
                        <td className="text-end fw-bold">{Number(g.remaining_amount).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="table-primary fw-bold">
                      <td>{t('Total')}</td>
                      <td className="text-end">{groupedInvoice.total.toFixed(2)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setGroupedInvoice(null)}>{t('Close')}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {viewInvoice && (
        <div className="modal d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg modal-dialog-scrollable">
            <div className="modal-content">
              <div className="modal-header">
                <div>
                  <h5 className="modal-title">{t('Invoice')} {viewInvoice.invoice_number}</h5>
                  <small className="text-muted">
                    {viewInvoice.clients?.name} • {new Date(viewInvoice.created_at).toLocaleDateString()}
                    {viewInvoice.due_date ? ` • ${t('Due')}: ${viewInvoice.due_date}` : ''}
                  </small>
                </div>
                <button className="btn-close" onClick={() => setViewInvoice(null)} />
              </div>
              <div className="modal-body">
                {viewLoading ? (
                  <div className="text-center py-4"><div className="spinner-border" /></div>
                ) : (
                  <>
                    <div className="row mb-3 g-3">
                      <div className="col-md-4">
                        <div className="card bg-light border-0">
                          <div className="card-body text-center py-2">
                            <small className="text-muted d-block">{t('Total')}</small>
                            <strong className="fs-5">{viewInvoice.total?.toFixed(2)}</strong>
                          </div>
                        </div>
                      </div>
                      <div className="col-md-4">
                        <div className="card bg-light border-0">
                          <div className="card-body text-center py-2">
                            <small className="text-muted d-block">{t('Paid')}</small>
                            <strong className="fs-5 text-success">{viewInvoice.paid_amount?.toFixed(2)}</strong>
                          </div>
                        </div>
                      </div>
                      <div className="col-md-4">
                        <div className="card bg-light border-0">
                          <div className="card-body text-center py-2">
                            <small className="text-muted d-block">{t('Remaining')}</small>
                            <strong className={`fs-5 ${viewInvoice.remaining_amount > 0 ? 'text-danger' : 'text-success'}`}>{viewInvoice.remaining_amount?.toFixed(2)}</strong>
                          </div>
                        </div>
                      </div>
                    </div>
                    <table className="table table-sm table-hover">
                      <thead>
                        <tr>
                          <th>{t('Product')}</th>
                          <th className="text-center">{t('Caisses')}</th>
                          <th className="text-end">{t('Weight')}</th>
                          <th className="text-end">{t('Price')}</th>
                          <th className="text-end">{t('Amount')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {viewItems.map((item: any) => {
                          const rawCaisses = item.caisses;
                          const caissesArr = Array.isArray(rawCaisses) ? rawCaisses : (typeof rawCaisses === 'string' ? JSON.parse(rawCaisses) : []);
                          const totalCaisses = caissesArr.reduce((s: number, c: any) => s + (c.caisse_count || 0), 0);
                          const netWeight = item.quantity || (item.total_weight - caissesArr.reduce((s: number, c: any) => s + (c.caisse_count || 0) * (c.tare || 0), 0));
                          return (
                            <tr key={item.id}>
                              <td>{item.products?.name || item.product_id}</td>
                              <td className="text-center">
                                {totalCaisses > 0 ? (
                                  <span className="badge bg-info bg-opacity-25 text-info-emphasis">{totalCaisses}</span>
                                ) : '-'}
                              </td>
                              <td className="text-end">{netWeight.toFixed(2)} kg</td>
                              <td className="text-end">{item.price?.toFixed(2)}</td>
                              <td className="text-end fw-bold">{((item.subtotal || netWeight * item.price) || 0).toFixed(2)}</td>
                            </tr>
                          );
                        })}
                        {!viewItems.length && <tr><td colSpan={5} className="text-center text-muted">{t('No items')}</td></tr>}
                      </tbody>
                    </table>
                    {viewInvoice.notes && (
                      <div className="mt-3 p-2 bg-light rounded small">
                        <strong>{t('Notes')}:</strong> {viewInvoice.notes}
                      </div>
                    )}
                  </>
                )}
              </div>
              <div className="modal-footer">
                <a href={api.invoices.pdf(viewInvoice.id)} target="_blank" className="btn btn-outline-secondary btn-sm"><i className="bi bi-filetype-pdf me-1" />{t('PDF')}</a>
                <button className="btn btn-secondary" onClick={() => setViewInvoice(null)}>{t('Close')}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
