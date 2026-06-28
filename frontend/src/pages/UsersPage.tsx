import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import Pagination from '../components/Pagination';

const PAGE_SIZE = 100;

export default function UsersPage() {
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ username: '', password: '', name: '', phone: '', role: 'collector' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', phone: '', role: '', status: '', password: '' });
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);

  const load = async () => {
    try {
      setLoading(true);
      const data = await api.auth.users();
      setUsers(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await api.auth.createUser(form);
      setShowForm(false);
      setForm({ username: '', password: '', name: '', phone: '', role: 'collector' });
      load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const startEdit = (u: any) => {
    setEditingId(u.id);
    setEditForm({ name: u.name, phone: u.phone || '', role: u.role, status: u.status, password: '' });
  };

  const handleUpdate = async (id: string) => {
    setError('');
    try {
      await api.auth.updateUser(id, editForm);
      setEditingId(null);
      load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete ${name}?`)) return;
    try {
      await api.auth.deleteUser(id);
      load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  if (loading) return <div className="text-center mt-5"><div className="spinner-border text-primary" /></div>;

  const pagedUsers = users.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="mb-0"><i className="bi bi-person-badge me-2" />{t('Members')}</h4>
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm(!showForm)}>
          <i className="bi bi-plus-lg me-1" />{t('Add Member')}
        </button>
      </div>

      {error && <div className="alert alert-danger py-2">{error}</div>}

      {showForm && (
        <div className="card mb-4">
          <div className="card-body">
            <h6>{t('New Member')}</h6>
            <form onSubmit={handleCreate}>
              <div className="row g-2">
                <div className="col-md-3">
                  <input className="form-control form-control-sm" placeholder={t('Name')} value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div className="col-md-3">
                  <input className="form-control form-control-sm" placeholder={t('Username')} value={form.username}
                    onChange={e => setForm({ ...form, username: e.target.value })} required />
                </div>
                <div className="col-md-2">
                  <input className="form-control form-control-sm" type="password" placeholder={t('Password')} value={form.password}
                    onChange={e => setForm({ ...form, password: e.target.value })} required />
                </div>
                <div className="col-md-2">
                  <input className="form-control form-control-sm" placeholder={t('Phone')} value={form.phone}
                    onChange={e => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div className="col-md-1">
                  <select className="form-select form-select-sm" value={form.role}
                    onChange={e => setForm({ ...form, role: e.target.value })}>
                    <option value="collector">{t('Collector')}</option>
                    <option value="manager">{t('Manager')}</option>
                    <option value="boss">{t('Boss')}</option>
                  </select>
                </div>
                <div className="col-md-1">
                  <button className="btn btn-success btn-sm w-100" type="submit">{t('Save')}</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="card">
        <div className="table-responsive">
        <table className="table table-sm mb-0">
          <thead>
            <tr>
              <th>{t('Name')}</th>
              <th>{t('Username')}</th>
              <th>{t('Phone')}</th>
              <th>{t('Role')}</th>
              <th>{t('Status')}</th>
              <th>{t('Password')}</th>
              <th style={{ width: 90 }}></th>
            </tr>
          </thead>
          <tbody>
            {pagedUsers.map(u => editingId === u.id ? (
              <tr key={u.id}>
                <td><input className="form-control form-control-sm" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} /></td>
                <td>{u.username}</td>
                <td><input className="form-control form-control-sm" value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} /></td>
                <td>
                  <select className="form-select form-select-sm" value={editForm.role} onChange={e => setEditForm({ ...editForm, role: e.target.value })}>
                    <option value="collector">{t('Collector')}</option>
                    <option value="manager">{t('Manager')}</option>
                    <option value="boss">{t('Boss')}</option>
                  </select>
                </td>
                <td>
                  <select className="form-select form-select-sm" value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value })}>
                    <option value="active">{t('Active')}</option>
                    <option value="inactive">{t('Inactive')}</option>
                  </select>
                </td>
                <td>
                  <input className="form-control form-control-sm" type="password" placeholder={t('New password')} value={editForm.password}
                    onChange={e => setEditForm({ ...editForm, password: e.target.value })} />
                </td>
                <td>
                  <button className="btn btn-success btn-sm py-0 me-1" onClick={() => handleUpdate(u.id)} title={t('Save')}><i className="bi bi-check" /></button>
                  <button className="btn btn-outline-secondary btn-sm py-0" onClick={() => setEditingId(null)} title={t('Cancel')}><i className="bi bi-x" /></button>
                </td>
              </tr>
            ) : (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>{u.username}</td>
                <td>{u.phone || '-'}</td>
                <td><span className="badge bg-secondary">{u.role}</span></td>
                <td><span className={`badge ${u.status === 'active' ? 'bg-success' : 'bg-secondary'}`}>{u.status}</span></td>
                <td><span className="text-muted">••••••</span></td>
                <td>
                  <button className="btn btn-outline-primary btn-sm py-0 me-1" onClick={() => startEdit(u)} title={t('Edit')}><i className="bi bi-pencil" /></button>
                  <button className="btn btn-outline-danger btn-sm py-0" onClick={() => handleDelete(u.id, u.name)} title={t('Delete')}><i className="bi bi-trash" /></button>
                </td>
              </tr>
            ))}
            {!users.length && <tr><td colSpan={7} className="text-center text-muted py-3">{t('No members yet')}</td></tr>}
          </tbody>
        </table>
        </div>
        <Pagination total={users.length} page={page} pageSize={PAGE_SIZE} onPageChange={setPage} />
      </div>
    </div>
  );
}
