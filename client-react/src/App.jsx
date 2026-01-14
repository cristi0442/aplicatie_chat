import React, { useState, useEffect } from 'react';
import io from "socket.io-client";
import './App.css';
import AuthPage from './AuthPage';
import ChatWindow from './ChatWindow';
import ConversationList from './ConversationList';
import OnlineUsers from './OnlineUsers';

const SERVER_URL = "https://aplicatie-chat.onrender.com";

function App() {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);

    // 🔥 currentRoom = { id, name }
    const [currentRoom, setCurrentRoom] = useState(null);

    const [socket, setSocket] = useState(null);
    const [onlineUsers, setOnlineUsers] = useState({});

    // ======================
    // 🔹 AUTO LOGIN
    // ======================
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

    // ======================
    // 🔹 SOCKET.IO
    // ======================
    useEffect(() => {
        if (user && token) {
            const newSocket = io(SERVER_URL, {
                auth: { token },
                reconnection: true,
                reconnectionAttempts: 5,
            });

            setSocket(newSocket);

            newSocket.on('updateOnlineUsers', (users) => {
                setOnlineUsers(users);
            });

            return () => {
                newSocket.disconnect();
                setSocket(null);
            };
        }
    }, [user, token]);

    // ======================
    // 🔥 START CHAT DIN ONLINE USERS
    // ======================
    const startChatWithUser = async (otherUserId) => {
        try {
            const response = await fetch(`${SERVER_URL}/conversations/start`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ otherUserId })
            });

            const data = await response.json();

            if (response.ok) {
                const username = onlineUsers[otherUserId] || "Chat";

                setCurrentRoom({
                    id: data.conversationId,
                    name: username
                });

                if (socket) {
                    socket.emit("join_room", data.conversationId);
                }
            } else {
                alert(data.message || "Nu s-a putut crea conversația.");
            }
        } catch (err) {
            console.error("Eroare startChat:", err);
        }
    };

    // ======================
    // 🔹 NU ESTE LOGAT
    // ======================
    if (!user) {
        return <AuthPage onLoginSuccess={handleLoginSuccess} baseUrl={SERVER_URL} />;
    }

    // ======================
    // 🔹 UI
    // ======================
    return (
        <div className="app-layout">
            <div className="sidebar">
                <div className="sidebar-header">
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>Salut,</span>
                        <strong>{user.username}</strong>
                    </div>
                    <button onClick={handleLogout} className="logout-button">
                        Logout
                    </button>
                </div>

                {/* Conversații */}
                <ConversationList
                    socket={socket}
                    token={token}
                    currentUser={user}
                    joinRoom={setCurrentRoom}
                    baseUrl={SERVER_URL}
                />

                {/* Utilizatori online */}
                <div
                    className="list-section"
                    style={{
                        flex: 'none',
                        height: '150px',
                        borderTop: '1px solid var(--border-color)'
                    }}
                >
                    <h3>Utilizatori Online</h3>
                    <OnlineUsers
                        onlineUsers={onlineUsers}
                        myUserId={user.id}
                        onSelectUser={startChatWithUser}
                    />
                </div>
            </div>

            <div className="chat-area">
                {currentRoom && socket ? (
                    <ChatWindow
                        socket={socket}
                        username={user.username}
                        room={currentRoom.id}
                        roomName={currentRoom.name}
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
