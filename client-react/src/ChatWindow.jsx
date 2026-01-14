import React, { useState, useEffect, useRef } from 'react';
import VideoCall from './VideoCall';
import AudioCall from './AudioCall';

function ChatWindow({ socket, username, room, roomName, token, baseUrl }) {
    const [currentMessage, setCurrentMessage] = useState("");
    const [messageList, setMessageList] = useState([]);

    // --- STARI APEL ---
    const [callType, setCallType] = useState(null); // 'audio' | 'video'
    const [incomingCall, setIncomingCall] = useState(null); // { callerName, room, type }

    const fileInputRef = useRef(null);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messageList]);

    // ======================
    // 🔹 FETCH ISTORIC
    // ======================
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
            } catch (err) {
                console.error(err);
            }
        };
        fetchHistory();
    }, [room, token, baseUrl]);

    // ======================
    // 🔹 SOCKET EVENTS
    // ======================
    useEffect(() => {
        if (!socket || !room) return;

        socket.emit("join_room", room);

        const msgHandler = (data) => {
            if (String(data.room) === String(room)) {
                setMessageList((list) => [...list, data]);
            }
        };

        const callHandler = (data) => {
            setIncomingCall(data); // { callerName, room, type }
        };

        const endCallHandler = () => {
            setCallType(null);
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

    // ======================
    // 🔹 TRIMITERE MESAJ
    // ======================
    const sendMessage = async () => {
        if (!currentMessage.trim()) return;

        const messageData = {
            room: room,
            author: username,
            message: currentMessage,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        socket.emit("send_message", messageData);
        setCurrentMessage("");
    };

    // ======================
    // 🔹 APELURI
    // ======================
    const startCall = (type) => {
        setCallType(type);
        socket.emit("startCall", {
            room: room,
            callerName: username,
            type
        });
    };

    const acceptCall = () => {
        setCallType(incomingCall.type);
        setIncomingCall(null);
    };

    const rejectCall = () => {
        setIncomingCall(null);
    };

    const endCall = () => {
        setCallType(null);
        socket.emit("endCall", { room });
    };

    // ======================
    // 🔹 TRIMITERE IMAGINE
    // ======================
    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = () => {
            const messageData = {
                room,
                author: username,
                message: reader.result,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            };
            socket.emit("send_message", messageData);
        };
        reader.readAsDataURL(file);
        e.target.value = null;
    };

    return (
        <div className="chat-window">
            {/* ================= HEADER ================= */}
            <div
                className="chat-header"
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
                <strong style={{ fontSize: '1.1rem' }}>
                    {roomName || "Chat"}
                </strong>

                <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                        onClick={() => startCall('audio')}
                        disabled={!!callType}
                        style={{
                            backgroundColor: '#ffa502',
                            color: 'white',
                            padding: '8px 15px',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontWeight: 'bold'
                        }}
                    >
                        📞 Audio
                    </button>

                    <button
                        onClick={() => startCall('video')}
                        disabled={!!callType}
                        style={{
                            backgroundColor: '#4ecca3',
                            color: 'white',
                            padding: '8px 15px',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontWeight: 'bold'
                        }}
                    >
                        📹 Video
                    </button>
                </div>
            </div>

            {/* ================= INCOMING CALL ================= */}
            {incomingCall && !callType && (
                <div
                    style={{
                        position: 'absolute',
                        top: '80px',
                        right: '20px',
                        backgroundColor: '#222',
                        padding: '20px',
                        borderRadius: '12px',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
                        zIndex: 1000,
                        border: incomingCall.type === 'audio'
                            ? '2px solid #ffa502'
                            : '2px solid #4ecca3',
                        minWidth: '250px'
                    }}
                >
                    <div style={{ textAlign: 'center', marginBottom: '15px' }}>
                        <div style={{ fontSize: '2rem', marginBottom: '10px' }}>
                            {incomingCall.type === 'audio' ? '📞' : '📹'}
                        </div>
                        <h4 style={{ margin: 0, color: 'white' }}>
                            {incomingCall.callerName}
                        </h4>
                        <p style={{ margin: 0, color: '#ccc', fontSize: '0.9rem' }}>
                            te sună ({incomingCall.type})
                        </p>
                    </div>

                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                            onClick={acceptCall}
                            style={{
                                flex: 1,
                                backgroundColor: '#4ecca3',
                                border: 'none',
                                padding: '10px',
                                borderRadius: '6px',
                                color: 'white',
                                cursor: 'pointer',
                                fontWeight: 'bold'
                            }}
                        >
                            Răspunde
                        </button>
                        <button
                            onClick={rejectCall}
                            style={{
                                flex: 1,
                                backgroundColor: '#ff4d4d',
                                border: 'none',
                                padding: '10px',
                                borderRadius: '6px',
                                color: 'white',
                                cursor: 'pointer',
                                fontWeight: 'bold'
                            }}
                        >
                            Refuză
                        </button>
                    </div>
                </div>
            )}

            {/* ================= APEL ================= */}
            {callType === 'video' && (
                <VideoCall channelName={String(room)} onEndCall={endCall} />
            )}

            {callType === 'audio' && (
                <AudioCall channelName={String(room)} onEndCall={endCall} />
            )}

            {/* ================= MESAJE ================= */}
            <div className="messages-container">
                {messageList.map((msg, idx) => {
                    const isMe = msg.author === username;
                    return (
                        <div
                            key={idx}
                            className={`message-bubble ${isMe ? "my-message" : "other-message"}`}
                        >
                            <div className="message-content">
                                {!isMe && (
                                    <span className="message-sender">
                                        {msg.author}
                                    </span>
                                )}

                                {msg.message?.startsWith('data:image') ? (
                                    <img
                                        src={msg.message}
                                        alt="img"
                                        style={{ maxWidth: '200px', borderRadius: '8px', cursor: 'pointer' }}
                                        onClick={() => {
                                            const w = window.open();
                                            w.document.write(`<img src="${msg.message}" />`);
                                        }}
                                    />
                                ) : (
                                    <p style={{ margin: 0 }}>{msg.message}</p>
                                )}

                                <span
                                    style={{
                                        fontSize: '0.7em',
                                        opacity: 0.7,
                                        display: 'block',
                                        textAlign: 'right',
                                        marginTop: '5px'
                                    }}
                                >
                                    {msg.time}
                                </span>
                            </div>
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>

            {/* ================= INPUT ================= */}
            <div className="message-input-area">
                <input
                    type="file"
                    style={{ display: 'none' }}
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    accept="image/*"
                />
                <button className="add-btn" onClick={() => fileInputRef.current.click()}>
                    +
                </button>
                <input
                    type="text"
                    value={currentMessage}
                    placeholder="Scrie un mesaj..."
                    onChange={(e) => setCurrentMessage(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                />
                <button onClick={sendMessage}>
                    &#9658;
                </button>
            </div>
        </div>
    );
}

export default ChatWindow;
