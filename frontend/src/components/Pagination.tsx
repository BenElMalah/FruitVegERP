interface PaginationProps {
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({ total, page, pageSize, onPageChange }: PaginationProps) {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  const getPages = () => {
    const pages: (number | '...')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push('...');
      for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
        pages.push(i);
      }
      if (page < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div className="d-flex align-items-center justify-content-between px-3 py-2 border-top">
      <small className="text-muted">
        Showing {start}–{end} of {total}
      </small>
      <nav>
        <ul className="pagination pagination-sm mb-0">
          <li className={`page-item ${page <= 1 ? 'disabled' : ''}`}>
            <button className="page-link" onClick={() => onPageChange(page - 1)}>«</button>
          </li>
          {getPages().map((p, i) =>
            p === '...' ? (
              <li key={`e${i}`} className="page-item disabled"><span className="page-link">…</span></li>
            ) : (
              <li key={p} className={`page-item ${p === page ? 'active' : ''}`}>
                <button className="page-link" onClick={() => onPageChange(p)}>{p}</button>
              </li>
            )
          )}
          <li className={`page-item ${page >= totalPages ? 'disabled' : ''}`}>
            <button className="page-link" onClick={() => onPageChange(page + 1)}>»</button>
          </li>
        </ul>
      </nav>
    </div>
  );
}
