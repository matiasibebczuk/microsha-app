import { useState } from "react";
import { supabase } from "./supabase";
import MessageBanner from "./ui/MessageBanner";

export default function ResetPassword({ onDone }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const resetPassword = async () => {
    const nextPassword = String(password || "");
    const nextConfirm = String(confirmPassword || "");

    if (nextPassword.length < 6) {
      setMessage("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    if (nextPassword !== nextConfirm) {
      setMessage("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const { error } = await supabase.auth.updateUser({ password: nextPassword });
      if (error) {
        setMessage(error.message || "No se pudo actualizar la contraseña.");
        return;
      }

      alert("Contraseña actualizada. Iniciá sesión con tu nueva contraseña.");
      await supabase.auth.signOut();
      onDone?.();
    } catch (err) {
      setMessage(err?.message || "No se pudo actualizar la contraseña.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-narrow fade-up">
      <div className="card glass-card stack">
        <div>
          <h1 className="large-title">Restablecer contraseña</h1>
          <p className="caption">Ingresá una nueva contraseña para tu cuenta.</p>
        </div>

        <MessageBanner message={message} />

        <input
          type="password"
          placeholder="Nueva contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <input
          type="password"
          placeholder="Confirmar contraseña"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />

        <div className="row">
          <button className="btn-primary" onClick={resetPassword} disabled={loading}>
            {loading ? "Guardando..." : "Guardar contraseña"}
          </button>
          <button
            className="btn-secondary"
            onClick={async () => {
              await supabase.auth.signOut();
              onDone?.();
            }}
            disabled={loading}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
