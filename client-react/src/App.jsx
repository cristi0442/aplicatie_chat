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
    const [selectedConversation, setSelectedConversation] = useState(null);
    const [conversationRefreshKey, setConversationRefreshKey] = useState(0);
    const [mesaje, setMesaje] = useState([]);

    const socketRef = useRef(null);

    const handleLoginSuccess = (loggedInUser, authToken) => {
        setUser(loggedInUser);
        setToken(authToken);
    };

    const handleLogout = () => {
        localStorage.removeItem('chat_token');
        localStorage.removeItem('chat_user');

        setToken(null);
        setOnlineUsers({});
        setSelectedConversation(null);
        setMesaje([]);

        setUser(null);
    };

    useEffect(() => {
        if (user && token) {
            // CONEXIUNE SOCKET.IO LA SERVERUL LIVE
            const newSocket = io("https://aplicatie-chat.onrender.com", {
                auth: { token: token }
            });
            socketRef.current = newSocket;

            newSocket.on('updateOnlineUsers', (users) => {
                setOnlineUsers(users);
            });

            return () => {
                newSocket.disconnect();
                socketRef.current = null;
            };
        }
    }, [user, token]);

    useEffect(() => {
        const currentSocket = socketRef.current;

        if (!currentSocket) return;

        const handleNewMessage = (mesajPrimit) => {
            if (selectedConversation && mesajPrimit.conversatie_id === selectedConversation.conversatieId) {
                setMesaje(prev => [...prev, mesajPrimit]);
            }
        };

        currentSocket.on('newMessage', handleNewMessage);

        return () => {
            // Folosim verificarea optionala (?.) pentru siguranta
            if (currentSocket) {
                currentSocket.off('newMessage', handleNewMessage);
            }
        };

    }, [selectedConversation, user]);

    //  FETCH ISTORIC MESAJE (ACTUALIZAT CU LINK SERVER LIVE)
    const handleSelectConversation = async (convo) => {
        setSelectedConversation(convo);
        setMesaje([]);

        try {
            const response = await fetch(`https://aplicatie-chat.onrender.com/messages/${convo.conversatieId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) throw new Error('Fetch failed');

            const istoric = await response.json();
            setMesaje(istoric);

        } catch (err) {
            console.error("Eroare la fetch mesaje:", err);
        }
    };

    //  START / JOIN CONVERSATIE (ACTUALIZAT CU LINK SERVER LIVE)
    const handleSelectUser = async (otherUserId) => {
        if (!user || !token) return;
        const targetId = parseInt(otherUserId, 10);
        if (targetId === user.id) return alert("Nu poti vorbi cu tine.");

        try {
            const res = await fetch("https://aplicatie-chat.onrender.com/conversations/start", {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ otherUserId: targetId })
            });

            if (!res.ok) throw new Error('Eroare start conversatie');
            const data = await res.json();

            const newConversation = {
                conversatieId: data.conversationId,
                participanti: data.participanti || [],
                nume_conversatie: null
            };

            handleSelectConversation(newConversation);
            if (data.createdNew) setConversationRefreshKey(k => k + 1);

        } catch (err) { console.error(err); }
    };


    if (!user) {
        return <AuthPage onLoginSuccess={handleLoginSuccess} />;
    }

    return (
        <div className="app-layout">
            <div className="sidebar">
                <div className="sidebar-header">
                    <strong>{user.username}</strong>
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
                {/* Verificam daca avem conversatie selectata pentru a evita erori vizuale */}
                <ChatWindow
                    socket={socketRef.current}
                    user={user}
                    selectedConversation={selectedConversation}
                    mesaje={mesaje}
                />
            </div>
        </div>
    );
}

export default App;