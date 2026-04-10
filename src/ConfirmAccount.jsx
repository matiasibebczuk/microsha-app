import microshaLogo from "./assets/MicroSHA_LOGO.png";

export default function ConfirmAccount({ onDone }) {
  return (
    <div className="page-narrow fade-up">
      <div className="card stack" style={{ textAlign: "center" }}>
        <div className="ios-logo-container" style={{ margin: "0 auto" }}>
          <img src={microshaLogo} alt="MicroSHA Logo" />
        </div>
        <h2 className="headline">¡Cuenta confirmada!</h2>
        <p className="caption">
          Tu cuenta fue verificada correctamente. Ya podés iniciar sesión con tus credenciales.
        </p>
        <div className="divider" />
        <button className="btn-primary" onClick={onDone}>
          Ir al inicio de sesión
        </button>
      </div>
    </div>
  );
}
