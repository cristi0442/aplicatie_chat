import React, { useEffect, useRef, useState } from "react";
import AgoraRTC from "agora-rtc-sdk-ng";

const APP_ID = "30e5f9ce4cd3419ba8d30fae2c81358f";

const VideoCall = ({ channelName, onEndCall }) => {
    const clientRef = useRef(null);
    const localTracks = useRef({ mic: null, cam: null });
    const joined = useRef(false);
    const cleaned = useRef(false);

    const [remoteUsers, setRemoteUsers] = useState([]);

    // ======================
    // INIT CLIENT
    // ======================
    if (!clientRef.current) {
        clientRef.current = AgoraRTC.createClient({
            mode: "rtc",
            codec: "vp8",
        });
    }
    const client = clientRef.current;

    // ======================
    // START CALL
    // ======================
    useEffect(() => {
        let mounted = true;

        const start = async () => {
            if (joined.current) return;
            joined.current = true;

            const uid = Math.floor(Math.random() * 100000);
            await client.join(APP_ID, String(channelName), null, uid);

            if (!mounted) return;

            const [mic, cam] =
                await AgoraRTC.createMicrophoneAndCameraTracks();

            localTracks.current = { mic, cam };
            await client.publish([mic, cam]);
        };

        start();

        return () => {
            mounted = false;
            cleanup();
        };
        // eslint-disable-next-line
    }, [channelName]);

    // ======================
    // REMOTE USERS
    // ======================
    useEffect(() => {
        const onUserPublished = async (user, mediaType) => {
            await client.subscribe(user, mediaType);

            setRemoteUsers((prev) =>
                prev.find((u) => u.uid === user.uid)
                    ? prev
                    : [...prev, user]
            );
        };

        const onUserUnpublished = (user) => {
            setRemoteUsers((prev) =>
                prev.filter((u) => u.uid !== user.uid)
            );
        };

        client.on("user-published", onUserPublished);
        client.on("user-unpublished", onUserUnpublished);
        client.on("user-left", onUserUnpublished);

        return () => {
            client.off("user-published", onUserPublished);
            client.off("user-unpublished", onUserUnpublished);
            client.off("user-left", onUserUnpublished);
        };
    }, [client]);

    // ======================
    // PLAY REMOTE VIDEO (CU RETRY)
    // ======================
    useEffect(() => {
        remoteUsers.forEach((user) => {
            if (!user.videoTrack) return;

            const tryPlay = () => {
                const el = document.getElementById(`remote-${user.uid}`);
                if (!el) return false;

                el.setAttribute("playsinline", true);
                user.videoTrack.play(el);
                return true;
            };

            if (!tryPlay()) {
                setTimeout(() => tryPlay(), 200);
                setTimeout(() => tryPlay(), 600);
            }
        });
    }, [remoteUsers]);

    // ======================
    // CLEANUP HARD
    // ======================
    const cleanup = async () => {
        if (cleaned.current) return;
        cleaned.current = true;

        try {
            const { mic, cam } = localTracks.current;

            await client.unpublish([mic, cam].filter(Boolean));

            mic?.stop();
            mic?.close();
            cam?.stop();
            cam?.close();

            client.removeAllListeners();

            if (client.connectionState !== "DISCONNECTED") {
                await client.leave();
            }
        } catch (e) {
            console.warn("cleanup warning", e);
        }
    };

    const endCall = async () => {
        await cleanup();
        onEndCall();
    };

    // ======================
    // UI
    // ======================
    return (
        <div style={styles.overlay}>
            <div style={styles.container}>
                <h3 style={{ color: "white" }}>📹 Apel Video</h3>

                <div style={styles.grid}>
                    {/* LOCAL */}
                    <div style={styles.videoCard}>
                        <div
                            ref={(el) => {
                                if (el && localTracks.current.cam) {
                                    localTracks.current.cam.play(el);
                                }
                            }}
                            style={{ width: "100%", height: "100%" }}
                        />
                        <span style={styles.label}>Tu</span>
                    </div>

                    {/* REMOTE */}
                    {remoteUsers.map((u) => (
                        <div key={u.uid} style={styles.videoCard}>
                            <div
                                id={`remote-${u.uid}`}
                                style={{ width: "100%", height: "100%" }}
                            />
                            <span style={styles.label}>Partener</span>
                        </div>
                    ))}

                    {remoteUsers.length === 0 && (
                        <div style={styles.placeholder}>
                            Așteptăm partenerul...
                        </div>
                    )}
                </div>

                <button onClick={endCall} style={styles.hangup}>
                    Închide apelul
                </button>
            </div>
        </div>
    );
};

const styles = {
    overlay: {
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.95)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 9999,
    },
    container: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        width: "100%",
    },
    grid: {
        display: "flex",
        gap: 20,
        flexWrap: "wrap",
        justifyContent: "center",
        marginBottom: 30,
    },
    videoCard: {
        width: 320,
        height: 240,
        background: "#000",
        borderRadius: 12,
        position: "relative",
        overflow: "hidden",
    },
    placeholder: {
        width: 320,
        height: 240,
        background: "#222",
        color: "#aaa",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 12,
    },
    label: {
        position: "absolute",
        bottom: 10,
        left: 10,
        color: "white",
        background: "rgba(0,0,0,0.6)",
        padding: "4px 8px",
        borderRadius: 6,
        fontSize: 12,
    },
    hangup: {
        background: "#ff4d4d",
        color: "white",
        padding: "12px 30px",
        borderRadius: 30,
        border: "none",
        cursor: "pointer",
        fontWeight: "bold",
    },
};

export default VideoCall;
