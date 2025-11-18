import React, { useState, useEffect, useRef } from 'react';

// Primește 'mesaje' ca prop de la App.jsx
function ChatWindow({ socket, user, conversationId, mesaje }) { 
    const [mesajInput, setMesajInput] = useState("");
    const messagesEndRef = useRef(null);

    // Funcție pentru a derula la cel mai recent mesaj
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    // Auto-scroll la mesaje noi
    useEffect(() => {
        // Acum derulăm de fiecare dată când prop-ul 'mesaje' se schimbă
        scrollToBottom();
    }, [mesaje]);

    const handleSendMessage = (e) => {
        e.preventDefault(); 
        if (mesajInput.trim() && socket && user && conversationId) {
            const dataMesaj = {
                continut: mesajInput,
                expeditorId: user.id, // (Serverul va folosi ID-ul din token, dar e bine să-l avem)
                conversatieId: conversationId
            };
            socket.emit('sendMessage', dataMesaj);
            setMesajInput("");
        }
    };

    if (!conversationId) {
        return <div className="chat-window-placeholder">Selectează o conversație pentru a începe.</div>;
    }

    return (
        <div className="chat-window">
            <h2>Chat (Conversația {conversationId})</h2>
            <ul id="messages">
                {/* Folosim prop-ul 'mesaje' */}
                {mesaje.map((msg) => (
                    <li 
                        key={msg.id} 
                        className={msg.expeditor_id === user.id ? 'my-message' : 'other-message'}
                    >
                        {/* Afișăm expeditorul doar dacă nu suntem noi */}
                        {msg.expeditor_id !== user.id && 
                            <strong className="message-sender">Utilizator {msg.expeditor_id}</strong>
                        }
                        {msg.continut}
                    </li>
                ))}
                <div ref={messagesEndRef} />
            </ul>
            <form id="form" onSubmit={handleSendMessage}>
                <input
                    id="input"
                    autoComplete="off"
                    value={mesajInput}
                    onChange={(e) => setMesajInput(e.target.value)}
                    placeholder="Scrie un mesaj..."
                />
                <button type="submit">Trimite</button>
            </form>
        </div>
    );
}

export default ChatWindow;