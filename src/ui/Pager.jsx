export default function Pager({ page, totalPages, onPrev, onNext }) {
  if (totalPages <= 1) return null;

  return (
    <div className="pager">
      <button className="btn-secondary" onClick={onPrev} disabled={page <= 1}>
        Anterior
      </button>
      <span className="pager-center">
        Página <b>{page}</b> de <b>{totalPages}</b>
      </span>
      <button className="btn-secondary" onClick={onNext} disabled={page >= totalPages}>
        Siguiente
      </button>
    </div>
  );
}
