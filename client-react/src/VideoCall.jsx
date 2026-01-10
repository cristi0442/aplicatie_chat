import React, { useEffect } from "react";
import {
    AgoraRTCProvider,
    useJoin,
    useLocalCameraTrack,
    useLocalMicrophoneTrack,
    usePublish,
    useRemoteUsers,
    useRTCClient,
    LocalUser,
    RemoteUser
} from "agora-rtc-react";
import AgoraRTC from "agora-rtc-sdk-ng";

const APP_ID = "30e5f9ce4cd3419ba8d30fae2c81358f";

// ================= ROOT =================
export const VideoCall = ({ channelName, onEndCall }) => {
    const client = useRTCClient(
        AgoraRTC.createClient({ codec: "vp8", mode: "rtc" })
    );

    return (
        <AgoraRTCProvider client={client}>
            <Call channelName={channelName} onEndCall={onEndCall} />
        </AgoraRTCProvider>
    );
};

// ================= CALL =================
const Call = ({ channelName, onEndCall }) => {
    const client = useRTCClient();

    // 1️⃣ JOIN (fără uid → evităm INVALID_PARAMS)
    const { isConnected } = useJoin({
        appid: APP_ID,
        channel: channelName,
        token: null,
    });

    // 2️⃣ TRACK-URI LOCALE
    const { localMicrophoneTrack } = useLocalMicrophoneTrack();
    const { localCameraTrack } = useLocalCameraTrack();

    // 3️⃣ PUBLISH DOAR DUPĂ JOIN
    usePublish(
        isConnected ? [localMicrophoneTrack, localCameraTrack] : []
    );

    const remoteUsers = useRemoteUsers();

    // 🔥 FIX CRITIC: SUBSCRIBE MANUAL DOAR LA VIDEO REMOTE
    useEffect(() => {
        if (!client) return;

        remoteUsers.forEach(async (user) => {
            if (user.hasVideo && !user.videoTrack) {
                await client.subscribe(user, "video");
            }
        });
    }, [remoteUsers, client]);

    // 4️⃣ CLEANUP
    const endCall = async () => {
        localCameraTrack?.stop();
        localCameraTrack?.close();
        localMicrophoneTrack?.stop();
        localMicrophoneTrack?.close();
        await client.leave();
        onEndCall();
    };

    return (
        <div style={styles.overlay}>
            <div style={styles.container}>
                <h3 style={{ color: "white", marginBottom: 15 }}>
                    În apel: {channelName}
                </h3>

                <div style={styles.grid}>
                    {/* LOCAL VIDEO */}
                    <div style={styles.videoCard}>
                        <LocalUser
                            key={localCameraTrack?.getTrackId()}
                            audioTrack={localMicrophoneTrack}
                            cameraTrack={localCameraTrack}
                            micOn
                            cameraOn
                            style={{ width: "100%", height: "100%" }}
                        />
                        <span style={styles.label}>Tu</span>
                    </div>

                    {/* REMOTE VIDEO + AUDIO */}
                    {remoteUsers.map((user) => (
                        <div key={user.uid} style={styles.videoCard}>
                            <RemoteUser
                                user={user}
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

// ================= STYLES =================
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
