import React, { useState } from 'react';

function AuthPage({ onLoginSuccess }) {
    const [isLogin, setIsLogin] = useState(true); // Modul: Login sau Register
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(""); // Reseteaza eroarea

        const url = isLogin
            ? "http://localhost:3001/login"
            : "http://localhost:3001/register";

        try {
            const response = await fetch(url, {
                method: "POST",
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Ceva nu a mers bine');
            }

            if (isLogin) {
                // Daca e login, am primit un token si datele utilizatorului
                onLoginSuccess(data.user, data.token);
            } else {
                // Daca e register, doar anuntam succesul si comutam pe login
                alert("Inregistrare reusita! Acum te poti loga.");
                setIsLogin(true);
            }

        } catch (err) {
            setError(err.message);
        }
    };

    return (
        <div className="auth-container">
            {/* Utilizeaza 'auth-card' pentru aspectul de card */}
            <div className="auth-card">
                <h2>{isLogin ? "Autentificare" : "Înregistrare"}</h2>
                {error && <p style={{ color: 'red', marginBottom: '15px' }}>{error}</p>}

                {/* Utilizeaza 'auth-form' pentru layout-ul input-urilor */}
                <form onSubmit={handleSubmit} className="auth-form">
                    <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Username"
                        required
                    />
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Parola"
                        required
                    />
                    <button type="submit">
                        {isLogin ? "Intră în cont" : "Creează cont"}
                    </button>
                </form>

                {/* Utilizeaza 'toggle-text' pentru link-ul de comutare */}
                <p className="toggle-text">
                    {isLogin ? "Nu ai cont? " : "Ai deja cont? "}
                    <span onClick={() => setIsLogin(!isLogin)}>
                        {isLogin ? "Înregistrează-te aici" : "Loghează-te aici"}
                    </span>
                </p>
            </div>
        </div>
    );
}

export default AuthPage;