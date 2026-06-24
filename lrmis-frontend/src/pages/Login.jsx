import { useState } from "react";

export default function Login({ setUser }) {

  const [role, setRole] = useState("applicant");

  const login = () => {
    setUser(role);
  };

  return (
    <div className="card">

      <h2>LRMIS Login</h2>

      <select onChange={(e) => setRole(e.target.value)}>
        <option value="applicant">Applicant</option>
        <option value="staff">Staff / Registrar</option>
        <option value="surveyor">Surveyor</option>
        <option value="admin">Admin</option>
      </select>

      <button onClick={login}>
        Enter System
      </button>

    </div>
  );
}