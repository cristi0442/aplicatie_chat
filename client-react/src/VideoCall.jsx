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

// ⚠️ PUNE APP ID-UL TĂU AICI
const APP_ID = "6d8c5d4ae36048078acd744458928be4";

export const VideoCall = ({ channelName, onEndCall }) => {
    const client = useRTCClient(AgoraRTC.createClient({ codec: "vp8", mode: "rtc" }));

    return (
        <AgoraRTCProvider client={client}>
            <CallInterface channelName={channelName} onEndCall={onEndCall} />
        </AgoraRTCProvider>
    );
};

const CallInterface = ({ channelName, onEndCall }) => {
    // 1. CONECTARE (fără UID, serverul decide)
    useJoin({
        appid: APP_ID,
        channel: channelName,
        token: null
    });

    // 2. PRELUARE TRACK-URI LOCALE
    const { localMicrophoneTrack, isLoading: isLoadingMic } = useLocalMicrophoneTrack();
    const { localCameraTrack, isLoading: isLoadingCam } = useLocalCameraTrack();

    // 3. PUBLICARE
    usePublish([localMicrophoneTrack, localCameraTrack]);

    // 4. PRELUARE UTILIZATORI REMOTE
    const remoteUsers = useRemoteUsers();

    // ZONA DE LOADING
    if (isLoadingMic || isLoadingCam) {
        return (
            <div style={styles.overlay}>
                <h2 style={{color: 'white'}}>Se pornește camera...</h2>
            </div>
        );
    }

    return (
        <div style={styles.overlay}>
            <div style={styles.container}>
                <h3 style={{color: 'white', marginBottom: '15px'}}>
                    În apel: {channelName}
                </h3>

                <div style={styles.grid}>
                    {/* --- VIDEO LOCAL (TU) --- */}
                    <div style={styles.videoCard}>
                        {/* Folosim componenta noastră custom "AgoraPlayer" */}
                        <AgoraPlayer track={localCameraTrack} text="Tu" />
                    </div>

                    {/* --- VIDEO REMOTE (PARTENERI) --- */}
                    {remoteUsers.map((user) => (
                        <div key={user.uid} style={styles.videoCard}>
                            <AgoraPlayer track={user.videoTrack} text="Partener" />
                        </div>
                    ))}

                    {remoteUsers.length === 0 && (
                        <div style={styles.placeholderCard}>
                            <p style={{color: '#aaa', textAlign: 'center'}}>Așteptăm partenerul...</p>
                        </div>
                    )}
                </div>

                <button onClick={onEndCall} style={styles.hangupBtn}>
                    Închide Apelul
                </button>
            </div>
        </div>
    );
};

// --- COMPONENTA MAGICĂ (Fix-ul pentru erorile tale) ---
// Aceasta foloseste metoda .play() direct din documentatia Agora Core
// Nu folosim <LocalUser> care dadea erori de React.
const AgoraPlayer = ({ track, text }) => {
    const vidDiv = useRef(null);

    useEffect(() => {
        if (track && vidDiv.current) {
            // Documentatia spune: track.play(element)
            track.play(vidDiv.current);
        }
        return () => {
            // Cleanup (nu oprim track-ul local ca sa nu il distrugem, dar curatam div-ul)
        };
    }, [track]);

    return (
        <div
            ref={vidDiv}
            style={{ width: "100%", height: "100%", position: "relative", overflow: "hidden" }}
        >
            <span style={styles.label}>{text}</span>
        </div>
    );
};

// STILURI
const styles = {
    overlay: {
        position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
        backgroundColor: 'rgba(0,0,0,0.95)', zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center'
    },
    container: {
        display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%'
    },
    grid: {
        display: 'flex', flexWrap: 'wrap', gap: '20px', justifyContent: 'center', marginBottom: '30px'
    },
    videoCard: {
        width: '320px', height: '240px', backgroundColor: '#000',
        borderRadius: '12px', overflow: 'hidden', position: 'relative', border: '2px solid #333'
    },
    placeholderCard: {
        width: '320px', height: '240px', backgroundColor: '#222',
        borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px dashed #555'
    },
    label: {
        position: 'absolute', bottom: '10px', left: '10px',
        color: 'white', background: 'rgba(0,0,0,0.7)', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', zIndex: 10, pointerEvents: 'none'
    },
    hangupBtn: {
        backgroundColor: '#ff4d4d', color: 'white', padding: '12px 30px',
        border: 'none', borderRadius: '30px', fontSize: '16px', cursor: 'pointer', fontWeight: 'bold',
        boxShadow: '0 4px 10px rgba(255, 77, 77, 0.4)'
    }
};

export default VideoCall;