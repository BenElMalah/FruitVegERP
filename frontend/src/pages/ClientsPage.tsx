import { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import type { Client } from '../types';
import { useTranslation } from 'react-i18next';

export default function ClientsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [clients, setClients] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [edit, setEdit] = useState<Client | null>(null);
  const [form, setForm] = useState({ name: '', phone: '', address: '', credit_limit: 0, notes: '' });
  const [error, setError] = useState('');
  const [dupCount, setDupCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 100;
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterCaissesMin, setFilterCaissesMin] = useState('');
  const [filterCaissesMax, setFilterCaissesMax] = useState('');
  const [filterDueMin, setFilterDueMin] = useState('');
  const [filterDueMax, setFilterDueMax] = useState('');
  const [showDueColumn, setShowDueColumn] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);

  const [viewClient, setViewClient] = useState<any>(null);
  const [viewTab, setViewTab] = useState<'invoices' | 'payments' | 'caisses'>('invoices');
  const [viewInvoices, setViewInvoices] = useState<any[]>([]);
  const [viewPayments, setViewPayments] = useState<any[]>([]);
  const [viewCaisse, setViewCaisse] = useState<any[]>([]);
  const [viewLoading, setViewLoading] = useState(false);

  const canEdit = user?.role === 'boss' || user?.role === 'manager';

  const load = async () => {
    const [list, dups] = await Promise.all([
      api.clients.list(),
      api.clients.duplicates().catch(() => []),
    ]);
    setClients(list);
    setDupCount(dups.length);
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => { setEdit(null); setForm({ name: '', phone: '', address: '', credit_limit: 0, notes: '' }); setError(''); setShowModal(true); };
  const openEdit = (c: Client) => { setEdit(c); setForm({ name: c.name, phone: c.phone || '', address: c.address || '', credit_limit: c.credit_limit, notes: c.notes || '' }); setError(''); setShowModal(true); };

  const save = async () => {
    try {
      setError('');
      if (edit) await api.clients.update(edit.id, form);
      else await api.clients.create(form);
      setShowModal(false);
      load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const remove = async (id: string) => {
    if (confirm(t('Delete this client?'))) {
      await api.clients.delete(id);
      load();
    }
  };

  const handleMerge = async () => {
    if (!confirm(t('Merge all duplicate clients? Duplicates will be deleted and their data reassigned.'))) return;
    await api.clients.merge();
    load();
  };

  const openViewClient = async (c: any) => {
    setViewClient(c);
    setViewTab('invoices');
    setViewLoading(true);
    try {
      const [invoices, payments, caisse] = await Promise.all([
        api.clients.invoices(c.id),
        api.clients.payments(c.id),
        api.clients.caisseBalance(c.id),
      ]);
      setViewInvoices(invoices);
      setViewPayments(payments);
      setViewCaisse(caisse);
    } catch {}
    setViewLoading(false);
  };

  const whatsappReminder = () => {
    if (!viewClient?.phone) return;
    const unpaid = viewInvoices.filter((i: any) => i.status !== 'paid');
    const totalDue = unpaid.reduce((s: number, i: any) => s + Number(i.remaining_amount || 0), 0);
    const lines = [
      `┌─────────────────────────────┐`,
      `│    💰 PAYMENT REMINDER      │`,
      `└─────────────────────────────┘`,
      ``,
      `Hello ${viewClient.name},`,
      ``,
      `This is a friendly reminder about your`,
      `outstanding balance:`,
      ``,
      `📋 *${unpaid.length} unpaid invoice${unpaid.length !== 1 ? 's' : ''}*`,
      `💰 *Total due: ${totalDue.toFixed(2)}*`,
      ``,
    ];
    if (unpaid.length > 0) {
      lines.push(`┌── Breakdown ────────────────┐`);
      unpaid.forEach((inv: any) => {
        lines.push(`│ #${inv.invoice_number.padEnd(8)} ${Number(inv.remaining_amount).toFixed(2).padStart(10)}`);
      });
      lines.push(`└─────────────────────────────┘`);
      lines.push(``);
    }
    lines.push(`Please arrange payment at your`);
    lines.push(`earliest convenience.`);
    lines.push(``);
    lines.push(`Thank you! 🙏`);
    const phone = viewClient.phone.replace(/[^0-9]/g, '');
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(lines.join('\n'))}`, '_blank');
  };

  const whatsappFullReport = () => {
    if (!viewClient?.phone) return;
    const totalInvoiced = viewInvoices.reduce((s: number, i: any) => s + Number(i.total || 0), 0);
    const totalPaid = viewInvoices.reduce((s: number, i: any) => s + Number(i.paid_amount || 0), 0);
    const totalRemaining = viewInvoices.reduce((s: number, i: any) => s + Number(i.remaining_amount || 0), 0);

    const lines = [
      `┌─────────────────────────────┐`,
      `│   📊 ACCOUNT STATEMENT      │`,
      `└─────────────────────────────┘`,
      ``,
      `👤 *${viewClient.name}*`,
      `📅 ${new Date().toLocaleDateString()}`,
      ``,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `         💼 INVOICES`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ``,
    ];

    viewInvoices.forEach((inv: any) => {
      const icon = inv.status === 'paid' ? '✅' : '⚠️';
      const status = inv.status === 'paid' ? 'PAID' : inv.status.toUpperCase();
      lines.push(`${icon} #${inv.invoice_number}    ${Number(inv.total).toFixed(2).padStart(10)}`);
      lines.push(`   Status: ${status}`);
      if (inv.status !== 'paid') {
        lines.push(`   Remaining: ${Number(inv.remaining_amount).toFixed(2)}`);
      }
      lines.push(``);
    });

    lines.push(`┌─────────────────────────────┐`);
    lines.push(`│ Total:     ${totalInvoiced.toFixed(2).padStart(10)}     │`);
    lines.push(`│ Paid:      ${totalPaid.toFixed(2).padStart(10)}     │`);
    lines.push(`│ Remaining: ${totalRemaining.toFixed(2).padStart(10)}     │`);
    lines.push(`└─────────────────────────────┘`);
    lines.push(``);

    if (viewPayments.length > 0) {
      lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      lines.push(`         💳 PAYMENTS`);
      lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      lines.push(``);
      viewPayments.forEach((p: any) => {
        const method = (p.payment_method || '').replace('_', ' ').toUpperCase();
        lines.push(`✅ ${Number(p.amount).toFixed(2).padStart(10)}  ${method}`);
        lines.push(`   📅 ${new Date(p.created_at).toLocaleDateString()}`);
        lines.push(``);
      });
    }

    if (viewCaisse.length > 0) {
      lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      lines.push(`         📦 CAISSE BALANCE`);
      lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      lines.push(``);
      viewCaisse.forEach((row: any) => {
        const out = row.total_out || 0;
        const ret = row.total_returned || 0;
        const missing = out - ret;
        lines.push(`📦 ${row.caisse_name}`);
        lines.push(`   Out: ${out}  |  Returned: ${ret}  |  Missing: ${missing}`);
      });
      lines.push(``);
    }

    lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    lines.push(`Thank you for your business! 🤝`);

    const phone = viewClient.phone.replace(/[^0-9]/g, '');
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(lines.join('\n'))}`, '_blank');
  };

  const filteredClients = useMemo(() => {
    let result = clients;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(c =>
        c.name.toLowerCase().includes(q) ||
        (c.phone && c.phone.includes(q)) ||
        (c.address && c.address.toLowerCase().includes(q))
      );
    }
    if (filterDateFrom) result = result.filter(c => c.created_at && c.created_at >= filterDateFrom);
    if (filterDateTo) result = result.filter(c => c.created_at && c.created_at <= filterDateTo + 'T23:59:59');
    if (filterCaissesMin !== '') result = result.filter(c => (c.total_caisses || 0) >= Number(filterCaissesMin));
    if (filterCaissesMax !== '') result = result.filter(c => (c.total_caisses || 0) <= Number(filterCaissesMax));
    if (filterDueMin !== '') result = result.filter(c => (c.total_due || 0) >= Number(filterDueMin));
    if (filterDueMax !== '') result = result.filter(c => (c.total_due || 0) <= Number(filterDueMax));
    return result;
  }, [clients, searchQuery, filterDateFrom, filterDateTo, filterCaissesMin, filterCaissesMax, filterDueMin, filterDueMax]);

  const totalPages = Math.max(1, Math.ceil(filteredClients.length / rowsPerPage));
  const paginatedClients = filteredClients.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  const resetFilters = () => {
    setSearchQuery('');
    setFilterDateFrom('');
    setFilterDateTo('');
    setFilterCaissesMin('');
    setFilterCaissesMax('');
    setFilterDueMin('');
    setFilterDueMax('');
    setCurrentPage(1);
  };
  const hasActiveFilters = searchQuery || filterDateFrom || filterDateTo || filterCaissesMin || filterCaissesMax || filterDueMin || filterDueMax;

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h4 className="mb-0"><i className="bi bi-people me-2" />{t('Clients')}</h4>
        <div className="d-flex gap-2">
          {dupCount > 0 && user?.role === 'boss' && (
            <button className="btn btn-outline-warning btn-sm" onClick={handleMerge}>
              <i className="bi bi-shuffle me-1" />{t('Merge Duplicates')} ({dupCount})
            </button>
          )}
          {canEdit && <button className="btn btn-primary" onClick={openCreate}><i className="bi bi-plus-lg me-1" />{t('Add Client')}</button>}
        </div>
      </div>

      <div className="card mb-3 border-0 shadow-sm">
        <div className="card-body py-3">
          <div className="d-flex gap-2 align-items-center flex-wrap">
            <div className="input-group position-relative" style={{ maxWidth: 380 }}>
              <span className="input-group-text bg-light border-end-0"><i className="bi bi-search" /></span>
              <input
                type="text"
                className="form-control border-start-0 ps-0"
                placeholder="Search by name, phone, address..."
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); setShowSearchDropdown(true); }}
                onFocus={() => setShowSearchDropdown(true)}
                onBlur={() => setTimeout(() => setShowSearchDropdown(false), 200)}
              />
              <button className="btn btn-primary" onClick={() => { setCurrentPage(1); setShowSearchDropdown(false); }}>Search</button>
              {showSearchDropdown && searchQuery && (
                <div className="list-group position-absolute w-100" style={{ zIndex: 1050, maxHeight: 240, overflow: 'auto', top: '100%' }}>
                  {clients.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 20).map(c => (
                    <button key={c.id} type="button" className="list-group-item list-group-item-action py-2"
                      onMouseDown={() => { openViewClient(c); setShowSearchDropdown(false); }}>
                      <div className="fw-medium">{c.name}</div>
                      <small className="text-muted">{c.phone || ''} {c.address ? `• ${c.address}` : ''}</small>
                    </button>
                  ))}
                  {clients.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                    <div className="list-group-item text-muted small">{t('No clients found')}</div>
                  )}
                </div>
              )}
            </div>
            <button
              className={`btn ${showFilters ? 'btn-secondary' : 'btn-outline-secondary'}`}
              onClick={() => setShowFilters(!showFilters)}
            >
              <i className="bi bi-funnel me-1" />Filters
              {hasActiveFilters && <span className="badge bg-danger ms-1">!</span>}
            </button>
            {hasActiveFilters && (
              <button className="btn btn-outline-danger btn-sm" onClick={resetFilters}>
                <i className="bi bi-x-circle me-1" />Clear
              </button>
            )}
            <button
              className={`btn btn-sm ${showDueColumn ? 'btn-secondary' : 'btn-outline-secondary'}`}
              onClick={() => setShowDueColumn(!showDueColumn)}
              title={showDueColumn ? 'Hide Due column' : 'Show Due column'}
            >
              <i className={`bi bi-eye${showDueColumn ? '' : '-slash'} me-1`} />
              Due
            </button>
            <span className="text-muted ms-auto small">
              Showing {paginatedClients.length} of {filteredClients.length} clients
            </span>
          </div>

          {showFilters && (
            <div className="border-top pt-3 mt-3">
              <div className="filter-bar d-flex gap-2 align-items-end flex-wrap">
                <div style={{ minWidth: 150 }}>
                  <label className="form-label small text-muted mb-1">Date From</label>
                  <input type="date" className="form-control form-control-sm" value={filterDateFrom} onChange={e => { setFilterDateFrom(e.target.value); setCurrentPage(1); }} />
                </div>
                <div style={{ minWidth: 150 }}>
                  <label className="form-label small text-muted mb-1">Date To</label>
                  <input type="date" className="form-control form-control-sm" value={filterDateTo} onChange={e => { setFilterDateTo(e.target.value); setCurrentPage(1); }} />
                </div>
                <div style={{ minWidth: 90 }}>
                  <label className="form-label small text-muted mb-1">Caisses Min</label>
                  <input type="number" className="form-control form-control-sm" placeholder="Min" value={filterCaissesMin} onChange={e => { setFilterCaissesMin(e.target.value); setCurrentPage(1); }} />
                </div>
                <div style={{ minWidth: 90 }}>
                  <label className="form-label small text-muted mb-1">Caisses Max</label>
                  <input type="number" className="form-control form-control-sm" placeholder="Max" value={filterCaissesMax} onChange={e => { setFilterCaissesMax(e.target.value); setCurrentPage(1); }} />
                </div>
                <div style={{ minWidth: 90 }}>
                  <label className="form-label small text-muted mb-1">Due Min</label>
                  <input type="number" className="form-control form-control-sm" placeholder="Min" value={filterDueMin} onChange={e => { setFilterDueMin(e.target.value); setCurrentPage(1); }} />
                </div>
                <div style={{ minWidth: 90 }}>
                  <label className="form-label small text-muted mb-1">Due Max</label>
                  <input type="number" className="form-control form-control-sm" placeholder="Max" value={filterDueMax} onChange={e => { setFilterDueMax(e.target.value); setCurrentPage(1); }} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="card shadow-sm">
        <div className="card-body p-0">
          <div className="table-responsive">
          <table className="table table-hover table-modern mb-0">
            <thead className="table-light">
              <tr>
                <th style={{ width: 50 }}>#</th>
                <th>{t('Name')}</th>
                <th>{t('Phone')}</th>
                <th>{t('Address')}</th>
                <th className="text-end">{t('Caisses')}</th>
                {showDueColumn && <th className="text-end">{t('Due')}</th>}
                <th style={{ width: 100 }}>{t('Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {paginatedClients.map((c, i) => (
                <tr key={c.id}>
                  <td className="text-muted small">{(currentPage - 1) * rowsPerPage + i + 1}</td>
                  <td><button className="btn btn-link p-0 text-primary fw-semibold text-decoration-none" onClick={() => openViewClient(c)}>{c.name}</button></td>
                  <td>{c.phone || <span className="text-muted">-</span>}</td>
                  <td><small>{c.address || '-'}</small></td>
                  <td className="text-end"><span className="badge bg-info bg-opacity-25 text-info-emphasis">{c.total_caisses || 0}</span></td>
                  {showDueColumn && (
                    <td className="text-end">
                      <span className={`fw-semibold ${(c.total_due || 0) > 0 ? 'text-danger' : 'text-success'}`}>
                        {(c.total_due || 0) > 0 ? '****' : '0.00'}
                      </span>
                      <button
                        className="btn btn-link btn-sm p-0 ms-1"
                        onClick={(e) => { e.stopPropagation(); c._revealDue = !c._revealDue; }}
                        title={c._revealDue ? 'Hide' : 'Reveal'}
                      >
                        <i className={`bi bi-eye${c._revealDue ? '' : '-slash'} text-muted`} style={{ fontSize: '0.75rem' }} />
                      </button>
                      {c._revealDue && (
                        <span className={`fw-semibold ${(c.total_due || 0) > 0 ? 'text-danger' : 'text-success'} ms-2`}>
                          {(c.total_due || 0).toFixed(2)}
                        </span>
                      )}
                    </td>
                  )}
                  <td>
                    <div className="d-flex gap-1">
                      <button className="btn btn-sm btn-outline-primary" onClick={() => openEdit(c)} disabled={!canEdit} title="Edit">
                        <i className="bi bi-pencil" />
                      </button>
                      <button className="btn btn-sm btn-outline-danger" onClick={() => remove(c.id)} disabled={user?.role !== 'boss'} title="Delete">
                        <i className="bi bi-trash" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!paginatedClients.length && (
                <tr>
                  <td colSpan={showDueColumn ? 7 : 6} className="text-center text-muted py-5">
                    <i className="bi bi-inbox display-6 d-block mb-2 opacity-50" />
                    No clients found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        </div>
      </div>

      {totalPages > 1 && (
        <nav className="mt-3 d-flex justify-content-center">
          <ul className="pagination pagination-modern mb-0">
            <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
              <button className="page-link" onClick={() => setCurrentPage(p => p - 1)}><i className="bi bi-chevron-left" /></button>
            </li>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <li key={page} className={`page-item ${currentPage === page ? 'active' : ''}`}>
                <button className="page-link" onClick={() => setCurrentPage(page)}>{page}</button>
              </li>
            ))}
            <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
              <button className="page-link" onClick={() => setCurrentPage(p => p + 1)}><i className="bi bi-chevron-right" /></button>
            </li>
          </ul>
        </nav>
      )}

      {showModal && (
        <div className="modal d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{edit ? t('Edit Client') : t('Add Client')}</h5>
                <button className="btn-close" onClick={() => setShowModal(false)} />
              </div>
              <div className="modal-body">
                {error && <div className="alert alert-danger py-2">{error}</div>}
                <div className="mb-3">
                  <label className="form-label">{t('Name')}</label>
                  <input className="form-control" value={form.name} onChange={e => { setForm({ ...form, name: e.target.value }); setError(''); }} />
                </div>
                <div className="mb-3">
                  <label className="form-label">{t('Phone')}</label>
                  <input className="form-control" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div className="mb-3">
                  <label className="form-label">{t('Address')}</label>
                  <input className="form-control" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
                </div>
                <div className="mb-3">
                  <label className="form-label">{t('Credit Limit')}</label>
                  <input type="number" className="form-control" value={form.credit_limit || ''} onChange={e => setForm({ ...form, credit_limit: e.target.value === '' ? 0 : Number(e.target.value) })} />
                </div>
                <div className="mb-3">
                  <label className="form-label">{t('Notes')}</label>
                  <textarea className="form-control" rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
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

      {viewClient && (
        <div className="modal d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-xl modal-dialog-scrollable">
            <div className="modal-content">
              <div className="modal-header">
                <div>
                  <h5 className="modal-title">{viewClient.name}</h5>
                  <small className="text-muted">{viewClient.phone || ''} {viewClient.address ? `• ${viewClient.address}` : ''}</small>
                </div>
                <div className="d-flex gap-2 align-items-center">
                  {viewClient.phone && (
                    <>
                      <button className="btn btn-outline-warning btn-sm" onClick={whatsappReminder} title={t('Send payment reminder via WhatsApp')}>
                        <i className="bi bi-whatsapp me-1" />{t('Reminder')}
                      </button>
                      <button className="btn btn-outline-success btn-sm" onClick={whatsappFullReport} title={t('Send full report via WhatsApp')}>
                        <i className="bi bi-whatsapp me-1" />{t('Full Report')}
                      </button>
                    </>
                  )}
                  <button className="btn-close" onClick={() => setViewClient(null)} />
                </div>
              </div>
              <div className="modal-body">
                <ul className="nav nav-tabs mb-3">
                  <li className="nav-item">
                    <button className={`nav-link ${viewTab === 'invoices' ? 'active' : ''}`} onClick={() => setViewTab('invoices')}>
                      {t('Invoices')} <span className="badge bg-primary ms-1">{viewInvoices.length}</span>
                    </button>
                  </li>
                  <li className="nav-item">
                    <button className={`nav-link ${viewTab === 'payments' ? 'active' : ''}`} onClick={() => setViewTab('payments')}>
                      {t('Payments')} <span className="badge bg-success ms-1">{viewPayments.length}</span>
                    </button>
                  </li>
                  <li className="nav-item">
                    <button className={`nav-link ${viewTab === 'caisses' ? 'active' : ''}`} onClick={() => setViewTab('caisses')}>
                      {t('Caisse Balance')}
                    </button>
                  </li>
                </ul>

                {viewLoading && <div className="text-center py-4"><div className="spinner-border" /></div>}

                {!viewLoading && viewTab === 'invoices' && (
                  <div className="table-responsive">
                  <table className="table table-sm table-hover">
                    <thead><tr><th>#</th><th>{t('Total')}</th><th>{t('Paid')}</th><th>{t('Remaining')}</th><th>{t('Status')}</th><th>{t('Date')}</th></tr></thead>
                    <tbody>
                      {viewInvoices.map(inv => (
                        <tr key={inv.id}>
                          <td>{inv.invoice_number}</td>
                          <td>{inv.total?.toFixed(2)}</td>
                          <td>{inv.paid_amount?.toFixed(2)}</td>
                          <td className={inv.remaining_amount > 0 ? 'text-danger' : ''}>{inv.remaining_amount?.toFixed(2)}</td>
                          <td><span className={`badge ${inv.status === 'paid' ? 'bg-success' : inv.status === 'partial' ? 'bg-warning' : 'bg-danger'}`}>{t(inv.status)}</span></td>
                          <td><small>{new Date(inv.created_at).toLocaleDateString()}</small></td>
                        </tr>
                      ))}
                      {!viewInvoices.length && <tr><td colSpan={6} className="text-center text-muted">{t('No invoices')}</td></tr>}
                    </tbody>
                  </table>
                  </div>
                )}

                {!viewLoading && viewTab === 'payments' && (
                  <div className="table-responsive">
                  <table className="table table-sm table-hover">
                        <thead><tr><th>{t('Invoice')}</th><th>{t('Amount')}</th><th>{t('Method')}</th><th>{t('Date')}</th><th>{t('Notes')}</th></tr></thead>
                    <tbody>
                      {viewPayments.map(p => {
                        const inv = viewInvoices.find((i: any) => i.id === p.invoice_id);
                        const isPaid = inv && (inv.remaining_amount || 0) <= 0;
                        return (
                          <tr key={p.id}>
                            <td><small>{inv?.invoice_number || '-'}</small></td>
                            <td className="text-success fw-semibold">
                              {p.amount?.toFixed(2)}
                              {isPaid && inv?.due_date && (
                                <span className="text-muted ms-1 small">({new Date(inv.due_date).toLocaleDateString()})</span>
                              )}
                            </td>
                            <td>{(p.payment_method || '').replace('_', ' ')}</td>
                            <td><small>{(p as any).lcn_date || new Date(p.created_at).toLocaleDateString()}</small></td>
                            <td><small className="text-muted">{p.notes || '-'}</small></td>
                          </tr>
                        );
                      })}
                      {!viewPayments.length && <tr><td colSpan={5} className="text-center text-muted">{t('No payments')}</td></tr>}
                    </tbody>
                  </table>
                  </div>
                )}

                {!viewLoading && viewTab === 'caisses' && (
                  <>
                    {viewCaisse.length > 0 ? (
                      <div className="table-responsive">
                      <table className="table table-sm table-hover">
                        <thead><tr><th>{t('Caisse Type')}</th><th>{t('Category')}</th><th className="text-end">{t('Out')}</th><th className="text-end">{t('Returned')}</th><th className="text-end">{t('Missing')}</th></tr></thead>
                        <tbody>
                          {viewCaisse.map((row: any) => {
                            const out = row.total_out || 0;
                            const returned = row.total_returned || 0;
                            const missing = out - returned;
                            return (
                              <tr key={row.caisse_type_id}>
                                <td>{row.caisse_name}</td>
                                <td><span className="badge bg-light text-dark">{row.category}</span></td>
                                <td className="text-end">{out}</td>
                                <td className="text-end">{returned}</td>
                                <td className={`text-end fw-semibold ${missing > 0 ? 'text-danger' : 'text-success'}`}>{missing}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      </div>
                    ) : (
                      <div className="text-center text-muted py-4">{t('No caisse data')}</div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
