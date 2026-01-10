import React, { useEffect, useState, useRef } from "react";
import {
    AgoraRTCProvider,
    useRTCClient,
    useRemoteUsers,
} from "agora-rtc-react";
import AgoraRTC from "agora-rtc-sdk-ng";

const APP_ID = "30e5f9ce4cd3419ba8d30fae2c81358f";

export const AudioCall = ({ channelName, onEndCall }) => {
    // Folosim un client persistent care nu se distruge la re-render
    const client = useRTCClient(
        AgoraRTC.createClient({ codec: "vp8", mode: "rtc" })
    );

    return (
        <AgoraRTCProvider client={client}>
            <CallLogic channelName={channelName} onEndCall={onEndCall} />
        </AgoraRTCProvider>
    );
};

const CallLogic = ({ channelName, onEndCall }) => {
    const client = useRTCClient();
    const [localMicTrack, setLocalMicTrack] = useState(null);
    const [micOn, setMicOn] = useState(true);
    const [volume, setVolume] = useState(0);
    const [status, setStatus] = useState("Inițializare...");

    // Folosim un ref pentru a preveni dubla-apelare in React Strict Mode
    const isConnecting = useRef(false);

    const remoteUsers = useRemoteUsers();

    useEffect(() => {
        let isMounted = true;

        const startCall = async () => {
            // Daca deja suntem conectati sau ne conectam, STOP.
            if (isConnecting.current || client.connectionState !== "DISCONNECTED") {
                return;
            }

            isConnecting.current = true; // Punem "lacatul"

            try {
                const uid = Math.floor(Math.random() * 9000) + 100;
                setStatus("Conectare Agora...");

                // 1. JOIN
                await client.join(APP_ID, String(channelName), null, uid);

                if (!isMounted) return;
                setStatus("Pornire microfon...");

                // 2. CREATE TRACK
                const micTrack = await AgoraRTC.createMicrophoneAudioTrack();

                if (!isMounted) {
                    micTrack.close();
                    return;
                }

                setLocalMicTrack(micTrack);
                setStatus("Publicare...");

                // 3. PUBLISH
                await client.publish([micTrack]);

                setStatus("✅ Conectat! Vorbește.");

            } catch (error) {
                console.error("Eroare Agora:", error);
                // Ignoram eroarea de ABORT (cauzata de React Strict Mode)
                if (error.code === "OPERATION_ABORTED") {
                    console.log("Ignorat OPERATION_ABORTED (React cleanup)");
                } else {
                    setStatus(`Eroare: ${error.message}`);
                }
            } finally {
                isConnecting.current = false; // Scoatem "lacatul"
            }
        };

        startCall();

        // Cleanup
        return () => {
            isMounted = false;
            // Nu dam leave automat aici imediat pentru a evita conflictul "Abort"
            // Lasam track-ul sa se inchida curat
            if (localMicTrack) {
                localMicTrack.stop();
                localMicTrack.close();
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [client, channelName]);

    // Inchidere manuala completa
    const handleHangup = async () => {
        if (localMicTrack) {
            localMicTrack.stop();
            localMicTrack.close();
        }
        await client.leave();
        onEndCall();
    };

    // Vizualizator Volum
    useEffect(() => {
        if (!localMicTrack) return;
        const timer = setInterval(() => {
            const level = localMicTrack.getVolumeLevel();
            setVolume(level * 100);
        }, 100);
        return () => clearInterval(timer);
    }, [localMicTrack]);

    const toggleMic = async () => {
        if (localMicTrack) {
            const newState = !micOn;
            await localMicTrack.setEnabled(newState);
            setMicOn(newState);
        }
    };

    // Subscribe Automat la parteneri
    useEffect(() => {
        if (!client) return;
        const handleUserPublished = async (user, mediaType) => {
            await client.subscribe(user, mediaType);
            if (mediaType === "audio") {
                user.audioTrack.play();
            }
        };
        client.on("user-published", handleUserPublished);
        return () => client.off("user-published", handleUserPublished);
    }, [client]);

    return (
        <div style={styles.overlay}>
            <div style={styles.container}>
                <h2 style={{ color: "white", marginBottom: "10px" }}>
                    📞 Apel Audio: {channelName}
                </h2>
                <p style={{color: status.includes("Eroare") ? "red" : "#4ecca3", marginBottom: '30px'}}>
                    Status: {status}
                </p>

                <div style={styles.grid}>
                    {/* TU */}
                    <div style={styles.audioCard}>
                        <div style={styles.avatar}>👤</div>
                        <p style={{ color: "white" }}>Tu</p>

                        <div style={{
                            width: '80%', height: '5px', backgroundColor: '#555',
                            borderRadius: '5px', marginTop: '10px', overflow: 'hidden'
                        }}>
                            <div style={{
                                width: `${Math.min(volume * 200, 100)}%`,
                                height: '100%',
                                backgroundColor: micOn ? '#4ecca3' : 'red',
                                transition: 'width 0.1s'
                            }} />
                        </div>
                        <p style={{ fontSize: "0.8rem", color: micOn ? "#aaa" : "red", marginTop: '5px' }}>
                            {micOn ? "Microfon Activ" : "Mute"}
                        </p>
                    </div>

                    {/* PARTENERI */}
                    {remoteUsers.map((user) => (
                        <div key={user.uid} style={styles.audioCard}>
                            <div style={{...styles.avatar, backgroundColor: "#4ecca3"}}>🗣️</div>
                            <p style={{ color: "white" }}>Partener</p>
                            <p style={{ fontSize: "0.8rem", color: "#aaa" }}>Conectat</p>
                        </div>
                    ))}

                    {remoteUsers.length === 0 && (
                        <div style={styles.placeholder}>Așteptare partener...</div>
                    )}
                </div>

                <div style={styles.controls}>
                    <button onClick={toggleMic} style={{...styles.btn, background: micOn ? "#555" : "orange"}}>
                        {micOn ? "Mute" : "Unmute"}
                    </button>
                    {/* Folosim functia noastra de hangup care face cleanup corect */}
                    <button onClick={handleHangup} style={{...styles.btn, background: "#ff4d4d"}}>
                        Închide
                    </button>
                </div>
            </div>
        </div>
    );
};

const styles = {
    overlay: {
        position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh",
        background: "rgba(18, 18, 18, 0.95)", zIndex: 9999,
        display: "flex", justifyContent: "center", alignItems: "center"
    },
    container: { textAlign: "center", width: "100%" },
    grid: { display: "flex", justifyContent: "center", gap: "20px", marginBottom: "40px", flexWrap: "wrap" },
    audioCard: {
        width: "160px", height: "180px", background: "#2d2d3a",
        borderRadius: "15px", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", border: "1px solid #444",
        padding: "10px"
    },
    avatar: { fontSize: "3rem", marginBottom: "5px" },
    placeholder: {
        width: "160px", height: "180px", border: "2px dashed #444",
        borderRadius: "15px", display: "flex", alignItems: "center", justifyContent: "center", color: "#666"
    },
    controls: { display: "flex", gap: "20px", justifyContent: "center" },
    btn: {
        padding: "12px 24px", border: "none", borderRadius: "30px",
        color: "white", fontSize: "1rem", cursor: "pointer", fontWeight: "bold"
    }
};

export default AudioCall;