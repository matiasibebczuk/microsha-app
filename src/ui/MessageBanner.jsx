export default function MessageBanner({ message, variant = "error" }) {
  if (!message) return null;

  const style = {
    padding: '12px 16px',
    borderRadius: '12px',
    fontSize: '15px',
    marginBottom: '16px',
    border: '0.5px solid rgba(255,255,255,0.1)',
    background: variant === "error" ? 'rgba(255, 69, 58, 0.15)' : 'rgba(10, 132, 255, 0.15)',
    color: variant === "error" ? '#ff453a' : '#0a84ff',
    fontWeight: '500'
  };

  return (
    <div className="fade-up" style={style}>
      {message}
    </div>
  );
}
