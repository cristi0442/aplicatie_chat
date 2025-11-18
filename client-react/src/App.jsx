import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import './App.css'; 
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
    const [mesaje, setMesaje] = useState([]); 

    const socketRef = useRef(null); // Folosim useRef pentru a stoca instanta socket-ului

    // functia de Login
    const handleLoginSuccess = (loggedInUser, authToken) => {
        setUser(loggedInUser);
        setToken(authToken);
        localStorage.setItem('chat_token', authToken);
        localStorage.setItem('chat_user', JSON.stringify(loggedInUser));
    };

    // functia de Logout
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

    // aici se verifica daca user-ul este deja logat la incarcarea paginii
    useEffect(() => {
        const storedToken = localStorage.getItem('chat_token');
        const storedUser = localStorage.getItem('chat_user');
        if (storedToken && storedUser) {
            setUser(JSON.parse(storedUser));
            setToken(storedToken);
        }
    }, []);

    //  EFECTUL 1: GESTIONAREA CONEXIUNII SOCKET 
    // Se ruleaza doar cand user-ul se logheaza sau se delogheaza
    useEffect(() => {
        if (user && token) {
            // Conectare
            const newSocket = io("http://localhost:3001", {
                 auth: { token: token }
            });
            socketRef.current = newSocket; // Salvam instanta in ref

            newSocket.on('updateOnlineUsers', (users) => {
                setOnlineUsers(users);
            });

            // functia pentru curatare(cleanup)
            return () => {
                newSocket.disconnect();
                socketRef.current = null;
            };
        }
    }, [user, token]); // Dependente: user, token

    //  EFECTUL 2: GESTIONAREA ASCULTATORULUI DE MESAJE 
    // Se re-ruleaza de fiecare data cand socket-ul se schimba SAU
    // cand schimbam conversatia activa
    useEffect(() => {
        // Nu face nimic daca nu avem un socket
        if (!socketRef.current) return;

        // Definim functia de handle
        const handleNewMessage = (mesajPrimit) => {
            if (mesajPrimit.conversatie_id === selectedConversationId) {
                setMesaje(anterioare => [...anterioare, mesajPrimit]);
            } else if (mesajPrimit.expeditor_id !== user.id) 
            {
                alert(`Mesaj nou in alta conversatie! (de la Utilizator ${mesajPrimit.expeditor_id})`);
            }
        };
        
        socketRef.current.on('newMessage', handleNewMessage);

       
        return () => {
            socketRef.current.off('newMessage', handleNewMessage);
        };
        
    // AICI E CHEIA: Acest efect depinde de conversația selectata
    }, [socketRef.current, selectedConversationId, user?.id]); //Se adauga user.id pentru siguranta

    // Functie pentru a schimba conversatia si a incarca mesajele
    const handleSelectConversation = (convoId) => {
        setMesaje([]); // Goleste mesajele vechi
        setSelectedConversationId(convoId);
        // TODO: Aici trebuie incarcat istoricul mesajelor 
        // fetch(...)
    };

    // Functia pentru a porni un chat (logica "find-or-create")
    const handleSelectUser = async (otherUserId) => {
        if (!user || !token) return;

        const numericOtherUserId = parseInt(otherUserId, 10);
        
        if (numericOtherUserId === user.id) {
            alert("Nu poti incepe un chat cu tine insuti.");
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
                throw new Error('Eroare la pornirea conversatiei');
            }

            const data = await response.json(); // data = { conversationId, createdNew }
            
            handleSelectConversation(data.conversationId);

            if (data.createdNew) {
                setConversationRefreshKey(key => key + 1);
            }
            
        } catch (err) {
            console.error(err);
        }
    };

    //  RANDAREA 

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
                    mesaje={mesaje} // Trimitem mesajele din starea parintelui
                />
            </div>
        </div>
    );
}

export default App;
