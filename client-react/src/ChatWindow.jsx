import React, { useState, useEffect, useRef } from 'react';
import VideoCall from './VideoCall'; // Importam componenta noua

function ChatWindow({ socket, username, room, token, baseUrl }) {
    const [currentMessage, setCurrentMessage] = useState("");
    const [messageList, setMessageList] = useState([]);

    // --- STARI NOI PENTRU APEL ---
    const [inCall, setInCall] = useState(false);
    const [incomingCall, setIncomingCall] = useState(null); // { callerName, room }

    const fileInputRef = useRef(null);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messageList]);

    // 1. Fetch Istoric
    useEffect(() => {
        const fetchHistory = async () => {
            if (!room) return;
            try {
                const response = await fetch(`${baseUrl}/messages/${room}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (response.ok) {
                    const history = await response.json();
                    setMessageList(history);
                }
            } catch (err) { console.error(err); }
        };
        fetchHistory();
    }, [room, token, baseUrl]);

    // 2. Socket Events (Mesaje + APELURI)
    useEffect(() => {
        if (!socket) return;
        socket.emit("join_room", room);

        // Handler Mesaje
        const msgHandler = (data) => {
            if (String(data.room) === String(room)) {
                setMessageList((list) => [...list, data]);
            }
        };

        // Handler Primire Apel
        const callHandler = (data) => {
            console.log("Apel primit de la:", data.callerName);
            // Afisam popup-ul doar daca nu suntem deja in apel
            setIncomingCall(data);
        };

        // Handler Apel Inchis de celalalt
        const endCallHandler = () => {
            setInCall(false);
            setIncomingCall(null);
        };

        socket.on("receive_message", msgHandler);
        socket.on("incomingCall", callHandler);
        socket.on("callEnded", endCallHandler);

        return () => {
            socket.off("receive_message", msgHandler);
            socket.off("incomingCall", callHandler);
            socket.off("callEnded", endCallHandler);
        };
    }, [socket, room]);

    // 3. Trimitere Mesaj
    const sendMessage = async () => {
        if (currentMessage !== "") {
            const messageData = {
                room: room, author: username, message: currentMessage,
                time: new Date(Date.now()).getHours() + ":" + new Date(Date.now()).getMinutes(),
            };
            await socket.emit("send_message", messageData);
            setCurrentMessage("");
        }
    };

    // --- FUNCTII APEL VIDEO ---

    const startVideoCall = () => {
        setInCall(true);
        // Notificam serverul
        socket.emit("startCall", { room: room, callerName: username });
    };

    const acceptCall = () => {
        setInCall(true);
        setIncomingCall(null);
    };

    const rejectCall = () => {
        setIncomingCall(null);
    };

    const endVideoCall = () => {
        setInCall(false);
        socket.emit("endCall", { room: room });
    };

    // Functia pentru upload imagini (neschimbata)
    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = () => {
                const base64Image = reader.result;
                const messageData = {
                    room: room, author: username, message: base64Image,
                    time: new Date(Date.now()).getHours() + ":" + new Date(Date.now()).getMinutes(),
                };
                socket.emit("send_message", messageData);
            };
            reader.readAsDataURL(file);
            e.target.value = null;
        }
    };

    // --- RENDER ---

    return (
        <div className="chat-window">
            {/* HEADER CU BUTON DE APEL */}
            <div className="chat-header" style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <p>Conversație (ID: {room})</p>

                <button
                    onClick={startVideoCall}
                    disabled={inCall}
                    style={{
                        backgroundColor: '#4ecca3', color: 'white', padding: '8px 15px',
                        fontSize: '0.9rem', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', gap: '5px'
                    }}
                >
                    📹 Video Call
                </button>
            </div>

            {/* POPUP: PRIMESTI APEL */}
            {incomingCall && !inCall && (
                <div style={{
                    position: 'absolute', top: '70px', right: '20px',
                    backgroundColor: '#2d2d3a', padding: '20px', borderRadius: '12px',
                    boxShadow: '0 4px 15px rgba(0,0,0,0.5)', zIndex: 500, border: '1px solid #4ecca3'
                }}>
                    <p style={{marginBottom: '15px', fontSize: '1.1rem'}}>
                        📞 <strong>{incomingCall.callerName}</strong> te sună!
                    </p>
                    <div style={{display:'flex', gap:'10px'}}>
                        <button onClick={acceptCall} style={{backgroundColor: '#4ecca3', flex:1}}>Răspunde</button>
                        <button onClick={rejectCall} style={{backgroundColor: '#ff4d4d', flex:1}}>Refuză</button>
                    </div>
                </div>
            )}

            {/* COMPONENTA VIDEO CALL (cand inCall e true) */}
            {inCall && (
                <VideoCall
                    channelName={String(room)} // Folosim ID-ul camerei ca nume de canal Agora
                    onEndCall={endVideoCall}
                />
            )}

            {/* ZONA DE MESAJE */}
            <div className="messages-container">
                {messageList.map((msg, idx) => {
                    const isMe = msg.author === username;
                    return (
                        <div key={idx} className={`message-bubble ${isMe ? "my-message" : "other-message"}`}>
                            <div className="message-content">
                                {!isMe && <span className="message-sender">{msg.author}</span>}
                                {msg.message.startsWith('data:image') ? (
                                    <img src={msg.message} style={{maxWidth: '200px', borderRadius:'8px', cursor: 'pointer'}} alt="img"
                                         onClick={() => {const w = window.open(); w.document.write('<img src="'+msg.message+'"/>');}}
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

            {/* ZONA DE INPUT */}
            <div className="message-input-area">
                <input
                    type="file" style={{display:'none'}} ref={fileInputRef}
                    onChange={handleFileSelect} accept="image/*"
                />
                <button className="add-btn" onClick={() => fileInputRef.current.click()}>+</button>

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