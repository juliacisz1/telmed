import {useCallback, useEffect, useState} from 'react';
import {getWebSocketUrl} from '../../api/api.ts';
import {getAppointmentMessages, getConversationMessages} from '../../api/messages.ts';
import type {ChatMessage} from '../../types.ts';
import {default as useWebSocket, ReadyState} from "react-use-websocket";
import {PERMANENT_CLOSE_CODES} from "../../constants.ts";


//https://channels.readthedocs.io/en/latest/tutorial/part_2.html
//https://github.com/chrisHalogen/HID-Tutorials/blob/main/django-react-chat-app/chat-frontend/src/hooks/useChat.js

type ChatKind = 'conversation' | 'appointment';

const useWs = (useWebSocket as any).default as typeof useWebSocket


export function useChatSocket(kind: ChatKind, id: number | string | null) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [error, setError] = useState('');

    const getSocketUrl = useCallback(() => {
        const socketPath = kind === 'conversation' ? `/ws/chat/${id}/` : `/ws/appointment-chat/${id}/`;
        return getWebSocketUrl(socketPath);
    }, [kind, id]);

    const {sendJsonMessage, lastMessage, readyState} = useWs(
        getSocketUrl,
        {
            shouldReconnect: (event) => !PERMANENT_CLOSE_CODES.includes(event.code),
            reconnectAttempts: 10,
            reconnectInterval: 3000,
        },
        id !== null && id !== ''
    );

    useEffect(() => {
        let ignore = false;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setError('');
        setMessages([]);

        if (id === null || id === '') return;

        const loadHistory = kind === 'conversation' ? getConversationMessages : getAppointmentMessages;

        loadHistory(id)
            .then(history => {
                if (!ignore) setMessages(history);
            })
            .catch(() => {
                if (!ignore) setError('Nie udało się pobrać wiadomości.');
            });

        return () => { ignore = true; };
    }, [kind, id]);

    useEffect(() => {
        if (lastMessage === null) return;

        const data: ChatMessage & {error?: string} = JSON.parse(lastMessage.data);

        if (data.error) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setError('Nie udało się wysłać wiadomości.');
            return;
        }
        setError('');
        setMessages(prev => [...prev, data]);
    }, [lastMessage]);

    function sendMessage(content: string): boolean {
        const text = content.trim();
        if (!text || readyState !== ReadyState.OPEN) return false;
        sendJsonMessage({message: text});
        return true;
    }

    return {messages, sendMessage, error};
}