import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import LoadingState from "./ui/LoadingState";

export default function Login({ onPassenger }) {
  const [mode, setMode] = useState("login");
  const [staffOpen, setStaffOpen] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [lastname, setLastname] = useState("");
  const [role, setRole] = useState("encargado");
  const [adminClubMode, setAdminClubMode] = useState("choose");
  const [adminClubId, setAdminClubId] = useState("");
  const [adminClubName, setAdminClubName] = useState("");
  const [adminClubPassword, setAdminClubPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [passengerLoading, setPassengerLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const goPassenger = () => {
    if (passengerLoading) return;
    setPassengerLoading(true);
    window.setTimeout(() => {
      onPassenger?.();
    }, 180);
  };

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

    if (role === "admin") {
      if (adminClubMode !== "create" && adminClubMode !== "join") {
        alert("Elegí si querés crear un club nuevo o unirte a uno existente.");
        return;
      }

      if (!adminClubName.trim() || !adminClubPassword.trim()) {
        alert("Completá nombre y contraseña del club.");
        return;
      }

      if (adminClubMode === "create" && !adminClubId.trim()) {
        alert("Completá el ID del club para crearlo.");
        return;
      }
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

      if (role === "admin") {
        const payload = {
          mode: adminClubMode,
          groupId: adminClubMode === "create" ? adminClubId.trim() : "",
          name: adminClubName.trim(),
          password: adminClubPassword,
        };

        if (typeof window !== "undefined") {
          window.localStorage.setItem("pendingAdminGroupSetup", JSON.stringify(payload));
        }
      }

      alert("Te enviamos un correo de confirmación. Confirmá tu cuenta para ingresar.");
      setResendCooldown(60);
      setMode("login");
      setStaffOpen(true);
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
    <div className="page-narrow fade-up">
      <div className="ios-logo-container">
        <img src="./assets/MicroSHA_LOGO.png" alt="MicroSHA Logo" />
      </div>

      <div className="card glass-card stack">
        <div>
          <h1 className="large-title">{mode === "login" ? "Iniciar sesión" : "Registro staff"}</h1>
          <p className="caption">Acceso principal para socios y staff.</p>
        </div>

        <button className="cta-passenger" onClick={goPassenger} disabled={passengerLoading}>
          {passengerLoading ? "Cargando acceso..." : "Quiero anotarme"}
        </button>

        {passengerLoading ? <LoadingState compact label="Preparando acceso pasajero..." /> : null}

        <button
          className="btn-secondary"
          onClick={() => setStaffOpen((prev) => !prev)}
          type="button"
        >
          {staffOpen ? "Ocultar opciones staff" : "Soy staff"}
        </button>

        <div className={`staff-panel ${staffOpen ? "staff-panel-open" : ""}`}>
          <div className="stack staff-panel-inner">
            <p className="caption">Si sos admin o encargado, iniciá sesión o registrate acá.</p>

            <div className="divider" />

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
                type="email"
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
                  onChange={(e) => {
                    const nextRole = e.target.value;
                    setRole(nextRole);
                    if (nextRole !== "admin") {
                      setAdminClubMode("choose");
                      setAdminClubId("");
                      setAdminClubName("");
                      setAdminClubPassword("");
                    }
                  }}
                >
                  <option value="encargado">Encargado</option>
                  <option value="admin">Admin</option>
                </select>
              )}

              {mode === "register" && role === "admin" && (
                <div className="stack-sm">
                  <p className="caption">Configuración inicial de club</p>

                  {adminClubMode === "choose" ? (
                    <div className="row">
                      <button type="button" className="btn-primary" onClick={() => setAdminClubMode("create")}>Crear club</button>
                      <button type="button" className="btn-secondary" onClick={() => setAdminClubMode("join")}>Unirme a club</button>
                    </div>
                  ) : (
                    <>
                      {adminClubMode === "create" && (
                        <input
                          placeholder="ID de club"
                          value={adminClubId}
                          onChange={(e) => setAdminClubId(e.target.value)}
                        />
                      )}

                      <input
                        placeholder="Nombre del club"
                        value={adminClubName}
                        onChange={(e) => setAdminClubName(e.target.value)}
                      />

                      <input
                        type="password"
                        placeholder="Contraseña del club"
                        value={adminClubPassword}
                        onChange={(e) => setAdminClubPassword(e.target.value)}
                      />

                      <button type="button" className="btn-plain" onClick={() => setAdminClubMode("choose")}>Cambiar opción</button>
                    </>
                  )}
                </div>
              )}
            </div>

            {mode === "login" ? (
              <button className="btn-primary" onClick={signIn} disabled={loading}>
                {loading ? "Entrando..." : "Entrar"}
              </button>
            ) : (
              <button className="btn-primary" onClick={registerStaff} disabled={loading}>
                {loading ? "Registrando..." : "Registrar y entrar"}
              </button>
            )}

            <div className="divider" />

            {mode === "login" ? (
              <div className="row-between">
                <p className="caption">¿No tenés cuenta staff?</p>
                <button className="btn-plain" onClick={() => { setMode("register"); setStaffOpen(true); }}>
                  Crear cuenta
                </button>
              </div>
            ) : (
              <div className="row-between">
                <p className="caption">¿Ya tenés cuenta?</p>
                <button className="btn-plain" onClick={() => { setMode("login"); setStaffOpen(true); }}>
                  Entrar
                </button>
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
                    : "Reenviar confirmación"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
