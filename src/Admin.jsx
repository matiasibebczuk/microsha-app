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
      <header className="row-between">
        <div className="stack-sm">
          <h1 className="large-title">Panel Admin</h1>
          <p className="caption">Gestioná traslados y recorridos</p>
        </div>
        <button className="btn-secondary btn-with-icon" onClick={() => supabase.auth.signOut()}>
          <IconLogout />
          Salir
        </button>
      </header>

      <div className="inset-group">
        <h3 className="subheadline">Acciones principales</h3>
        <div className="grid">
          <button className="list-item row-between" onClick={() => setView("create")}>
            <span className="body"><b>Crear nuevo traslado</b></span>
            <span className="badge">Nuevo</span>
          </button>
          <button className="list-item row-between" onClick={() => setView("templates")}>
            <span className="body">Paradas predeterminadas</span>
            <span className="badge">Gestionar</span>
          </button>
          <button className="list-item row-between" onClick={() => setView("history")}>
            <span className="body">Historial de viajes</span>
            <span className="badge">Ver</span>
          </button>
        </div>
      </div>

      <div className="stack">
        <div className="inset-group">
          <h3 className="subheadline">Traslados activos</h3>
          <AdminTrips />
        </div>
      </div>
    </div>
  );
}
