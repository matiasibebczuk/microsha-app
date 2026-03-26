export default function Pager({ page, totalPages, onPrev, onNext }) {
  if (totalPages <= 1) return null;

  return (
    <div className="row row-between" style={{ padding: '8px 0', marginTop: '16px' }}>
      <button className="btn-secondary" style={{ flex: 1, padding: '8px' }} onClick={onPrev} disabled={page <= 1}>
        Anterior
      </button>
      <span className="caption" style={{ flex: 1.5, textAlign: 'center', color: 'var(--ios-system-gray)' }}>
        Página <b>{page}</b> de <b>{totalPages}</b>
      </span>
      <button className="btn-secondary" style={{ flex: 1, padding: '8px' }} onClick={onNext} disabled={page >= totalPages}>
        Siguiente
      </button>
    </div>
  );
}
