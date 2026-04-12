export default function MessageBanner({ message, variant = "error" }) {
  if (!message) return null;

  const cls =
    variant === "error" ? "message-error" :
    variant === "warning" ? "message-warning" :
    "message-info";

  return (
    <div className={`message-banner ${cls} fade-up`}>
      {message}
    </div>
  );
}
