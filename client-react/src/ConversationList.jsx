import React, { useState, useEffect } from 'react';

function ConversationList({ socket, token, currentUser, joinRoom, baseUrl }) {
    const [conversations, setConversations] = useState([]);
    const [usernameInput, setUsernameInput] = useState("");

    // 🔹 Fetch conversații
    const fetchConversations = async () => {
        try {
            const response = await fetch(`${baseUrl}/my-conversations`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setConversations(data);
            }
        } catch (err) {
            console.error("Eroare la fetch conversatii:", err);
        }
    };

    useEffect(() => {
        if (token) fetchConversations();
    }, [token, baseUrl]);

    // 🔹 Start chat după USERNAME
    const startNewChat = async () => {
        if (!usernameInput.trim()) return;

        try {
            const response = await fetch(`${baseUrl}/conversations/start`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ username: usernameInput.trim() })
            });

            const data = await response.json();

            if (response.ok) {
                fetchConversations();

                // ⚠️ trimitem ID + nume către App
                joinRoom({
                    id: data.conversationId,
                    name: usernameInput.trim()
                });

                if (socket) socket.emit('join_room', data.conversationId);
                setUsernameInput("");
            } else {
                alert(data.message || "Nu s-a putut crea conversația");
            }
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div className="list-section">
            {/* 🔹 Căutare după username */}
            <div style={{ display: 'flex', gap: '5px', marginBottom: '15px' }}>
                <input
                    type="text"
                    placeholder="Username..."
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    style={{ width: '100%' }}
                    onKeyDown={(e) => e.key === "Enter" && startNewChat()}
                />
                <button
                    onClick={startNewChat}
                    className="add-btn"
                    style={{ width: '50px', borderRadius: '8px' }}
                >
                    +
                </button>
            </div>

            <h3>Conversații</h3>
            <ul>
                {conversations.map((convo) => {
                    const partener = convo.participanti.find(
                        p => p.username !== currentUser?.username
                    );

                    const numeAfisat = partener?.username || "Chat necunoscut";

                    return (
                        <li
                            key={convo.conversatieId}
                            onClick={() =>
                                joinRoom({
                                    id: convo.conversatieId,
                                    name: numeAfisat
                                })
                            }
                        >
                            <strong>{numeAfisat}</strong>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

export default ConversationList;
