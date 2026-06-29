import { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from 'react-i18next';
import Pagination from '../components/Pagination';
import type { CaisseType, CaisseMovement } from '../types';

const PAGE_SIZE = 50;

export default function CaissePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [tab, setTab] = useState<'types' | 'movements' | 'missing'>('movements');
  const [types, setTypes] = useState<CaisseType[]>([]);
  const [movements, setMovements] = useState<CaisseMovement[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [missing, setMissing] = useState<any[]>([]);
  const [filterType, setFilterType] = useState('');
  const [searchClient, setSearchClient] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterMinQty, setFilterMinQty] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [editTypeId, setEditTypeId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [clientSearch, setClientSearch] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [page, setPage] = useState(1);

  const [movementForm, setMovementForm] = useState({
    client_id: '', caisse_type_id: '', quantity: 1, movement_type: 'out' as const, notes: ''
  });
  const [typeForm, setTypeForm] = useState<{ name: string; category: string; value: number; tare: number }>({ name: '', category: 'branded', value: 0, tare: 0 });

  const canManage = user?.role === 'boss' || user?.role === 'manager' || user?.role === 'warehouse';
  const canEdit = user?.role === 'boss' || user?.role === 'manager';
  const canRecord = canManage || user?.role === 'collector';

  useEffect(() => { load(); }, [tab]);
  const load = () => {
    api.caisse.types().then(setTypes);
    api.clients.list().then(setClients);
    if (tab === 'movements') api.caisse.movements().then(setMovements);
  };

  const filteredClients = useMemo(() =>
    clientSearch ? clients.filter((c: any) => c.name.toLowerCase().startsWith(clientSearch.toLowerCase())).sort((a: any, b: any) => a.name.localeCompare(b.name)) : clients.sort((a: any, b: any) => a.name.localeCompare(b.name))
  , [clients, clientSearch]);

  const filteredMovements = useMemo(() => {
    let result = movements;
    if (filterType) result = result.filter(m => m.caisse_type_id === filterType);
    if (searchClient.trim()) {
      const q = searchClient.toLowerCase();
      result = result.filter(m => (m.clients?.name || '').toLowerCase().includes(q));
    }
    if (filterDateFrom) result = result.filter(m => m.created_at && m.created_at >= filterDateFrom);
    if (filterDateTo) result = result.filter(m => m.created_at && m.created_at <= filterDateTo + 'T23:59:59');
    if (filterMinQty) result = result.filter(m => m.quantity >= Number(filterMinQty));
    return result;
  }, [movements, filterType, searchClient, filterDateFrom, filterDateTo, filterMinQty]);

  // Consolidate same-day/same-client/same-type movements into one row
  const consolidatedMovements = useMemo(() => {
    const groups = new Map<string, { client_id: string; caisse_type_id: string; movement_type: string; date: string; quantity: number; clients: any; caisse_types: any; earliest: string; ids: string[] }>();
    for (const m of filteredMovements) {
      const date = m.created_at ? m.created_at.split('T')[0] : '';
      const key = `${m.client_id}_${m.caisse_type_id}_${m.movement_type}_${date}`;
      if (groups.has(key)) {
        const g = groups.get(key)!;
        g.quantity += m.quantity;
        g.ids.push(m.id);
        if (m.created_at < g.earliest) g.earliest = m.created_at;
      } else {
        groups.set(key, {
          client_id: m.client_id, caisse_type_id: m.caisse_type_id, movement_type: m.movement_type,
          date, quantity: m.quantity, clients: m.clients, caisse_types: m.caisse_types,
          earliest: m.created_at, ids: [m.id],
        });
      }
    }
    return Array.from(groups.values()).sort((a, b) => a.earliest > b.earliest ? -1 : a.earliest < b.earliest ? 1 : 0);
  }, [filteredMovements]);

  const pagedMovements = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return consolidatedMovements.slice(start, start + PAGE_SIZE);
  }, [consolidatedMovements, page]);

  const totalOut = useMemo(() =>
    filteredMovements.filter(m => m.caisse_types?.category !== 'client' && m.movement_type === 'out').reduce((sum, m) => sum + m.quantity, 0)
  , [filteredMovements]);

  // Identify first return per client (earliest created_at) to exclude from totals
  const firstReturnIds = useMemo(() => {
    const ids = new Set<string>();
    const byClient = new Map<string, any>();
    movements
      .filter(m => m.movement_type === 'return')
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .forEach(m => {
        if (!byClient.has(m.client_id)) {
          byClient.set(m.client_id, m);
          ids.add(m.id);
        }
      });
    return ids;
  }, [movements]);

  const totalReturned = useMemo(() =>
    filteredMovements.filter(m => m.caisse_types?.category !== 'client' && m.movement_type === 'return' && !firstReturnIds.has(m.id)).reduce((sum, m) => sum + m.quantity, 0)
  , [filteredMovements, firstReturnIds]);

  const hasActiveFilters = searchClient || filterDateFrom || filterDateTo || filterMinQty || filterType;
  const resetFilters = () => { setSearchClient(''); setFilterDateFrom(''); setFilterDateTo(''); setFilterMinQty(''); setFilterType(''); setPage(1); };

  const openCreate = () => {
    setEditId(null);
    setMovementForm({ client_id: '', caisse_type_id: '', quantity: 1, movement_type: 'out', notes: '' });
    setClientSearch('');
    setShowCreate(true);
  };

  const openEdit = (m: CaisseMovement) => {
    setEditId(m.id);
    setMovementForm({
      client_id: m.client_id,
      caisse_type_id: m.caisse_type_id,
      quantity: m.quantity,
      movement_type: m.movement_type as any,
      notes: m.notes || '',
    });
    setClientSearch(m.clients?.name || '');
    setShowCreate(true);
  };

  const recordMovement = async () => {
    if (editId) await api.caisse.updateMovement(editId, movementForm);
    else await api.caisse.createMovement(movementForm);
    setShowCreate(false);
    setEditId(null);
    setClientSearch('');
    load();
  };

  const openAddType = () => {
    setEditTypeId(null);
    setTypeForm({ name: '', category: 'branded', value: 0, tare: 0 });
    setShowTypeModal(true);
  };

  const openEditType = (ct: CaisseType) => {
    setEditTypeId(ct.id);
    setTypeForm({ name: ct.name, category: ct.category, value: ct.value, tare: ct.tare || 0 });
    setShowTypeModal(true);
  };

  const saveType = async () => {
    if (editTypeId) await api.caisse.updateType(editTypeId, typeForm);
    else await api.caisse.createType(typeForm);
    setShowTypeModal(false);
    setEditTypeId(null);
    load();
  };

  const removeType = async (id: string) => {
    if (!confirm(t('Delete this caisse type?'))) return;
    try { await api.caisse.deleteType(id); load(); } catch (err: any) { alert(err.message); }
  };

  return (
    <div>
      <h4 className="mb-4"><i className="bi bi-box-seam me-2" />{t('Caisse Management')}</h4>

      <ul className="nav nav-tabs mb-3">
        <li className="nav-item"><button className={`nav-link ${tab === 'movements' ? 'active' : ''}`} onClick={() => setTab('movements')}>{t('Movements')}</button></li>
        <li className="nav-item"><button className={`nav-link ${tab === 'types' ? 'active' : ''}`} onClick={() => setTab('types')}>{t('Caisse Types')}</button></li>
      </ul>

      {tab === 'movements' && (
        <>
          <div className="card mb-3 border-0 shadow-sm">
            <div className="card-body py-3">
              <div className="d-flex gap-2 align-items-center flex-wrap">
                <div className="position-relative" style={{ maxWidth: 300 }}>
                  <div className="input-group">
                    <span className="input-group-text bg-light"><i className="bi bi-search" /></span>
                    <input type="text" className="form-control" placeholder={t('Search client...')}
                      value={searchClient}
                      onChange={e => { setSearchClient(e.target.value); setPage(1); }}
                      onFocus={() => setShowClientDropdown(true)}
                      onBlur={() => setTimeout(() => setShowClientDropdown(false), 200)}
                    />
                  </div>
                  {showClientDropdown && searchClient && (
                    <div className="list-group position-absolute w-100" style={{ zIndex: 1050, maxHeight: 180, overflow: 'auto' }}>
                      {filteredClients.map((c: any) => (
                        <button key={c.id} type="button" className="list-group-item list-group-item-action py-1"
                          onMouseDown={() => { setSearchClient(c.name); setShowClientDropdown(false); setPage(1); }}>
                          <div className="fw-medium">{c.name}</div>
                        </button>
                      ))}
                      {filteredClients.length === 0 && <div className="list-group-item text-muted small">{t('No clients found')}</div>}
                    </div>
                  )}
                </div>
                <select className="form-select form-select-sm" style={{ width: 180 }} value={filterType}
                  onChange={e => { setFilterType(e.target.value); setPage(1); }}>
                  <option value="">{t('All Caisse Types')}</option>
                  {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <button className={`btn ${showFilters ? 'btn-secondary' : 'btn-outline-secondary'}`}
                  onClick={() => setShowFilters(!showFilters)}>
                  <i className="bi bi-funnel me-1" />{t('Filters')}
                  {hasActiveFilters && <span className="badge bg-danger ms-1">!</span>}
                </button>
                {hasActiveFilters && (
                  <button className="btn btn-outline-danger btn-sm" onClick={resetFilters}>
                    <i className="bi bi-x-circle me-1" />{t('Clear')}
                  </button>
                )}
                <span className="text-muted ms-auto small">
                  {filteredMovements.length} {t('movements')}
                </span>
                <div>{canRecord && <button className="btn btn-primary btn-sm" onClick={openCreate}><i className="bi bi-plus-lg me-1" />{t('Record Movement')}</button>}</div>
              </div>
              {showFilters && (
                <div className="border-top pt-3 mt-3">
                  <div className="d-flex gap-2 align-items-end flex-wrap">
                    <div style={{ minWidth: 150 }}>
                      <label className="form-label small text-muted mb-1">{t('Date From')}</label>
                      <input type="date" className="form-control form-control-sm" value={filterDateFrom} onChange={e => { setFilterDateFrom(e.target.value); setPage(1); }} />
                    </div>
                    <div style={{ minWidth: 150 }}>
                      <label className="form-label small text-muted mb-1">{t('Date To')}</label>
                      <input type="date" className="form-control form-control-sm" value={filterDateTo} onChange={e => { setFilterDateTo(e.target.value); setPage(1); }} />
                    </div>
                    <div style={{ minWidth: 120 }}>
                      <label className="form-label small text-muted mb-1">{t('Min Quantity')}</label>
                      <input type="number" className="form-control form-control-sm" min={1} value={filterMinQty} onChange={e => { setFilterMinQty(e.target.value); setPage(1); }} />
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
                    <th>{t('Client')}</th>
                    <th>{t('Caisse Type')}</th>
                    <th>{t('Quantity')}</th>
                    <th>{t('Type')}</th>
                    <th>{t('Date')}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {pagedMovements.map((m, idx) => (
                    <tr key={`${m.client_id}_${m.caisse_type_id}_${m.movement_type}_${m.date}_${idx}`}>
                      <td>{m.clients?.name}</td>
                      <td>{m.caisse_types?.name}</td>
                      <td className="fw-bold">{m.quantity}</td>
                      <td>
                        {m.movement_type === 'return' && m.ids.some((id: string) => firstReturnIds.has(id)) ? (
                          <span className="badge bg-secondary">{t('Excluded')}</span>
                        ) : (
                          <span className={`badge bg-${m.movement_type === 'out' ? 'warning' : 'success'}`}>
                            {t(m.movement_type)}
                          </span>
                        )}
                      </td>
                      <td><small>{new Date(m.earliest).toLocaleDateString()}</small></td>
                      <td></td>
                    </tr>
                  ))}
                  {filteredMovements.length > 0 && (
                    <tr className="table-info fw-bold">
                      <td colSpan={2} className="text-end">{t('Out')}:</td>
                      <td className="text-warning">{totalOut}</td>
                      <td colSpan={2} className="text-end">{t('Returned')}:</td>
                      <td className="text-success">{totalReturned}</td>
                    </tr>
                  )}
                  {filteredMovements.length > 0 && (
                    <tr className="table-primary fw-bold">
                      <td colSpan={5} className="text-end">{t('Outstanding (Out − Returned)')}:</td>
                      <td>{totalOut - totalReturned}</td>
                    </tr>
                  )}
                  {!consolidatedMovements.length && <tr><td colSpan={6} className="text-center text-muted py-4">{t('No movements yet')}</td></tr>}
                </tbody>
              </table>
              </div>
              <Pagination total={consolidatedMovements.length} page={page} pageSize={PAGE_SIZE} onPageChange={setPage} />
            </div>
          </div>
        </>
      )}

      {tab === 'types' && (
        <>
          <div className="d-flex justify-content-end mb-3">
            {canManage && <button className="btn btn-primary" onClick={openAddType}><i className="bi bi-plus-lg me-1" />{t('Add Type')}</button>}
          </div>
          <div className="card">
            <div className="card-body p-0">
              <div className="table-responsive">
              <table className="table mb-0">
                <thead>
                  <tr>
                    <th>{t('Name')}</th>
                    <th>{t('Category')}</th>
                    <th>{t('Value')}</th>
                    <th>{t('Tare')}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {types.map(ct => (
                    <tr key={ct.id}>
                      <td>{ct.name}</td>
                      <td><span className="badge bg-info">{t(ct.category)}</span></td>
                      <td>{ct.value.toFixed(2)}</td>
                      <td>{(ct.tare || 0).toFixed(3)}</td>
                      <td>
                        <button className="btn btn-sm btn-outline-primary me-1" onClick={() => openEditType(ct)} disabled={!canEdit} title={t('Edit')}>
                          <i className="bi bi-pencil" />
                        </button>
                        <button className="btn btn-sm btn-outline-danger" onClick={() => removeType(ct.id)} disabled={!canEdit} title={t('Delete')}>
                          <i className="bi bi-trash" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!types.length && <tr><td colSpan={5} className="text-center text-muted py-4">{t('No caisse types')}</td></tr>}
                </tbody>
              </table>
              </div>
            </div>
          </div>
        </>
      )}

      {showCreate && (
        <div className="modal d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{editId ? t('Edit Caisse Movement') : t('Record Movement')}</h5>
                <button className="btn-close" onClick={() => { setShowCreate(false); setEditId(null); setClientSearch(''); }} />
              </div>
              <div className="modal-body">
                <div className="mb-3 position-relative">
                  <label className="form-label">{t('Client')}</label>
                  <input type="text" className="form-control" placeholder={t('Search client...')}
                    value={clientSearch}
                    onChange={e => {
                      setClientSearch(e.target.value); setShowClientDropdown(true);
                      const match = clients.find((c: any) => c.name.toLowerCase() === e.target.value.toLowerCase());
                      if (match) setMovementForm({ ...movementForm, client_id: match.id });
                      else setMovementForm({ ...movementForm, client_id: '' });
                    }}
                    onFocus={() => setShowClientDropdown(true)}
                    onBlur={() => setTimeout(() => setShowClientDropdown(false), 200)}
                  />
                  {showClientDropdown && clientSearch && !movementForm.client_id && (
                    <div className="list-group position-absolute w-100" style={{ zIndex: 1050, maxHeight: 180, overflow: 'auto' }}>
                      {filteredClients.map((c: any) => (
                        <button key={c.id} type="button" className="list-group-item list-group-item-action py-1"
                          onMouseDown={() => { setClientSearch(c.name); setMovementForm({ ...movementForm, client_id: c.id }); setShowClientDropdown(false); }}>
                          <div className="fw-medium">{c.name}</div>
                          <small className="text-muted">{c.phone || c.address || ''}</small>
                        </button>
                      ))}
                      {filteredClients.length === 0 && <div className="list-group-item text-muted small">{t('No clients found')}</div>}
                    </div>
                  )}
                  {movementForm.client_id && clientSearch && (
                    <span className="position-absolute" style={{ right: 10, top: 34 }}><i className="bi bi-check-circle text-success" /></span>
                  )}
                </div>
                <div className="mb-3">
                  <label className="form-label">{t('Caisse Type')}</label>
                  <select className="form-select" value={movementForm.caisse_type_id} onChange={e => setMovementForm({ ...movementForm, caisse_type_id: e.target.value })}>
                    <option value="">{t('Select')}</option>
                    {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div className="mb-3">
                  <label className="form-label">{t('Movement Type')}</label>
                  <select className="form-select" value={movementForm.movement_type} onChange={e => setMovementForm({ ...movementForm, movement_type: e.target.value as any })}>
                    <option value="out">{t('Outgoing')}</option>
                    <option value="return">{t('Returned')}</option>
                  </select>
                </div>
                <div className="mb-3">
                  <label className="form-label">{t('Quantity')}</label>
                  <input type="number" className="form-control" value={movementForm.quantity || ''} onChange={e => setMovementForm({ ...movementForm, quantity: e.target.value === '' ? 0 : Number(e.target.value) })} min={1} />
                </div>
                <div className="mb-3">
                  <label className="form-label">{t('Notes')}</label>
                  <textarea className="form-control" rows={2} value={movementForm.notes} onChange={e => setMovementForm({ ...movementForm, notes: e.target.value })} />
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => { setShowCreate(false); setEditId(null); setClientSearch(''); }}>{t('Cancel')}</button>
                <button className="btn btn-primary" onClick={recordMovement} disabled={!movementForm.client_id || !movementForm.caisse_type_id}>{editId ? t('Save') : t('Record')}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showTypeModal && (
        <div className="modal d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{editTypeId ? t('Edit Type') : t('Add Type')}</h5>
                <button className="btn-close" onClick={() => { setShowTypeModal(false); setEditTypeId(null); }} />
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label">{t('Name')}</label>
                  <input className="form-control" value={typeForm.name} onChange={e => setTypeForm({ ...typeForm, name: e.target.value })} />
                </div>
                <div className="mb-3">
                  <label className="form-label">{t('Category')}</label>
                  <select className="form-select" value={typeForm.category} onChange={e => setTypeForm({ ...typeForm, category: e.target.value as any })}>
                    <option value="branded">{t('branded')}</option>
                    <option value="foreign">{t('foreign')}</option>
                    <option value="rented">{t('rented')}</option>
                    <option value="client">{t('client')}</option>
                  </select>
                </div>
                <div className="mb-3">
                  <label className="form-label">{t('Value')}</label>
                  <input type="number" className="form-control" value={typeForm.value || ''} onChange={e => setTypeForm({ ...typeForm, value: e.target.value === '' ? 0 : Number(e.target.value) })} />
                </div>
                <div className="mb-3">
                  <label className="form-label">{t('Tare (kg)')}</label>
                  <input type="number" className="form-control" value={typeForm.tare || ''} onChange={e => setTypeForm({ ...typeForm, tare: e.target.value === '' ? 0 : Number(e.target.value) })} step={0.1} min={0} />
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => { setShowTypeModal(false); setEditTypeId(null); }}>{t('Cancel')}</button>
                <button className="btn btn-primary" onClick={saveType}>{t('Save')}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
