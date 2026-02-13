import { useEffect, useState } from "react";
import { supabase } from "./supabase";

export default function Login({ onPassenger }) {
  const [mode, setMode] = useState("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [lastname, setLastname] = useState("");
  const [role, setRole] = useState("encargado");
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return undefined;

    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [resendCooldown]);

  const getEmailRedirectTo = () => {
    if (typeof window === "undefined") return undefined;
    return `${window.location.origin}/`;
  };

  const handleRateLimitError = (message) => {
    const text = String(message || "").toLowerCase();
    if (!text.includes("rate") || !text.includes("limit")) {
      return false;
    }

    setResendCooldown((prev) => Math.max(prev, 60));
    alert("Límite de emails alcanzado. Esperá 60 segundos antes de volver a intentar.");
    return true;
  };

  const withTimeout = async (promise, ms, label) => {
    let timeoutId;

    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`${label} tardó demasiado`));
      }, ms);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const signIn = async () => {
    setLoading(true);

    try {
      const { data, error } = await withTimeout(
        supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        }),
        10000,
        "Inicio de sesión"
      );

      if (error) {
        alert(error.message);
        return;
      }

      const confirmedAt = data?.user?.email_confirmed_at || null;
      if (!confirmedAt) {
        await supabase.auth.signOut();
        alert("Tenés que confirmar tu correo antes de iniciar sesión.");
      }
    } catch (err) {
      alert(err.message || "No se pudo iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  const registerStaff = async () => {
    if (!name || !lastname || !email || !password || !role) {
      alert("Completá todos los campos.");
      return;
    }

    setLoading(true);

    try {
      const normalizedEmail = email.trim().toLowerCase();

      const { data, error } = await withTimeout(
        supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            emailRedirectTo: getEmailRedirectTo(),
            data: {
              name: name.trim(),
              lastname: lastname.trim(),
              role,
            },
          },
        }),
        10000,
        "Registro"
      );

      if (error) {
        if (handleRateLimitError(error.message)) return;
        alert(error.message || "No se pudo registrar");
        return;
      }

      if (!data?.user) {
        alert("No se pudo crear el usuario");
        return;
      }

      alert("Te enviamos un correo de confirmación. Confirmá tu cuenta para ingresar.");
      setResendCooldown(60);
      setMode("login");

    } catch (err) {
      alert(err.message || "Error al registrar");
    } finally {
      setLoading(false);
    }
  };

  const resendConfirmation = async () => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      alert("Ingresá tu email para reenviar la confirmación.");
      return;
    }

    if (resendCooldown > 0) {
      alert(`Esperá ${resendCooldown}s para reenviar el correo.`);
      return;
    }

    setLoading(true);

    try {
      const { error } = await withTimeout(
        supabase.auth.resend({
          type: "signup",
          email: normalizedEmail,
          options: {
            emailRedirectTo: getEmailRedirectTo(),
          },
        }),
        10000,
        "Reenvío de confirmación"
      );

      if (error) {
        if (handleRateLimitError(error.message)) return;
        alert(error.message || "No se pudo reenviar la confirmación");
        return;
      }

      alert("Reenviamos el email de confirmación.");
      setResendCooldown(60);
    } catch (err) {
      if (handleRateLimitError(err?.message)) return;
      alert(err.message || "No se pudo reenviar la confirmación");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-narrow stack">
      <div className="card stack">
        <div>
          <h1 className="title">MicroSHA</h1>
          <p className="subtitle">{mode === "login" ? "Iniciar sesión" : "Registro staff"}</p>
        </div>

        <div className="stack-sm">
          {mode === "register" && (
            <>
              <input
                placeholder="Nombre"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <input
                placeholder="Apellido"
                value={lastname}
                onChange={(e) => setLastname(e.target.value)}
              />
            </>
          )}

          <input
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {mode === "register" && (
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="encargado">Encargado</option>
              <option value="admin">Admin</option>
            </select>
          )}
        </div>

        {mode === "login" ? (
          <button onClick={signIn} disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </button>
        ) : (
          <button onClick={registerStaff} disabled={loading}>
            {loading ? "Registrando..." : "Registrar y entrar"}
          </button>
        )}

        <hr className="divider" />

        {mode === "login" ? (
          <div className="row-between">
            <p className="muted">¿No tenés cuenta staff?</p>
            <button className="btn-secondary" onClick={() => setMode("register")}>Crear cuenta staff</button>
          </div>
        ) : (
          <div className="row-between">
            <p className="muted">¿Ya tenés cuenta?</p>
            <button className="btn-secondary" onClick={() => setMode("login")}>Volver a iniciar sesión</button>
          </div>
        )}

        {mode === "login" && (
          <button
            className="btn-secondary"
            onClick={resendConfirmation}
            disabled={loading || resendCooldown > 0 || !email.trim()}
          >
            {loading
              ? "Reenviando..."
              : resendCooldown > 0
                ? `Reenviar en ${resendCooldown}s`
                : "Reenviar email de confirmación"}
          </button>
        )}

        <hr className="divider" />

        <div className="row-between">
          <p className="muted">¿Sos socio?</p>
          <button className="btn-secondary" onClick={onPassenger}>Quiero anotarme</button>
        </div>
      </div>
    </div>
  );
}
