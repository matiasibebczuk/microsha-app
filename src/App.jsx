import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import Login from "./Login";
import Admin from "./Admin";
import Encargado from "./Encargado";
import Passenger from "./Passenger";
import PassengerLogin from "./PassengerLogin";
import GroupSetup from "./GroupSetup";
import { apiUrl } from "./api";
import LoadingState from "./ui/LoadingState";

function App() {
  const [authReady, setAuthReady] = useState(false);
  const [session, setSession] = useState(null);

  const [view, setView] = useState("login");
  const [passengerUser, setPassengerUser] = useState(null);
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

    const boot = async () => {
      try {
        const { data } = await supabase.auth.getSession();

        if (!active) return;
        setSession(data.session || null);
      } catch {
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
      (_event, newSession) => {
        if (!active) return;
        setSession(newSession);
        setAuthReady(true);
      }
    );

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void fetch(apiUrl("/ping"), {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    }).catch(() => {});

    return () => {
      controller.abort();
    };
  }, []);

  useEffect(() => {
    const checkGroup = async () => {
      if (!session?.user) {
        setHasGroup(true);
        setGroupLoading(false);
        return;
      }

      const profile = buildSessionProfile(session);
      if (!profile || !["admin", "encargado"].includes(profile.role)) {
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
  }, [session, groupCheckVersion]);

  // ========================
  // PASAJERO SIN SUPABASE
  // ========================
  if (passengerUser) {
    return (
      <Passenger
        user={passengerUser}
        onSessionExpired={() => {
          setPassengerUser(null);
          setView("passenger-login");
        }}
      />
    );
  }

  if (view === "passenger-login") {
    return (
      <PassengerLogin
        onLogin={setPassengerUser}
        onBack={() => setView("login")}
      />
    );
  }

  // ========================
  // SI NO HAY SESION → LOGIN
  // ========================
  if (!authReady) {
    return (
      <div className="loading-screen">
        <div className="card">
          <LoadingState label="Cargando sesión..." />
        </div>
      </div>
    );
  }

  if (!session) {
    return <Login onPassenger={() => setView("passenger-login")} />;
  }

  const profile = buildSessionProfile(session);

  // ========================
  // ERROR PERFIL
  // ========================
  if (!profile) {
    return (
      <div className="page-narrow">
        <div className="card stack">
          <p className="empty">No se encontró rol en la sesión</p>
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
        <div className="loading-screen">
          <div className="card">
            <LoadingState label="Cargando grupo..." />
          </div>
        </div>
      );
    }

    if (!hasGroup) {
      return (
        <GroupSetup
          role={profile.role}
          onDone={() => setGroupCheckVersion((v) => v + 1)}
        />
      );
    }
  }

  if (profile.role === "admin") return <Admin />;
  if (profile.role === "encargado") return <Encargado />;

  return (
    <div className="page-narrow">
      <div className="card empty">Rol desconocido</div>
    </div>
  );
}

export default App;
