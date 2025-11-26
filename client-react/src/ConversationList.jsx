import React, { useState, useEffect } from 'react';

function ConversationList({ token, onSelectConversation, refreshKey }) {
    const [conversations, setConversations] = useState([]);
    const [error, setError] = useState('');
    const [activeId, setActiveId] = useState(null);

    useEffect(() => {
        const fetchConversations = async () => {
            try {
                const response = await fetch("http://localhost:3001/my-conversations", {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (!response.ok) {
                    throw new Error('Eroare la preluarea conversatiilor');
                }
                const data = await response.json();
                if (Array.isArray(data)) setConversations(data);
                else if (data.conversatii) setConversations(data.conversatii);
                else setConversations([]);
            } catch (err) {
                setError(err.message);
            }
        };

        if (token) {
            fetchConversations();
        }
    }, [token, refreshKey]);

    const getConversationName = (convo) => {
        if (convo.nume_conversatie) return convo.nume_conversatie;
        if (convo.participanti.length === 0) return `Doar tu (ID ${convo.conversatieId})`;
        if (convo.participanti.length === 1) return `Chat cu ${convo.participanti[0].username}`;

        return convo.participanti.map(p => p.username).join(', ');
    };

    // Functie apelata la click
    const handleSelect = (convo) => {
        setActiveId(convo.conversatieId);
        onSelectConversation(convo);
    }

    return (
        <div className="list-section">
            <h3>Conversațiile Mele</h3>
            {error && <p style={{ color: 'red' }}>{error}</p>}
            <ul>
                {conversations.map(convo => (
                    <li
                        key={convo.conversatieId}
                        onClick={() => handleSelect(convo)}
                        className={convo.conversatieId === activeId ? 'active' : ''}
                    >
                        {getConversationName(convo)}
                    </li>
                ))}
            </ul>
        </div>
    );
}

export default ConversationList;