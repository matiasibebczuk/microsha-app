export default function MessageBanner({ message, variant = "error" }) {
  if (!message) return null;

  return (
    <div className={`message-banner ${variant === "error" ? "message-error" : "message-info"} fade-up`}>
      {message}
    </div>
  );
}
