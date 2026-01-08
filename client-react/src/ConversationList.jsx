import React, { useState, useEffect } from 'react';

function ConversationList({ socket, token, currentUser, joinRoom, baseUrl }) {
  const [conversations, setConversations] = useState([]);
  const [newChatUser, setNewChatUser] = useState("");

  // Functie pentru a incarca lista de conversatii
  const fetchConversations = async () => {
    try {
      const response = await fetch(`${baseUrl}/my-conversations`, { 
          headers: { 'Authorization': `Bearer ${token}` } 
      });
      if (response.ok) {
          const data = await response.json();
          setConversations(data);
      }
    } catch (err) { console.error("Eroare la fetch conversatii:", err); }
  };

  // Incarcam conversatiile cand componenta se monteaza sau se schimba token-ul
  useEffect(() => { 
      if (token) fetchConversations(); 
  }, [token, baseUrl]);

  // Functie pentru a incepe o conversatie noua
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
            
            // 1. Facem update la lista locala
            fetchConversations();
            
            // 2. Selectam automat conversatia noua
            joinRoom(data.conversationId);
            
            // 3. Fortam socket-ul sa intre in camera nou creata (fara refresh)
            if(socket) socket.emit('join_room', data.conversationId);
            
            // 4. Resetam inputul
            setNewChatUser("");
        } else {
            alert("Nu s-a putut crea conversatia (verifica ID-ul).");
        }
    } catch (err) { console.error(err); }
  };

  return (
    <div className="list-section">
      <div style={{display: 'flex', gap: '5px', marginBottom: '15px'}}>
        <input 
            type="number" 
            placeholder="ID User..." 
            value={newChatUser} 
            onChange={(e) => setNewChatUser(e.target.value)}
            style={{width: '100%'}}
        />
        <button onClick={startNewChat} className="add-btn" style={{width: '50px', borderRadius: '8px'}}>+</button>
      </div>

      <h3>Conversatii</h3>
      <ul>
        {conversations.map((convo) => {
            const partener = convo.participanti.find(p => p.username !== currentUser?.username);
            const numeAfisat = partener ? partener.username : "Chat Necunoscut";
            
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
