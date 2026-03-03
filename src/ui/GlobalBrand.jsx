import logo from "../assets/MicroSHA_LOGO.png";

export default function GlobalBrand() {
  return (
    <div className="global-brand" aria-hidden="true">
      <div className="global-brand-card">
        <img src={logo} alt="MicroSHA" className="global-brand-logo" />
      </div>
    </div>
  );
}
