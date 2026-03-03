export default function Pager({ page, totalPages, onPrev, onNext }) {
  if (totalPages <= 1) return null;

  return (
    <div className="row pager-row">
      <button className="btn-secondary" onClick={onPrev} disabled={page <= 1}>
        Anterior
      </button>
      <span className="muted">Página {page} de {totalPages}</span>
      <button className="btn-secondary" onClick={onNext} disabled={page >= totalPages}>
        Siguiente
      </button>
    </div>
  );
}
