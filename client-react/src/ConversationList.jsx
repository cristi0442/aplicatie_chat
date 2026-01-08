import React, { useState, useEffect } from 'react';

function ConversationList({ socket, token, currentUser, joinRoom }) {
  const [conversations, setConversations] = useState([]);
  const [newChatUser, setNewChatUser] = useState("");

  const fetchConversations = async () => {
    try {
      const url = "https://aplicatie-chat-backend.onrender.com/my-conversations";

      const response = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
      if (response.ok) setConversations(await response.json());
    } catch (err) { console.error(err); }
  };

  useEffect(() => { if (token) fetchConversations(); }, [token]);

  const startNewChat = async () => {
    if (!newChatUser) return;
    try {
       const url = "https://aplicatie-chat-backend.onrender.com/conversations/start";

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ otherUserId: newChatUser })
        });
        if (response.ok) {
            const data = await response.json();
            joinRoom(data.conversationId);
            fetchConversations();
            setNewChatUser("");
        }
    } catch (err) { console.error(err); }
  };

  return (
    <div className="list-section">
      <div style={{display: 'flex', gap: '5px', marginBottom: '15px'}}>
        <input 
            type="number" placeholder="ID User..." 
            value={newChatUser} onChange={(e) => setNewChatUser(e.target.value)}
            style={{width: '100%'}}
        />
        <button onClick={startNewChat} style={{width: '50px', padding: '0'}}>+</button>
      </div>

      <h3>Conversatii</h3>
      <ul>
        {conversations.map((convo) => {
            const partener = convo.participanti.find(p => p.username !== currentUser.username);
            const numeAfisat = partener ? partener.username : "Chat";
            return (
              <li key={convo.conversatieId} onClick={() => joinRoom(convo.conversatieId)}>
                <strong>{numeAfisat}</strong>
              </li>
            );
        })}
      </ul>
    </div>
  );
}

export default ConversationList;