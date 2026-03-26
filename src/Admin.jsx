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
    <div className="page fade-up">
      <header className="row-between" style={{ marginBottom: 32 }}>
        <div className="stack-sm">
          <h1 className="large-title">Panel Admin</h1>
          <p className="caption">Gestioná traslados y recorridos</p>
        </div>
        <button className="btn-secondary" onClick={() => supabase.auth.signOut()} style={{ padding: '8px 12px' }}>
          <IconLogout />
        </button>
      </header>

      <div className="inset-group">
        <h3 className="subheadline">Acciones principales</h3>
        <div className="inset-list">
          <div className="card glass-card row-between" onClick={() => setView("create")} style={{ borderRadius: 0, border: 'none', borderBottom: '0.5px solid rgba(255,255,255,0.05)' }}>
            <span className="body"><b>Crear nuevo traslado</b></span>
            <span className="btn-plain">Nuevo</span>
          </div>
          <div className="card glass-card row-between" onClick={() => setView("templates")} style={{ borderRadius: 0, border: 'none', borderBottom: '0.5px solid rgba(255,255,255,0.05)' }}>
            <span className="body">Paradas predeterminadas</span>
            <span className="btn-plain">Gestionar</span>
          </div>
          <div className="card glass-card row-between" onClick={() => setView("history")} style={{ borderRadius: 0, border: 'none' }}>
            <span className="body">Historial de viajes</span>
            <span className="btn-plain">Ver</span>
          </div>
        </div>
      </div>

      <div className="stack" style={{ marginTop: 40 }}>
        <div className="inset-group">
          <h3 className="subheadline">Traslados activos</h3>
          <AdminTrips />
        </div>
      </div>
    </div>
  );
}
