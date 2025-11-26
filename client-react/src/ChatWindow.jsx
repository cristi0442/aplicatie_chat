import React, { useState, useEffect, useRef } from 'react';

function ChatWindow({ socket, user, selectedConversation, mesaje }) {
    const [mesajInput, setMesajInput] = useState("");
    const messagesEndRef = useRef(null);

    const conversationId = selectedConversation?.conversatieId;
    const participantMap = selectedConversation?.participanti.reduce((acc, participant) => {
        acc[participant.userId] = participant.username;
        return acc;
    }, {}) || {};


    // Auto-scroll la mesaje noi
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
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
        return <div className="chat-window-placeholder">Selectează o conversație pentru a începe.</div>;
    }

    const chatTitle = selectedConversation.nume_conversatie ||
        selectedConversation.participanti
            .filter(p => p.userId !== user.id)
            .map(p => p.username)
            .join(', ');

    return (
        <div className="chat-window">
            {/* --- HEADER CONVERSATIE (Foloseste clasa 'chat-header') --- */}
            <div className="chat-header">
                {chatTitle || `Conversația ${conversationId}`}
            </div>

            {/* --- ZONA MESAJE (Foloseste clasa 'messages-container') --- */}
            <div className="messages-container">
                {mesaje.map((msg) => (
                    <div // SCHIMBARE: Folosim un <div> in loc de <li> in containerul flex
                        key={msg.id}
                        className={`message-bubble ${msg.expeditor_id === user.id ? 'my-message' : 'other-message'}`}
                    >
                        {/* SCHIMBARE: Afisam numele din participantMap */}
                        {msg.expeditor_id !== user.id &&
                            <strong className="message-sender">
                                {participantMap[msg.expeditor_id] || `Utilizator ${msg.expeditor_id}`}
                            </strong>
                        }
                        {msg.continut}
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            {/* --- INPUT AREA (Foloseste clasa 'message-input-area') --- */}
            <form className="message-input-area" onSubmit={handleSendMessage}>
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