import React, { useState, useEffect, useRef } from 'react';

// Primeste 'mesaje' ca prop de la App.jsx
function ChatWindow({ socket, user, conversationId, mesaje }) { 
    const [mesajInput, setMesajInput] = useState("");
    const messagesEndRef = useRef(null);

    // Functie pentru a derula la cel mai recent mesaj
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    // Auto-scroll la mesaje noi
    useEffect(() => {
        // Acum derulam de fiecare data cand prop-ul 'mesaje' se schimba
        scrollToBottom();
    }, [mesaje]);

    const handleSendMessage = (e) => {
        e.preventDefault(); 
        if (mesajInput.trim() && socket && user && conversationId) {
            const dataMesaj = {
                continut: mesajInput,
                expeditorId: user.id, 
                conversatieId: conversationId
            };
            socket.emit('sendMessage', dataMesaj);
            setMesajInput("");
        }
    };

    if (!conversationId) {
        return <div className="chat-window-placeholder">Selecteaza o conversatie pentru a incepe.</div>;
    }

    return (
        <div className="chat-window">
            <h2>Chat (Conversatia {conversationId})</h2>
            <ul id="messages">
                {/* Folosim prop-ul 'mesaje' */}
                {mesaje.map((msg) => (
                    <li 
                        key={msg.id} 
                        className={msg.expeditor_id === user.id ? 'my-message' : 'other-message'}
                    >
                        {/* Afisam expeditorul doar daca nu suntem noi */}
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
