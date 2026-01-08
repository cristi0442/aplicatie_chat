import React, { useState, useEffect } from 'react';

function ConversationList({ socket, token, currentUser, joinRoom, baseUrl }) {
  const [conversations, setConversations] = useState([]);
  const [newChatUser, setNewChatUser] = useState("");

  const fetchConversations = async () => {
    try {
      const response = await fetch(`${baseUrl}/my-conversations`, { 
          headers: { 'Authorization': `Bearer ${token}` } 
      });
      if (response.ok) setConversations(await response.json());
    } catch (err) { console.error(err); }
  };

  useEffect(() => { if (token) fetchConversations(); }, [token]);

  const startNewChat = async () => {
    if (!newChatUser) return;
    try {
        const response = await fetch(`${baseUrl}/conversations/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ otherUserId: newChatUser })
        });
        if (response.ok) {
            const data = await response.json();
            // Aici nu mai apelam manual joinRoom in socket, pentru ca 
            // serverul nu stie instant de noua conexiune in DB.
            // Dar putem apela joinRoom de frontend pentru UI.
            joinRoom(data.conversationId);
            fetchConversations();
            setNewChatUser("");
            // Fortam socket-ul sa intre in camera nou creata
            if(socket) socket.emit('join_room', data.conversationId); 
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