import React, { useState, useEffect } from 'react';
import io from "socket.io-client";
import './App.css';
import AuthPage from './AuthPage';
import ChatWindow from './ChatWindow';
import ConversationList from './ConversationList';
import OnlineUsers from './OnlineUsers';

function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [currentRoom, setCurrentRoom] = useState(null);
  const [socket, setSocket] = useState(null); 
  const [onlineUsers, setOnlineUsers] = useState({});

  useEffect(() => {
    const storedUser = localStorage.getItem('chat_user');
    const storedToken = localStorage.getItem('chat_token');
    if (storedUser && storedToken) {
        setUser(JSON.parse(storedUser));
        setToken(storedToken);
    }
  }, []);

  const handleLoginSuccess = (userData, authToken) => {
      setUser(userData); 
      setToken(authToken);
      localStorage.setItem('chat_user', JSON.stringify(userData));
      localStorage.setItem('chat_token', authToken);
  };

  const handleLogout = () => {
    localStorage.removeItem('chat_user');
    localStorage.removeItem('chat_token');
    if (socket) socket.disconnect();
    setSocket(null);
    setUser(null);
    setToken(null);
    setCurrentRoom(null);
  };

  useEffect(() => {
    if (user && token) {
      const socketUrl = "https://aplicatie-chat-backend.onrender.com";

      const newSocket = io(socketUrl, { auth: { token: token } });
      setSocket(newSocket);
      newSocket.on('updateOnlineUsers', (users) => setOnlineUsers(users));
      return () => { newSocket.disconnect(); setSocket(null); };
    }
  }, [user, token]);

  if (!user) {
    return <AuthPage onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="app-layout">
      <div className="sidebar">
        <div className="sidebar-header">
          <div style={{display: 'flex', flexDirection: 'column'}}>
             <span style={{fontSize: '0.8rem', opacity: 0.7}}>Salut,</span>
             <strong>{user.username}</strong>
          </div>
          <button onClick={handleLogout} className="logout-button">Logout</button>
        </div>
        
        <ConversationList 
          socket={socket} 
          token={token} 
          currentUser={user} 
          joinRoom={setCurrentRoom} 
        />
        
        <div className="list-section" style={{ flex: 'none', height: '150px', borderTop: '1px solid var(--border-color)' }}>
           <h3>Utilizatori Online</h3>
           <OnlineUsers onlineUsers={onlineUsers} />
        </div>
      </div>

      <div className="chat-area">
        {currentRoom && socket ? (
          <ChatWindow 
            socket={socket} 
            username={user.username} 
            room={currentRoom} 
            token={token}
          />
        ) : (
          <div className="chat-window-placeholder">
            Selecteaza o conversatie sau incepe una noua (+)
          </div>
        )}
      </div>
    </div>
  );
}

export default App;