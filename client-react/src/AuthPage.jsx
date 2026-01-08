import React, { useState } from 'react';
import './App.css';

function AuthPage({ onLoginSuccess, baseUrl }) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const endpoint = isLogin ? "/login" : "/register";

    try {
      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok) {
        if (isLogin) {
          onLoginSuccess(data.user, data.token);
        } else {
          // După înregistrare, trecem la login automat sau cerem userului să se logheze
          alert("Cont creat! Te rugăm să te autentifici.");
          setIsLogin(true);
        }
      } else {
        setError(data.message || "Eroare necunoscută");
      }
    } catch (err) {
      setError("Eroare de conexiune la server.");
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>{isLogin ? "Autentificare" : "Înregistrare"}</h2>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <form className="auth-form" onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Nume utilizator"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Parolă"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button type="submit">{isLogin ? "Intră în cont" : "Creează cont"}</button>
        </form>
        <p className="toggle-text">
          {isLogin ? "Nu ai cont? " : "Ai deja cont? "}
          <span onClick={() => setIsLogin(!isLogin)}>
            {isLogin ? "Înregistrează-te" : "Loghează-te"}
          </span>
        </p>
      </div>
    </div>
  );
}

export default AuthPage;