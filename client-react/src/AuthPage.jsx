import React, { useState } from 'react';

// Stiluri simple adăugate direct aici
const styles = {
    container: {
        display: 'flex',
        flexDirection: 'column',
        width: '300px',
        margin: '100px auto',
        padding: '20px',
        border: '1px solid #ccc',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
    },
    input: {
        marginBottom: '10px',
        padding: '8px',
        fontSize: '16px'
    },
    button: {
        padding: '10px',
        fontSize: '16px',
        cursor: 'pointer',
        backgroundColor: '#007bff',
        color: 'white',
        border: 'none',
        borderRadius: '4px'
    },
    toggle: {
        marginTop: '15px',
        background: 'none',
        border: 'none',
        color: '#007bff',
        cursor: 'pointer',
        textDecoration: 'underline'
    }
};

// `onLoginSuccess` este o funcție pe care o primim de la App.jsx
function AuthPage({ onLoginSuccess }) {
    const [isLogin, setIsLogin] = useState(true); // Modul: Login sau Register
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(""); // Resetează eroarea

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
                // Dacă e login, am primit un token și datele utilizatorului
                // Trimitem datele către componenta părinte (App.jsx)
                onLoginSuccess(data.user, data.token);
            } else {
                // Dacă e register, doar anunțăm succesul și comutăm pe login
                alert("Înregistrare reușită! Acum te poți loga.");
                setIsLogin(true);
            }

        } catch (err) {
            setError(err.message);
        }
    };

    return (
        <form onSubmit={handleSubmit} style={styles.container}>
            <h2>{isLogin ? "Login" : "Înregistrare"}</h2>
            {error && <p style={{ color: 'red' }}>{error}</p>}
            <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username"
                style={styles.input}
                required
            />
            <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Parolă"
                style={styles.input}
                required
            />
            <button type="submit" style={styles.button}>
                {isLogin ? "Intră în cont" : "Creează cont"}
            </button>
            <button 
                type="button" 
                style={styles.toggle} 
                onClick={() => setIsLogin(!isLogin)}
            >
                {isLogin ? "Nu ai cont? Înregistrează-te" : "Ai deja cont? Intră în cont"}
            </button>
        </form>
    );
}

export default AuthPage;