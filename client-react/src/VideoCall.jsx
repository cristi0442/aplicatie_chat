import React, { useEffect, useRef } from "react";
import {
    AgoraRTCProvider,
    useJoin,
    useLocalCameraTrack,
    useLocalMicrophoneTrack,
    usePublish,
    useRemoteUsers,
    useRTCClient,
} from "agora-rtc-react";
import AgoraRTC from "agora-rtc-sdk-ng";

const APP_ID = "6d8c5d4ae36048078acd744458928be4";


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


const Call = ({ channelName, onEndCall }) => {
    const client = useRTCClient();

    useJoin({
        appid: APP_ID,
        channel: channelName,
        token: null,
    });

    const { localMicrophoneTrack } = useLocalMicrophoneTrack();
    const { localCameraTrack } = useLocalCameraTrack();

    usePublish([localMicrophoneTrack, localCameraTrack]);

    useEffect(() => {
        if (!client) return;

        const handleUserPublished = async (user, mediaType) => {
            await client.subscribe(user, mediaType);

            if (mediaType === "audio") {
                user.audioTrack?.play();
            }
        };

        client.on("user-published", handleUserPublished);

        return () => {
            client.off("user-published", handleUserPublished);
        };
    }, [client]);

    const remoteUsers = useRemoteUsers();

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
                <h3 style={styles.title}>În apel: {channelName}</h3>

                <div style={styles.grid}>
                    {/* LOCAL */}
                    <VideoPlayer track={localCameraTrack} label="Tu" />

                    {/* REMOTE */}
                    {remoteUsers.map((user) =>
                        user.videoTrack ? (
                            <VideoPlayer
                                key={user.uid}
                                track={user.videoTrack}
                                label="Partener"
                            />
                        ) : (
                            <div key={user.uid} style={styles.placeholder}>
                                Camera oprită
                            </div>
                        )
                    )}

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

const VideoPlayer = ({ track, label }) => {
    const ref = useRef(null);

    useEffect(() => {
        if (track && ref.current) {
            track.play(ref.current);
        }
        return () => track?.stop();
    }, [track]);

    return (
        <div ref={ref} style={styles.video}>
            <span style={styles.label}>{label}</span>
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
    title: { color: "white", marginBottom: 20 },
    grid: {
        display: "flex",
        gap: 20,
        flexWrap: "wrap",
        justifyContent: "center",
        marginBottom: 30,
    },
    video: {
        width: 320,
        height: 240,
        background: "#000",
        borderRadius: 12,
        position: "relative",
        overflow: "hidden",
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
    placeholder: {
        width: 320,
        height: 240,
        background: "#222",
        color: "#aaa",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        borderRadius: 12,
    },
    hangup: {
        background: "#ff4d4d",
        color: "white",
        padding: "12px 32px",
        borderRadius: 30,
        border: "none",
        fontSize: 16,
        cursor: "pointer",
    },
};

export default VideoCall;
