import { supabase } from "./supabase";
import { apiUrl } from "./api";

export default function Dashboard({ session }) {

  const testBackend = async () => {
    const { data } = await supabase.auth.getSession();

    const res = await fetch(
      apiUrl("/encargado/trips/1/buses/1/dashboard"),
      {
        headers: {
          Authorization: `Bearer ${data.session.access_token}`,
        },
      }
    );

    const json = await res.json();
    console.log(json);
    alert(JSON.stringify(json));
  };

  return (
    <div>
      <h1>Bienvenido</h1>
      <p>{session.user.email}</p>

      <button onClick={testBackend}>
        Probar backend
      </button>

      <br /><br />

      <button onClick={() => supabase.auth.signOut()}>
        Cerrar sesión
      </button>
    </div>
  );
}
