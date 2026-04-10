import { Suspense, lazy, useEffect, useState } from "react";
import { supabase } from "./supabase";
import { apiUrl } from "./api";
import LoadingState from "./ui/LoadingState";
import { prefetchStaffData, prefetchPassengerData, prewarmApi } from "./lib/prefetch";
import { clearSessionWindow, getSessionWindowRemainingMs, readSessionWindow, saveSessionWindow } from "./lib/sessionWindow";
import microshaLogo from "./assets/MicroSHA_LOGO.png";

const AUTH_DEBUG = String(import.meta.env.VITE_DEBUG_AUTH || "").toLowerCase() === "true";

const Login = lazy(() => import("./Login"));
const Admin = lazy(() => import("./Admin"));
const Encargado = lazy(() => import("./Encargado"));
const Passenger = lazy(() => import("./Passenger"));
const PassengerLogin = lazy(() => import("./PassengerLogin"));
const PassengerProfileSetup = lazy(() => import("./PassengerProfileSetup"));
const GroupSetup = lazy(() => import("./GroupSetup"));
const ResetPassword = lazy(() => import("./ResetPassword"));
const ConfirmAccount = lazy(() => import("./ConfirmAccount"));

function LazyFallback({ label = "Cargando..." }) {
  return (
    <div className="loading-screen fade-up">
      <LoadingState compact label={label} />
    </div>
  );
}

