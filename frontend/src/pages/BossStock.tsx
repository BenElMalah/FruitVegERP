import { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api';
import Pagination from '../components/Pagination';

const PAGE_SIZE = 100;

export default function BossStock() {
  const [items, setItems] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [selectedWh, setSelectedWh] = useState<string>('');
  const [page, setPage] = useState(1);

  const load = () => {
    api.stock.list(selectedWh || undefined).then(setItems).catch(() => {});
    api.warehouses.list().then(setWarehouses).catch(() => {});
  };
  useEffect(() => { load(); }, [selectedWh]);

  const pagedItems = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return items.slice(start, start + PAGE_SIZE);
  }, [items, page]);

  const totalCaisses = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h4 className="mb-0"><i className="bi bi-boxes me-2" />Stock Overview</h4>
        <div className="d-flex align-items-center gap-2">
          <select className="form-select form-select-sm" style={{ width: 180 }} value={selectedWh}
            onChange={e => setSelectedWh(e.target.value)}>
            <option value="">All Warehouses</option>
            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="row g-3 mb-4">
        <div className="col-6 col-md-3">
          <div className="card border-0 bg-primary bg-opacity-10 h-100">
            <div className="card-body text-center">
              <i className="bi bi-box-seam fs-3 text-primary d-block mb-1" />
              <h3 className="mb-0">{items.length}</h3>
              <small className="text-muted">Products</small>
            </div>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="card border-0 bg-success bg-opacity-10 h-100">
            <div className="card-body text-center">
              <i className="bi bi-building fs-3 text-success d-block mb-1" />
              <h3 className="mb-0">{warehouses.length}</h3>
              <small className="text-muted">Warehouses</small>
            </div>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="card border-0 bg-info bg-opacity-10 h-100">
            <div className="card-body text-center">
              <i className="bi bi-stack fs-3 text-info d-block mb-1" />
              <h3 className="mb-0">{totalCaisses}</h3>
              <small className="text-muted">Total Caisses</small>
            </div>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="card border-0 bg-warning bg-opacity-10 h-100">
            <div className="card-body text-center">
              <i className="bi bi-exclamation-triangle fs-3 text-warning d-block mb-1" />
              <h3 className="mb-0">{items.filter(i => Number(i.quantity) <= 0).length}</h3>
              <small className="text-muted">Out of Stock</small>
            </div>
          </div>
        </div>
      </div>

      {/* Stock Table */}
      <div className="card border-0 shadow-sm">
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-hover mb-0 align-middle">
              <thead className="table-light">
                <tr>
                  <th>Product</th>
                  <th>Warehouse</th>
                  <th className="text-end" style={{ width: 120 }}>Caisses</th>
                  <th className="text-center" style={{ width: 100 }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {pagedItems.map(item => (
                  <tr key={item.id}>
                    <td className="fw-semibold">{item.products?.name || item.product_name || item.product_id}</td>
                    <td><span className="badge bg-info bg-opacity-25 text-info-emphasis">{item.warehouses?.name || 'Main'}</span></td>
                    <td className="text-end">
                      <span className={`fw-bold fs-5 ${Number(item.quantity) <= 0 ? 'text-danger' : 'text-success'}`}>
                        {Number(item.quantity)}
                      </span>
                    </td>
                    <td className="text-center">
                      {Number(item.quantity) <= 0 ? (
                        <span className="badge bg-danger">Out of Stock</span>
                      ) : Number(item.quantity) < 10 ? (
                        <span className="badge bg-warning text-dark">Low</span>
                      ) : (
                        <span className="badge bg-success">In Stock</span>
                      )}
                    </td>
                  </tr>
                ))}
                {!items.length && (
                  <tr><td colSpan={4} className="text-center text-muted py-4">No stock items found</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination total={items.length} page={page} pageSize={PAGE_SIZE} onPageChange={setPage} />
        </div>
      </div>
    </div>
  );
}
