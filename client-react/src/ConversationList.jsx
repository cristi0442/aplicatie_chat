import React, { useState, useEffect } from 'react';

function ConversationList({ token, onSelectConversation, refreshKey }) {
    const [conversations, setConversations] = useState([]);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchConversations = async () => {
            try {
                // Apelăm noua rută protejată de pe server
                const response = await fetch("http://localhost:3001/my-conversations", {
                    headers: {
                        // Trimitem token-ul "Bearer" pentru a ne autentifica
                        'Authorization': `Bearer ${token}` 
                    }
                });
                
                if (!response.ok) {
                    throw new Error('Eroare la preluarea conversațiilor');
                }
                const data = await response.json();
                setConversations(data);
            } catch (err) {
                setError(err.message);
            }
        };

        if (token) {
            fetchConversations();
        }
        // `refreshKey` este un "truc" pentru a forța re-încărcarea listei
        // când `handleSelectUser` creează un chat nou.
    }, [token, refreshKey]); 

    // O funcție simplă pentru a afișa numele chat-ului
    const getConversationName = (convo) => {
        if (convo.nume_conversatie) return convo.nume_conversatie; // Pentru grupuri
        if (convo.participanti.length === 0) return `Doar tu (ID ${convo.conversatieId})`;
        if (convo.participanti.length === 1) return `Chat cu ${convo.participanti[0].username}`;
        // Fallback pentru grupuri fără nume
        return convo.participanti.map(p => p.username).join(', ');
    };

    return (
        <div className="list-container">
            <h3>Conversațiile Mele</h3>
            {error && <p style={{ color: 'red' }}>{error}</p>}
            <ul>
                {conversations.map(convo => (
                    <li key={convo.conversatieId} onClick={() => onSelectConversation(convo.conversatieId)}>
                        {getConversationName(convo)}
                    </li>
                ))}
            </ul>
        </div>
    );
}

export default ConversationList;