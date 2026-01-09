import React, { useEffect } from "react";
import {
    AgoraRTCProvider,
    useJoin,
    useLocalCameraTrack,
    useLocalMicrophoneTrack,
    usePublish,
    useRemoteUsers,
    useRTCClient,
    RemoteUser,
    LocalUser
} from "agora-rtc-react";
import AgoraRTC from "agora-rtc-sdk-ng";

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
    // 1. Conectare la canal
    useJoin({ appid: APP_ID, channel: channelName, token: null });

    // 2. Preluam track-urile (Video si Audio)
    const { localMicrophoneTrack, isLoading: isLoadingMic } = useLocalMicrophoneTrack();
    const { localCameraTrack, isLoading: isLoadingCam } = useLocalCameraTrack();

    // 3. Publicam DOAR cand track-urile sunt gata (nu sunt null)
    // Am reparat si eroarea de scriere "localLocal" de data trecuta
    usePublish([localMicrophoneTrack, localCameraTrack]);

    const remoteUsers = useRemoteUsers();

    // 4. Verificare critica: Daca camera inca se incarca, afisam un mesaj, nu ecranul negru
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
                    {/* Videoul MEU */}
                    <div style={styles.videoCard}>
                        <LocalUser
                            audioTrack={localMicrophoneTrack}
                            cameraTrack={localCameraTrack}
                            micOn={true}
                            cameraOn={true}
                            style={{ width: '100%', height: '100%' }}
                        />
                        <span style={styles.label}>Tu</span>
                    </div>

                    {/* Videoul LUI (Partenerul) */}
                    {remoteUsers.map((user) => (
                        <div key={user.uid} style={styles.videoCard}>
                            <RemoteUser user={user} style={{ width: '100%', height: '100%' }} />
                            <span style={styles.label}>Partener</span>
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
        color: 'white', background: 'rgba(0,0,0,0.7)', padding: '4px 8px', borderRadius: '4px', fontSize: '12px'
    },
    hangupBtn: {
        backgroundColor: '#ff4d4d', color: 'white', padding: '12px 30px',
        border: 'none', borderRadius: '30px', fontSize: '16px', cursor: 'pointer', fontWeight: 'bold'
    }
};

export default VideoCall;