import logo from "../assets/MicroSHA_LOGO.png";

export default function GlobalBrand() {
  return (
    <div className="ios-logo-container fade-up" aria-hidden="true" style={{ marginBottom: '24px' }}>
      <div className="card glass-card" style={{ padding: '8px', borderRadius: '22%', width: '100px', height: '100px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <img src={logo} alt="MicroSHA" style={{ width: '80%', height: '80%', objectFit: 'contain' }} />
      </div>
    </div>
  );
}
