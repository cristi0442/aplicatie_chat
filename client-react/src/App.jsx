import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import './App.css'; // Stilurile
import AuthPage from './AuthPage';
import ConversationList from './ConversationList';
import OnlineUsers from './OnlineUsers';
import ChatWindow from './ChatWindow';

function App() {
    const [user, setUser] = useState(null); 
    const [token, setToken] = useState(null);
    const [onlineUsers, setOnlineUsers] = useState({});
    const [selectedConversationId, setSelectedConversationId] = useState(null);
    const [conversationRefreshKey, setConversationRefreshKey] = useState(0); 
    const [mesaje, setMesaje] = useState([]); // Starea mesajelor e aici

    const socketRef = useRef(null); // Folosim useRef pentru a stoca instanța socket-ului

    // Funcția de Login
    const handleLoginSuccess = (loggedInUser, authToken) => {
        setUser(loggedInUser);
        setToken(authToken);
        localStorage.setItem('chat_token', authToken);
        localStorage.setItem('chat_user', JSON.stringify(loggedInUser));
    };

    // Funcția de Logout
    const handleLogout = () => {
        if (socketRef.current) {
            socketRef.current.disconnect();
            socketRef.current = null;
        }
        setUser(null);
        setToken(null);
        setOnlineUsers({});
        setSelectedConversationId(null);
        setMesaje([]);
        localStorage.removeItem('chat_token');
        localStorage.removeItem('chat_user');
    };

    // Verificăm dacă suntem deja logați la încărcarea paginii
    useEffect(() => {
        const storedToken = localStorage.getItem('chat_token');
        const storedUser = localStorage.getItem('chat_user');
        if (storedToken && storedUser) {
            setUser(JSON.parse(storedUser));
            setToken(storedToken);
        }
    }, []);

    // --- EFECTUL 1: GESTIONAREA CONEXIUNII SOCKET ---
    // Se rulează doar când userul se loghează sau se deloghează
    useEffect(() => {
        if (user && token) {
            // Conectare
            const newSocket = io("http://localhost:3001", {
                 auth: { token: token }
            });
            socketRef.current = newSocket; // Salvăm instanța în ref

            newSocket.on('updateOnlineUsers', (users) => {
                setOnlineUsers(users);
            });

            // Funcția de curățare (cleanup)
            return () => {
                newSocket.disconnect();
                socketRef.current = null;
            };
        }
    }, [user, token]); // Dependențe: user, token

    // --- EFECTUL 2: GESTIONAREA ASCULTĂTORULUI DE MESAJE ---
    // Se re-rulează de fiecare dată când socket-ul se schimbă SAU
    // când schimbăm conversația activă
    useEffect(() => {
        // Nu face nimic dacă nu avem un socket
        if (!socketRef.current) return;

        // Definim funcția de handle
        const handleNewMessage = (mesajPrimit) => {
            if (mesajPrimit.conversatie_id === selectedConversationId) {
                // Mesaj pentru chat-ul curent
                setMesaje(anterioare => [...anterioare, mesajPrimit]);
            } else if (mesajPrimit.expeditor_id !== user.id) {
                // Notificare (și nu e ecoul propriului nostru mesaj)
                alert(`Mesaj nou în altă conversație! (de la Utilizator ${mesajPrimit.expeditor_id})`);
            }
        };
        
        // Pornim ascultătorul
        socketRef.current.on('newMessage', handleNewMessage);

        // Funcția de curățare (cleanup)
        // Oprește listener-ul vechi înainte de a rula din nou efectul
        return () => {
            socketRef.current.off('newMessage', handleNewMessage);
        };
        
    // AICI E CHEIA: Acest efect depinde de conversația selectată
    }, [socketRef.current, selectedConversationId, user?.id]); // Adăugăm user.id pentru siguranță


    // Funcție pentru a schimba conversația și a încărca mesajele
    const handleSelectConversation = (convoId) => {
        setMesaje([]); // Golește mesajele vechi
        setSelectedConversationId(convoId);
        // TODO: Aici vei încărca istoricul mesajelor
        // fetch(...)
    };

    // Funcția pentru a porni un chat (logica "find-or-create")
    const handleSelectUser = async (otherUserId) => {
        if (!user || !token) return;

        const numericOtherUserId = parseInt(otherUserId, 10);
        
        if (numericOtherUserId === user.id) {
            alert("Nu poți începe un chat cu tine însuți.");
            return;
        }

        try {
            const response = await fetch("http://localhost:3001/conversations/start", {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ otherUserId: numericOtherUserId })
            });

            if (!response.ok) {
                throw new Error('Eroare la pornirea conversației');
            }

            const data = await response.json(); // data = { conversationId, createdNew }
            
            // Selectează automat conversația (fie ea nouă sau veche)
            handleSelectConversation(data.conversationId);

            if (data.createdNew) {
                setConversationRefreshKey(key => key + 1);
            }
            
        } catch (err) {
            console.error(err);
        }
    };

    // --- RANDAREA ---

    if (!user) {
        return <AuthPage onLoginSuccess={handleLoginSuccess} />;
    }

    return (
        <div className="app-layout">
            <div className="sidebar">
                <div className="sidebar-header">
                    <strong>Logat ca: {user.username}</strong>
                    <button onClick={handleLogout} className="logout-button">Logout</button>
                </div>
                
                <ConversationList 
                    token={token} 
                    onSelectConversation={handleSelectConversation}
                    refreshKey={conversationRefreshKey}
                />
                
                <OnlineUsers 
                    onlineUsers={onlineUsers} 
                    myUserId={user.id}
                    onSelectUser={handleSelectUser}
                />
            </div>
            
            <div className="chat-area">
                <ChatWindow 
                    socket={socketRef.current} 
                    user={user} 
                    conversationId={selectedConversationId}
                    mesaje={mesaje} // Trimitem mesajele din starea părintelui
                />
            </div>
        </div>
    );
}

export default App;