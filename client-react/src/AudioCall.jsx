import React, { useEffect, useState, useRef } from "react";
import {
    AgoraRTCProvider,
    useRTCClient,
    useRemoteUsers,
} from "agora-rtc-react";
import AgoraRTC from "agora-rtc-sdk-ng";

const APP_ID = "30e5f9ce4cd3419ba8d30fae2c81358f";

export const AudioCall = ({ channelName, onEndCall }) => {
    // 🔒 client PERSISTENT (nu se recreează)
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
    const remoteUsers = useRemoteUsers();

    const [localMicTrack, setLocalMicTrack] = useState(null);
    const [micOn, setMicOn] = useState(true);
    const [volume, setVolume] = useState(0);
    const [status, setStatus] = useState("Inițializare...");

    const isConnecting = useRef(false);
    const hasLeft = useRef(false); // 🔥 prevenim leave dublu

    // ======================
    // 🔹 START APEL
    // ======================
    useEffect(() => {
        let mounted = true;

        const startCall = async () => {
            if (
                isConnecting.current ||
                client.connectionState !== "DISCONNECTED"
            ) {
                return;
            }

            isConnecting.current = true;

            try {
                const uid = Math.floor(Math.random() * 9000) + 100;
                setStatus("Conectare Agora...");

                await client.join(APP_ID, String(channelName), null, uid);
                if (!mounted) return;

                setStatus("Pornire microfon...");
                const micTrack = await AgoraRTC.createMicrophoneAudioTrack();

                if (!mounted) {
                    micTrack.close();
                    return;
                }

                setLocalMicTrack(micTrack);
                await client.publish([micTrack]);

                setStatus("✅ Conectat! Vorbește.");
            } catch (err) {
                if (err.code !== "OPERATION_ABORTED") {
                    console.error("Agora error:", err);
                    setStatus("Eroare Agora");
                }
            } finally {
                isConnecting.current = false;
            }
        };

        startCall();

        // ======================
        // 🔥 CLEANUP AUTOMAT (STRICT MODE SAFE)
        // ======================
        return () => {
            mounted = false;
            cleanup();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [channelName]);

    // ======================
    // 🔥 CLEANUP REAL (O SINGURĂ DATĂ)
    // ======================
    const cleanup = async () => {
        if (hasLeft.current) return;
        hasLeft.current = true;

        try {
            if (localMicTrack) {
                localMicTrack.stop();
                localMicTrack.close();
            }

            if (client.connectionState !== "DISCONNECTED") {
                await client.leave();
            }
        } catch (e) {
            console.error("Cleanup error:", e);
        }
    };

    // ======================
    // 🔹 HANGUP MANUAL
    // ======================
    const handleHangup = async () => {
        await cleanup();
        onEndCall();
    };

    // ======================
    // 🔹 VOLUM MICROFON
    // ======================
    useEffect(() => {
        if (!localMicTrack) return;
        const t = setInterval(() => {
            setVolume(localMicTrack.getVolumeLevel() * 100);
        }, 100);
        return () => clearInterval(t);
    }, [localMicTrack]);

    const toggleMic = async () => {
        if (!localMicTrack) return;
        await localMicTrack.setEnabled(!micOn);
        setMicOn(!micOn);
    };

    // ======================
    // 🔹 SUBSCRIBE PARTENER
    // ======================
    useEffect(() => {
        const onPublish = async (user, mediaType) => {
            await client.subscribe(user, mediaType);
            if (mediaType === "audio") {
                user.audioTrack.play();
            }
        };

        client.on("user-published", onPublish);
        return () => client.off("user-published", onPublish);
    }, [client]);

    return (
        <div style={styles.overlay}>
            <div style={styles.container}>
                <h2 style={{ color: "white" }}>📞 Apel Audio</h2>
                <p style={{ color: "#4ecca3", marginBottom: "30px" }}>
                    Status: {status}
                </p>

                <div style={styles.grid}>
                    <div style={styles.audioCard}>
                        <div style={styles.avatar}>👤</div>
                        <p style={{ color: "white" }}>Tu</p>

                        <div style={styles.meter}>
                            <div
                                style={{
                                    width: `${Math.min(volume * 2, 100)}%`,
                                    background: micOn ? "#4ecca3" : "red",
                                    height: "100%",
                                }}
                            />
                        </div>

                        <p style={{ color: micOn ? "#aaa" : "red" }}>
                            {micOn ? "Microfon activ" : "Mute"}
                        </p>
                    </div>

                    {remoteUsers.map((u) => (
                        <div key={u.uid} style={styles.audioCard}>
                            <div style={{ ...styles.avatar, color: "#4ecca3" }}>
                                🗣️
                            </div>
                            <p style={{ color: "white" }}>Partener</p>
                            <p style={{ color: "#aaa" }}>Conectat</p>
                        </div>
                    ))}

                    {remoteUsers.length === 0 && (
                        <div style={styles.placeholder}>
                            Așteptare partener...
                        </div>
                    )}
                </div>

                <div style={styles.controls}>
                    <button
                        onClick={toggleMic}
                        style={{
                            ...styles.btn,
                            background: micOn ? "#555" : "orange",
                        }}
                    >
                        {micOn ? "Mute" : "Unmute"}
                    </button>
                    <button
                        onClick={handleHangup}
                        style={{ ...styles.btn, background: "#ff4d4d" }}
                    >
                        Închide
                    </button>
                </div>
            </div>
        </div>
    );
};

const styles = {
    overlay: {
        position: "fixed",
        inset: 0,
        background: "rgba(18,18,18,0.95)",
        zIndex: 9999,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
    },
    container: { textAlign: "center", width: "100%" },
    grid: {
        display: "flex",
        gap: "20px",
        justifyContent: "center",
        flexWrap: "wrap",
        marginBottom: "40px",
    },
    audioCard: {
        width: 160,
        height: 180,
        background: "#2d2d3a",
        borderRadius: 15,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        border: "1px solid #444",
    },
    avatar: { fontSize: "3rem" },
    placeholder: {
        width: 160,
        height: 180,
        border: "2px dashed #444",
        borderRadius: 15,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#666",
    },
    meter: {
        width: "80%",
        height: 5,
        background: "#555",
        borderRadius: 5,
        overflow: "hidden",
        margin: "10px 0",
    },
    controls: { display: "flex", gap: 20, justifyContent: "center" },
    btn: {
        padding: "12px 24px",
        borderRadius: 30,
        border: "none",
        color: "white",
        fontWeight: "bold",
        cursor: "pointer",
    },
};

export default AudioCall;