function App() {
  const initialSavedSession = readSessionWindow();
  const [authReady, setAuthReady] = useState(false);
  const [session, setSession] = useState(null);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [confirmMode, setConfirmMode] = useState(false);

  const [view, setView] = useState("login");
  const [passengerUser, setPassengerUser] = useState(
    initialSavedSession?.kind === "passenger" ? initialSavedSession.user || null : null
  );
  const [groupLoading, setGroupLoading] = useState(false);
  const [hasGroup, setHasGroup] = useState(true);
  const [groupCheckVersion, setGroupCheckVersion] = useState(0);

  const buildSessionProfile = (activeSession) => {
    if (!activeSession?.user) return null;

    const role =
      activeSession.user?.app_metadata?.role ||
      activeSession.user?.user_metadata?.role ||
      activeSession.user?.raw_app_meta_data?.role ||
      activeSession.user?.raw_user_meta_data?.role ||
      null;

    if (!role) return null;

    return {
      id: activeSession.user.id,
      name:
        activeSession.user?.user_metadata?.name ||
        activeSession.user?.raw_user_meta_data?.name ||
        activeSession.user?.email ||
        "Usuario",
      role,
      email: activeSession.user?.email || null,
    };
  };

  useEffect(() => {
    let active = true;

    const hasTypeInUrl = (type) => {
      if (typeof window === "undefined") return false;
      const hash = String(window.location.hash || "").toLowerCase();
      const search = String(window.location.search || "").toLowerCase();
      return hash.includes(`type=${type}`) || search.includes(`type=${type}`);
    };

    setRecoveryMode(hasTypeInUrl("recovery"));
    setConfirmMode(hasTypeInUrl("signup") || hasTypeInUrl("email_change"));

    const boot = async () => {
      try {
        const { data } = await supabase.auth.getSession();

        if (AUTH_DEBUG) {
          console.info("[auth] boot session", {
            hasSession: Boolean(data?.session),
            userId: data?.session?.user?.id || null,
          });
        }

        if (!active) return;
        setSession(data.session || null);
      } catch (error) {
        if (AUTH_DEBUG) {
          console.error("[auth] boot getSession failed", {
            message: error?.message || "unknown",
          });
        }
        if (!active) return;
        setSession(null);
      } finally {
        if (active) {
          setAuthReady(true);
        }
      }
    };

    boot();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        if (!active) return;

        if (AUTH_DEBUG) {
          console.info("[auth] state change", {
            event,
            hasSession: Boolean(newSession),
            userId: newSession?.user?.id || null,
          });
        }

        if (event === "PASSWORD_RECOVERY") {
          setRecoveryMode(true);
        }

        if (event === "SIGNED_IN" && hasTypeInUrl("signup")) {
          setConfirmMode(true);
        }

        if (event === "SIGNED_OUT") {
          setRecoveryMode(false);
          setConfirmMode(false);
        }

        // Avoid remount loops in staff screens caused by periodic token refresh events.
        if (event === "TOKEN_REFRESHED") {
          setAuthReady(true);
          return;
        }

        setSession((prevSession) => {
          if (
            event === "SIGNED_IN" &&
            prevSession?.user?.id &&
            prevSession.user.id === newSession?.user?.id
          ) {
            return prevSession;
          }

          return newSession;
        });
        setAuthReady(true);
      }
    );

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const saved = readSessionWindow();
    if (saved?.kind === "passenger" && saved?.user && !passengerUser) {
      setPassengerUser(saved.user);
    }
  }, [passengerUser]);

  useEffect(() => {
    let timeoutId = null;

    if (passengerUser) {
      saveSessionWindow({
        kind: "passenger",
        user: passengerUser,
      });

      const remainingMs = getSessionWindowRemainingMs();
      if (remainingMs > 0) {
        timeoutId = window.setTimeout(() => {
          setPassengerUser(null);
          setView("passenger-login");
          clearSessionWindow();
        }, remainingMs);
      }
    }

    return () => {
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [passengerUser]);

  useEffect(() => {
    let timeoutId = null;
    const profile = buildSessionProfile(session);

    if (session?.user && profile && ["admin", "encargado"].includes(profile.role)) {
      saveSessionWindow({
        kind: "staff",
        userId: profile.id,
        role: profile.role,
      });

      const remainingMs = getSessionWindowRemainingMs();
      if (remainingMs > 0) {
        timeoutId = window.setTimeout(() => {
          void supabase.auth.signOut();
          clearSessionWindow();
        }, remainingMs);
      }
    }

    if (!session && !passengerUser) {
      clearSessionWindow();
    }

    return () => {
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [session, passengerUser]);

  useEffect(() => {
    const controller = new AbortController();
    void prewarmApi(controller.signal);

    return () => {
      controller.abort();
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    void (async () => {
      if (!session?.user) return;
      const profile = buildSessionProfile(session);
      if (!profile || !["admin", "encargado"].includes(profile.role)) return;

      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      if (!token) return;

      await prefetchStaffData(profile.role, token, controller.signal);
    })();

    return () => {
      controller.abort();
    };
  }, [session]);

  useEffect(() => {
    const controller = new AbortController();
    void prefetchPassengerData(passengerUser?.passengerToken, controller.signal);
    return () => {
      controller.abort();
    };
  }, [passengerUser]);

  const sessionUserId = session?.user?.id || null;
  const sessionRole = buildSessionProfile(session)?.role || null;

  useEffect(() => {
    const checkGroup = async () => {
      if (!sessionUserId) {
        setHasGroup(true);
        setGroupLoading(false);
        return;
      }

      if (!sessionRole || !["admin", "encargado"].includes(sessionRole)) {
        setHasGroup(true);
        setGroupLoading(false);
        return;
      }

      setGroupLoading(true);

      try {
        let data;
        try {
          const sessionResult = await supabase.auth.getSession();
          data = sessionResult.data;
        } catch {
          setHasGroup(false);
          return;
        }

        const token = data?.session?.access_token;

        if (!token) {
          setHasGroup(false);
          return;
        }

        const res = await fetch(apiUrl("/groups/me"), {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const json = await res.json();
        if (!res.ok) {
          setHasGroup(false);
          return;
        }

        setHasGroup(Boolean(json?.hasGroup));
      } finally {
        setGroupLoading(false);
      }
    };

    checkGroup();
  }, [sessionUserId, sessionRole, groupCheckVersion]);

  // ========================
  // PASAJERO SIN SUPABASE
  // ========================
  if (passengerUser) {
    if (passengerUser.needsProfileCompletion) {
      return (
        <Suspense fallback={<LazyFallback label="Cargando perfil..." />}>
          <PassengerProfileSetup
            user={passengerUser}
            onCompleted={setPassengerUser}
            onSessionExpired={() => {
              setPassengerUser(null);
              setView("passenger-login");
              clearSessionWindow();
            }}
          />
        </Suspense>
      );
    }

    return (
      <Suspense fallback={<LazyFallback label="Cargando panel pasajero..." />}>
        <Passenger
          user={passengerUser}
          onSessionExpired={() => {
            setPassengerUser(null);
            setView("passenger-login");
            clearSessionWindow();
          }}
        />
      </Suspense>
    );
  }

  if (view === "passenger-login") {
    return (
      <Suspense fallback={<LazyFallback label="Cargando acceso pasajero..." />}>
        <PassengerLogin
          onLogin={(nextUser) => {
            setPassengerUser(nextUser);
            saveSessionWindow({
              kind: "passenger",
              user: nextUser,
            });
          }}
          onBack={() => setView("login")}
        />
      </Suspense>
    );
  }

  // ========================
  // SI NO HAY SESION → LOGIN
  // ========================
  if (!authReady) {
    return (
      <div className="loading-screen fade-up">
        <div className="stack" style={{ textAlign: "center" }}>
          <div className="ios-logo-container">
            <img src={microshaLogo} alt="MicroSHA Logo" />
          </div>
          <LoadingState compact label="Iniciando sesión..." />
        </div>
      </div>
    );
  }

  if (confirmMode) {
    return (
      <Suspense fallback={<LazyFallback label="Cargando..." />}>
        <ConfirmAccount
          onDone={() => {
            setConfirmMode(false);
            void supabase.auth.signOut();
          }}
        />
      </Suspense>
    );
  }

  if (!session) {
    if (recoveryMode) {
      return (
        <Suspense fallback={<LazyFallback label="Cargando recuperación..." />}>
          <ResetPassword
            onDone={() => {
              setRecoveryMode(false);
              setView("login");
            }}
          />
        </Suspense>
      );
    }
    return (
      <Suspense fallback={<LazyFallback label="Cargando login..." />}>
        <Login onPassenger={() => setView("passenger-login")} />
      </Suspense>
    );
  }

  if (recoveryMode) {
    return (
      <Suspense fallback={<LazyFallback label="Cargando recuperación..." />}>
        <ResetPassword
          onDone={() => {
            setRecoveryMode(false);
            setView("login");
          }}
        />
      </Suspense>
    );
  }

  const profile = buildSessionProfile(session);

  // ========================
  // ERROR PERFIL
  // ========================
  if (!profile) {
    return (
      <div className="page-narrow fade-up">
        <div className="card stack" style={{ textAlign: "center" }}>
          <h2 className="headline">Error de Perfil</h2>
          <p className="caption">No se encontró un rol válido en tu sesión.</p>
          <div className="divider" />
          <button className="btn-secondary" onClick={() => supabase.auth.signOut()}>
            Volver al login
          </button>
        </div>
      </div>
    );
  }

  // ========================
  // ROLES
  // ========================
  if (["admin", "encargado"].includes(profile.role)) {
    if (groupLoading) {
      return (
        <div className="loading-screen fade-up">
          <div className="stack" style={{ textAlign: "center" }}>
            <div className="ios-logo-container">
              <img src={microshaLogo} alt="MicroSHA Logo" />
            </div>
            <LoadingState compact label="Cargando grupo..." />
          </div>
        </div>
      );
    }

    if (!hasGroup) {
      return (
        <Suspense fallback={<LazyFallback label="Cargando configuración..." />}>
          <GroupSetup
            role={profile.role}
            onDone={() => setGroupCheckVersion((v) => v + 1)}
          />
        </Suspense>
      );
    }
  }

  if (profile.role === "admin") {
    return (
      <Suspense fallback={<LazyFallback label="Cargando panel admin..." />}>
        <Admin />
      </Suspense>
    );
  }
  if (profile.role === "encargado") {
    return (
      <Suspense fallback={<LazyFallback label="Cargando panel encargado..." />}>
        <Encargado />
      </Suspense>
    );
  }

  return (
    <div className="page-narrow fade-up">
      <div className="card stack" style={{ textAlign: "center" }}>
        <h2 className="headline">Rol desconocido</h2>
        <p className="caption">Tu cuenta no tiene permisos suficientes.</p>
        <button className="btn-secondary" onClick={() => supabase.auth.signOut()}>
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}

export default App;
