import React, { useState, useEffect, useRef } from 'react';

function ChatWindow({ socket, username, room, token, baseUrl }) {
  const [currentMessage, setCurrentMessage] = useState("");
  const [messageList, setMessageList] = useState([]);
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Auto-scroll la ultimul mesaj
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messageList]);

  // --- LOGICA ESENTIALA: Detectie Imagine vs Text ---
  // Aceasta functie verifica daca string-ul incepe cu semnatura unei imagini Base64
  const isImageMessage = (content) => {
      return typeof content === 'string' && content.startsWith('data:image');
  };

  // 1. Preluare Istoric Conversatie (din baza de date via Server)
  useEffect(() => {
    const fetchHistory = async () => {
        if (!room) return;
        try {
            const response = await fetch(`${baseUrl}/messages/${room}`, { 
                headers: { 'Authorization': `Bearer ${token}` } 
            });
            if (response.ok) {
                const history = await response.json();
                // Serverul returneaza [{ message: '...', author: '...', time: '...' }, ...]
                setMessageList(history);
            }
        } catch (err) { console.error("Eroare la preluarea istoricului:", err); }
    };
    fetchHistory();
  }, [room, token, baseUrl]);

  // 2. Ascultare Mesaje Live (prin Socket.IO)
  useEffect(() => {
    if (!socket) return;

    const handler = (data) => {
        // Siguranta: Verificam daca mesajul primit e pentru camera curenta
        if (String(data.room) === String(room)) {
            setMessageList((list) => [...list, data]);
        }
    };
    
    socket.on("receive_message", handler);
    
    // Cleanup pentru a nu primi mesajele de mai multe ori
    return () => socket.off("receive_message", handler);
  }, [socket, room]);

  // 3. Trimitere Mesaj Text
  const sendMessage = async () => {
    if (currentMessage !== "") {
      const messageData = {
        room: room,
        author: username,
        message: currentMessage, // Text simplu
        time: new Date(Date.now()).getHours() + ":" + new Date(Date.now()).getMinutes(),
      };
      
      await socket.emit("send_message", messageData);
      setCurrentMessage("");
    }
  };

  // 4. Trimitere Imagine (Conversie Fisier -> Base64 -> Socket)
  const handleFileSelect = (e) => {
      const file = e.target.files[0];
      if (file) {
          const reader = new FileReader();
          reader.onload = () => {
              const base64Image = reader.result;
              
              const messageData = {
                  room: room,
                  author: username,
                  message: base64Image, // String foarte lung care reprezinta imaginea
                  time: new Date(Date.now()).getHours() + ":" + new Date(Date.now()).getMinutes(),
              };
              
              socket.emit("send_message", messageData);
          };
          reader.readAsDataURL(file);
          e.target.value = null; // Reset input pentru a putea selecta aceeasi poza din nou
      }
  };

  return (
    <div className="chat-window">
      <div className="chat-header">
        <p>Conversație (ID: {room})</p>
      </div>
      
      <div className="messages-container">
        {messageList.map((msg, idx) => {
            const isMe = msg.author === username;
            // Verificam AICI daca mesajul e poza sau text
            const isImg = isImageMessage(msg.message);

            return (
                <div key={idx} className={`message-bubble ${isMe ? "my-message" : "other-message"}`}>
                    <div className="message-content">
                        {!isMe && <span className="message-sender">{msg.author}</span>}
                        
                        {isImg ? (
                             <img 
                                src={msg.message} 
                                alt="sent" 
                                style={{
                                    maxWidth: '250px', 
                                    maxHeight: '250px', 
                                    borderRadius: '8px', 
                                    display: 'block',
                                    marginTop: '5px',
                                    cursor: 'pointer'
                                }} 
                                onClick={() => {
                                    // Deschide poza mare intr-un tab nou
                                    const win = window.open();
                                    win.document.write('<img src="' + msg.message + '" style="max-width:100%"/>');
                                }}
                             />
                        ) : (
                            <p style={{margin: 0}}>{msg.message}</p>
                        )}
                        <span style={{fontSize: '0.7em', opacity: 0.7, display:'block', textAlign: 'right', marginTop: '5px'}}>
                            {msg.time}
                        </span>
                    </div>
                </div>
            );
        })}
        <div ref={messagesEndRef} />
      </div>

      <div className="message-input-area">
        {/* Input ascuns pentru fisiere */}
        <input 
            type="file" 
            style={{display:'none'}} 
            ref={fileInputRef} 
            onChange={handleFileSelect} 
            accept="image/*"
        />
        
        {/* Butonul Plus */}
        <button 
            className="add-btn" 
            onClick={() => fileInputRef.current.click()}
            style={{
                marginRight: '10px',
                fontSize: '1.5rem',
                cursor: 'pointer',
                background: 'transparent',
                border: 'none',
                color: '#fff'
            }}
        >
            +
        </button>

        <input
          type="text"
          value={currentMessage}
          placeholder="Scrie un mesaj..."
          onChange={(event) => setCurrentMessage(event.target.value)}
          onKeyPress={(event) => { event.key === "Enter" && sendMessage(); }}
        />
        <button onClick={sendMessage}>&#9658;</button>
      </div>
    </div>
  );
}

export default ChatWindow;