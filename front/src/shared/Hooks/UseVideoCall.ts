import {useCallback, useEffect, useRef, useState} from 'react';
import {default as useWebSocket, ReadyState} from "react-use-websocket";
import {getWebSocketUrl} from '../../api/api.ts';
import {ICE_SERVERS, PERMANENT_CLOSE_CODES} from '../../constants.ts';

//https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Signaling_and_video_calling

const mediaConstraints = {
    audio: true,
    video: true,
};
const useWs = (useWebSocket as any).default as typeof useWebSocket

export function useVideoCall(appointmentId: string, isDoctor: boolean) {
    const localVideoRef = useRef<HTMLVideoElement | null>(null);
    const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
    const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
    const remoteDescriptionSetRef = useRef(false);
    const makingOfferRef = useRef(false);
    const mediaReadyRef = useRef<Promise<void> | null>(null);

    const [connected, setConnected] = useState(false);
    const [micOn, setMicOn] = useState(true);
    const [camOn, setCamOn] = useState(true);
    const [visitEnded, setVisitEnded] = useState(false);
    const [hasLocalMedia, setHasLocalMedia] = useState(false);
    const [mediaError, setMediaError] = useState('');
    const [connectionError, setConnectionError] = useState('');

    const getSocketUrl = useCallback(() => getWebSocketUrl(`/ws/connection/${appointmentId}/`),
        [appointmentId],
    );

    async function addQueuedCandidates() {
        const peerConnection = peerConnectionRef.current;
        if (!peerConnection) return;
        remoteDescriptionSetRef.current = true;
        while (pendingCandidatesRef.current.length > 0) {
            const candidate = pendingCandidatesRef.current.shift();
            if (candidate) await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        }
    }

    async function handleJoinMsg() {
        const peerConnection = peerConnectionRef.current;
        if (!peerConnection) return;
        await mediaReadyRef.current;
        if (isDoctor) {
            if (makingOfferRef.current || peerConnection.signalingState !== 'stable') return;
            makingOfferRef.current = true;
            try {
                const offer = await peerConnection.createOffer();
                await peerConnection.setLocalDescription(offer);
                sendJsonMessage({type: 'offer', sdp: peerConnection.localDescription});
            } finally {
                makingOfferRef.current = false;
            }
        } else {
            sendJsonMessage({type: 'join'});
        }
    }

    async function handleVideoOfferMsg(data: {sdp?: RTCSessionDescriptionInit}) {
        const peerConnection = peerConnectionRef.current;
        if (!peerConnection || !data.sdp) return;
        await mediaReadyRef.current;

        const desc = new RTCSessionDescription(data.sdp);
        await peerConnection.setRemoteDescription(desc);
        await addQueuedCandidates();

        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        sendJsonMessage({type: 'answer', sdp: peerConnection.localDescription});
    }

    async function handleVideoAnswerMsg(data: {sdp?: RTCSessionDescriptionInit}) {
        const peerConnection = peerConnectionRef.current;
        if (!peerConnection || !data.sdp) return;

        const desc = new RTCSessionDescription(data.sdp);
        await peerConnection.setRemoteDescription(desc);
        await addQueuedCandidates();
    }

    async function handleNewICECandidateMsg(data: {candidate?: RTCIceCandidateInit}) {
        const peerConnection = peerConnectionRef.current;
        if (!peerConnection || !data.candidate) return;
        if (remoteDescriptionSetRef.current) {
            await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
        } else {
            pendingCandidatesRef.current.push(data.candidate);
        }
    }

    async function handleSignal(event: MessageEvent) {
        try {
            const data = JSON.parse(event.data);

            if (data.type === 'join') {
                await handleJoinMsg();
            } else if (data.type === 'offer') {
                await handleVideoOfferMsg(data);
            } else if (data.type === 'answer') {
                await handleVideoAnswerMsg(data);
            } else if (data.type === 'ice') {
                await handleNewICECandidateMsg(data);
            } else if (data.type === 'ended') {
                setVisitEnded(true);
            }
        } catch {
            setConnectionError('Wystąpił problem z połączeniem wideo.');
        }
    }

    const {sendJsonMessage, readyState} = useWs(getSocketUrl, {
        shouldReconnect: (event) => !PERMANENT_CLOSE_CODES.includes(event.code),
        reconnectAttempts: 10,
        reconnectInterval: 3000,
        onMessage: (event) => { void handleSignal(event); },
        onOpen: () => {void mediaReadyRef.current?.then(() => sendJsonMessage({type: 'join'}));},
        onError: () => {setConnectionError('Nie udało się nawiązać połączenia wideo.');},
    });

    useEffect(() => {
        let ignore = false;

        const peerConnection = new RTCPeerConnection({iceServers: ICE_SERVERS});
        peerConnectionRef.current = peerConnection;
        pendingCandidatesRef.current = [];
        remoteDescriptionSetRef.current = false;
        makingOfferRef.current = false;

        const remoteStream = new MediaStream();
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;

        peerConnection.ontrack = (event) => {
            remoteStream.addTrack(event.track);
            if (remoteVideoRef.current && remoteVideoRef.current.srcObject !== remoteStream) {
                remoteVideoRef.current.srcObject = remoteStream;
            }
            setConnected(true);
        };

        peerConnection.onicecandidate = (event) => {
            if (event.candidate) sendJsonMessage({type: 'ice', candidate: event.candidate});
        };

        peerConnection.onconnectionstatechange = () => {
            if (ignore) return;
            if (peerConnection.connectionState === 'failed') {
                setConnected(false);
                setConnectionError('Połączenie wideo zostało zerwane.');
            } else if (peerConnection.connectionState === 'disconnected') {
                setConnected(false);
            } else if (peerConnection.connectionState === 'connected') {
                setConnected(true);
                setConnectionError('');
            }
        };

        const requestMedia = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia(mediaConstraints);

                if (ignore) {
                    stream.getTracks().forEach(track => track.stop());
                    return;
                }

                streamRef.current = stream;
                if (localVideoRef.current) localVideoRef.current.srcObject = stream;
                stream.getTracks().forEach(track => peerConnection.addTrack(track, stream));
                setHasLocalMedia(true);
            } catch {
                if (ignore) return;
                if (isDoctor) {
                    peerConnection.addTransceiver('audio', {direction: 'recvonly'});
                    peerConnection.addTransceiver('video', {direction: 'recvonly'});
                }
                setMediaError('Brak dostępu do kamery lub mikrofonu.');
            }
        };

        mediaReadyRef.current = requestMedia();

        return () => {
            ignore = true;
            streamRef.current?.getTracks().forEach(t => t.stop());
            streamRef.current = null;
            peerConnection.close();
            peerConnectionRef.current = null;
        };
    }, [appointmentId, isDoctor, sendJsonMessage]);

    function toggleMic() {
        setMicOn(prev => {
            const next = !prev;
            streamRef.current?.getAudioTracks().forEach(t => { t.enabled = next; });
            return next;
        });
    }

    function toggleCam() {
        setCamOn(prev => {
            const next = !prev;
            streamRef.current?.getVideoTracks().forEach(track => { track.enabled = next; });
            return next;
        });
    }

    function notifyVisitEnded(): boolean {
        if (readyState !== ReadyState.OPEN) return false;
        sendJsonMessage({type: 'ended'});
        return true;
    }

    return {
        localVideoRef,
        remoteVideoRef,
        connected,
        micOn,
        camOn,
        toggleMic,
        toggleCam,
        visitEnded,
        notifyVisitEnded,
        hasLocalMedia,
        mediaError,
        connectionError,
    };
}