import React, { useState, useEffect } from 'react';
import io from "socket.io-client";
import './App.css';
import AuthPage from './AuthPage';
import ChatWindow from './ChatWindow';
import ConversationList from './ConversationList';
import OnlineUsers from './OnlineUsers';

// URL-ul backend-ului tau de pe Render
const SERVER_URL = "https://aplicatie-chat.onrender.com";

function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [currentRoom, setCurrentRoom] = useState(null); // ID-ul conversatiei selectate
  const [socket, setSocket] = useState(null); 
  const [onlineUsers, setOnlineUsers] = useState({});

  // 1. Verificam daca userul este deja logat (in localStorage)
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

  // 2. Conectare Socket.IO cand avem user si token
  useEffect(() => {
    if (user && token) {
      // Conectare la serverul Render
      const newSocket = io(SERVER_URL, { 
          auth: { token: token },
          // Optiuni extra pentru stabilitate pe Render
          reconnection: true,
          reconnectionAttempts: 5,
      });

      setSocket(newSocket);
      
      // Ascultam lista de useri online
      newSocket.on('updateOnlineUsers', (users) => setOnlineUsers(users));
      
      // Cleanup la delogare
      return () => { newSocket.disconnect(); setSocket(null); };
    }
  }, [user, token]);

  // Daca nu e logat, afisam pagina de Auth
  if (!user) {
    return <AuthPage onLoginSuccess={handleLoginSuccess} baseUrl={SERVER_URL} />;
  }

  // Layout principal
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
          baseUrl={SERVER_URL}
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
            baseUrl={SERVER_URL}
          />
        ) : (
          <div className="chat-window-placeholder">
            Selectează o conversație sau începe una nouă (+)
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
