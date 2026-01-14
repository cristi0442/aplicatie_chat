import React, { useEffect, useRef, useState } from "react";
import AgoraRTC from "agora-rtc-sdk-ng";

const APP_ID = "30e5f9ce4cd3419ba8d30fae2c81358f";

const AudioCall = ({ channelName, onEndCall }) => {
    const clientRef = useRef(null);
    const localTrackRef = useRef(null);
    const joinedRef = useRef(false);
    const cleanupRef = useRef(false);

    const [status, setStatus] = useState("Inițializare...");
    const [micOn, setMicOn] = useState(true);
    const [volume, setVolume] = useState(0);
    const [remoteUsers, setRemoteUsers] = useState([]);

    // ======================
    // 🔹 INIT CLIENT (O SINGURĂ DATĂ)
    // ======================
    if (!clientRef.current) {
        clientRef.current = AgoraRTC.createClient({
            mode: "rtc",
            codec: "vp8",
        });
    }

    const client = clientRef.current;

    // ======================
    // 🔹 START CALL
    // ======================
    useEffect(() => {
        let mounted = true;

        const start = async () => {
            try {
                if (joinedRef.current) return;
                joinedRef.current = true;

                setStatus("Conectare Agora...");

                const uid = Math.floor(Math.random() * 100000);
                await client.join(APP_ID, String(channelName), null, uid);

                if (!mounted) return;

                setStatus("Pornire microfon...");
                const micTrack = await AgoraRTC.createMicrophoneAudioTrack();
                localTrackRef.current = micTrack;

                await client.publish([micTrack]);
                setStatus("✅ Conectat! Vorbește.");

                // 🔊 volum meter
                const interval = setInterval(() => {
                    if (micTrack) {
                        setVolume(micTrack.getVolumeLevel() * 100);
                    }
                }, 100);

                micTrack._volumeInterval = interval;
            } catch (e) {
                console.error("Agora start error:", e);
                setStatus("Eroare Agora");
            }
        };

        start();

        return () => {
            mounted = false;
            cleanup();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [channelName]);

    // ======================
    // 🔥 SUBSCRIBE / UNSUBSCRIBE
    // ======================
    useEffect(() => {
        const onUserPublished = async (user, mediaType) => {
            await client.subscribe(user, mediaType);
            if (mediaType === "audio") {
                user.audioTrack.play();
            }
            setRemoteUsers((prev) =>
                prev.find((u) => u.uid === user.uid)
                    ? prev
                    : [...prev, user]
            );
        };

        const onUserLeft = (user) => {
            setRemoteUsers((prev) =>
                prev.filter((u) => u.uid !== user.uid)
            );
        };

        client.on("user-published", onUserPublished);
        client.on("user-left", onUserLeft);

        return () => {
            client.off("user-published", onUserPublished);
            client.off("user-left", onUserLeft);
        };
    }, [client]);

    // ======================
    // 🔥 CLEANUP HARD (O SINGURĂ DATĂ)
    // ======================
    const cleanup = async () => {
        if (cleanupRef.current) return;
        cleanupRef.current = true;

        try {
            const track = localTrackRef.current;
            if (track) {
                clearInterval(track._volumeInterval);
                await client.unpublish([track]);
                track.stop();
                track.close();
            }

            client.removeAllListeners();

            if (client.connectionState !== "DISCONNECTED") {
                await client.leave();
            }
        } catch (e) {
            console.warn("Cleanup warning:", e);
        }
    };

    // ======================
    // 🔹 CONTROLS
    // ======================
    const toggleMic = async () => {
        const track = localTrackRef.current;
        if (!track) return;
        await track.setEnabled(!micOn);
        setMicOn(!micOn);
    };

    const hangup = async () => {
        await cleanup();
        onEndCall();
    };

    // ======================
    // 🔹 UI
    // ======================
    return (
        <div style={styles.overlay}>
            <div style={styles.container}>
                <h2 style={{ color: "white" }}>📞 Apel Audio</h2>
                <p style={{ color: "#4ecca3" }}>Status: {status}</p>

                <div style={styles.grid}>
                    <div style={styles.audioCard}>
                        <div style={styles.avatar}>👤</div>
                        <p style={{ color: "white" }}>Tu</p>

                        <div style={styles.meter}>
                            <div
                                style={{
                                    width: `${Math.min(volume * 2, 100)}%`,
                                    height: "100%",
                                    background: micOn ? "#4ecca3" : "red",
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
                        onClick={hangup}
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
        gap: 20,
        justifyContent: "center",
        flexWrap: "wrap",
        marginBottom: 40,
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
