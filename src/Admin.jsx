import { useState } from "react";
import AdminTrips from "./admin/AdminTrips";
import AdminHistory from "./admin/AdminHistory";
import AdminCreateTrip from "./admin/AdminCreateTrip";
import TemplateManager from "./TemplateManager";
import { supabase } from "./supabase";
import { IconLogout } from "./ui/icons";

export default function Admin() {
  const [view, setView] = useState("list");

  if (view === "create") {
    return <AdminCreateTrip onCreated={() => setView("list")} />;
  }

  if (view === "history") {
    return <AdminHistory onBack={() => setView("list")} />;
  }

  if (view === "templates") {
    return <TemplateManager onBack={() => setView("list")} />;
  }

  return (
    <div className="page stack">
      <div className="card stack">
        <div className="row-between">
          <div>
            <h1 className="title">Dashboard Admin</h1>
            <p className="subtitle">Gestioná traslados, reservas e historial.</p>
          </div>
          <button className="btn-secondary btn-with-icon" onClick={() => supabase.auth.signOut()}>
            <IconLogout />
            Cerrar sesión
          </button>
        </div>

        <div className="row">
          <button onClick={() => setView("create")}>Nuevo traslado</button>
          <button className="btn-secondary" onClick={() => setView("history")}>Historial</button>
          <button className="btn-secondary" onClick={() => setView("templates")}>Paradas predeterminadas</button>
        </div>
      </div>

      <AdminTrips />
    </div>
  );
}
