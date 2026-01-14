import React, { useEffect, useRef, useState } from "react";
import AgoraRTC from "agora-rtc-sdk-ng";

const APP_ID = "30e5f9ce4cd3419ba8d30fae2c81358f";

const VideoCall = ({ channelName, onEndCall }) => {
    const clientRef = useRef(null);
    const localTracksRef = useRef({ mic: null, cam: null });
    const joinedRef = useRef(false);
    const cleanupRef = useRef(false);

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

                const uid = Math.floor(Math.random() * 100000);

                await client.join(APP_ID, String(channelName), null, uid);

                if (!mounted) return;

                const [mic, cam] =
                    await AgoraRTC.createMicrophoneAndCameraTracks();

                localTracksRef.current = { mic, cam };

                await client.publish([mic, cam]);
            } catch (e) {
                console.error("Video start error:", e);
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
    // 🔥 REMOTE USERS
    // ======================
    useEffect(() => {
        const onUserPublished = async (user, mediaType) => {
            await client.subscribe(user, mediaType);

            if (mediaType === "video") {
                user.videoTrack.play(`remote-${user.uid}`);
            }

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
            const { mic, cam } = localTracksRef.current;

            if (mic || cam) {
                await client.unpublish([mic, cam].filter(Boolean));
            }

            mic?.stop();
            mic?.close();
            cam?.stop();
            cam?.close();

            client.removeAllListeners();

            if (client.connectionState !== "DISCONNECTED") {
                await client.leave();
            }
        } catch (e) {
            console.warn("Video cleanup warning:", e);
        }
    };

    // ======================
    // 🔹 END CALL
    // ======================
    const endCall = async () => {
        await cleanup();
        onEndCall();
    };

    // ======================
    // 🔹 UI
    // ======================
    return (
        <div style={styles.overlay}>
            <div style={styles.container}>
                <h3 style={{ color: "white", marginBottom: 15 }}>
                    📹 Apel Video
                </h3>

                <div style={styles.grid}>
                    {/* LOCAL VIDEO */}
                    <div style={styles.videoCard}>
                        <div
                            id="local-video"
                            style={{ width: "100%", height: "100%" }}
                            ref={(el) => {
                                const cam = localTracksRef.current.cam;
                                if (el && cam) cam.play(el);
                            }}
                        />
                        <span style={styles.label}>Tu</span>
                    </div>

                    {/* REMOTE USERS */}
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
                        <div style={styles.placeholderCard}>
                            Așteptăm partenerul...
                        </div>
                    )}
                </div>

                <button onClick={endCall} style={styles.hangupBtn}>
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
        backgroundColor: "rgba(0,0,0,0.95)",
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
    placeholderCard: {
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
    hangupBtn: {
        background: "#ff4d4d",
        color: "white",
        padding: "12px 30px",
        borderRadius: 30,
        border: "none",
        cursor: "pointer",
        fontSize: 16,
        fontWeight: "bold",
    },
};

export default VideoCall;
