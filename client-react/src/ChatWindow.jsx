import React, { useState, useEffect, useRef } from 'react';

function ChatWindow({ socket, username, room, token }) {
  const [currentMessage, setCurrentMessage] = useState("");
  const [messageList, setMessageList] = useState([]);
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messageList]);

  const isImageMessage = (content) => {
      return typeof content === 'string' && content.startsWith('data:image');
  };

  useEffect(() => {
    const fetchHistory = async () => {
        if (!room) return;
        try {
            
            const url = `https://aplicatie-chat-backend.onrender.com/messages/${room}`;
            
            const response = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
            if (response.ok) {
                const history = await response.json();
                setMessageList(history);
            }
        } catch (err) { console.error(err); }
    };
    fetchHistory();
  }, [room, token]);

  useEffect(() => {
    const handler = (data) => {
        if (String(data.room) === String(room)) {
            setMessageList((list) => [...list, data]);
        }
    };
    socket.on("receive_message", handler);
    return () => socket.off("receive_message", handler);
  }, [socket, room]);

  const sendMessage = async () => {
    if (currentMessage !== "") {
      const messageData = {
        room: room,
        author: username,
        message: currentMessage,
        type: 'text',
        time: new Date(Date.now()).getHours() + ":" + new Date(Date.now()).getMinutes(),
      };
      await socket.emit("send_message", messageData);
      setCurrentMessage("");
    }
  };

  const handleFileSelect = (e) => {
      const file = e.target.files[0];
      if (file) {
          const reader = new FileReader();
          reader.onload = () => {
              const base64Image = reader.result;
              const messageData = {
                  room: room,
                  author: username,
                  message: base64Image,
                  type: 'image',
                  time: new Date(Date.now()).getHours() + ":" + new Date(Date.now()).getMinutes(),
              };
              socket.emit("send_message", messageData);
          };
          reader.readAsDataURL(file);
          e.target.value = null; 
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
                                    const win = window.open();
                                    win.document.write('<img src="' + msg.message + '" style="max-width:100%"/>');
                                }}
                             />
                        ) : (
                            <p style={{margin: 0}}>{msg.message}</p>
                        )}
                    </div>
                </div>
            );
        })}
        <div ref={messagesEndRef} />
      </div>

      <div className="message-input-area">
        <input 
            type="file" 
            style={{display:'none'}} 
            ref={fileInputRef} 
            onChange={handleFileSelect} 
            accept="image/*"
        />
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