import '../../Styles/Chat.css';
import {useState} from 'react';
import {DateTime} from 'luxon';
import {downloadFile} from '../../../api/api.ts';
import type {ChatMessage} from '../../../types.ts';

type ChatBubbleProps = {
    message: ChatMessage;
    isMine: boolean;
    senderName?: string;
    timeFormat?: string;
};

export function ChatBubble({message, isMine, senderName, timeFormat = 'HH:mm'}: ChatBubbleProps) {
    const fileName = message.file_name ?? 'załącznik';
    const [error, setError] = useState('');

    async function handleDownload() {
        if (!message.file) return;
        setError('');
        try {
            await downloadFile(message.file, fileName);
        } catch {
            setError('Nie udało się pobrać załącznika.');
        }
    }

    return (
        <div className={`chatBubble ${isMine ? 'chatBubbleMine' : ''}`}>
            {senderName && <div className="muted">{senderName}</div>}

            {message.file ? (
                <>
                    <button type="button" className="linkBtn" onClick={() => void handleDownload()}>
                        {fileName}
                    </button>
                    {error && <div className="formError">{error}</div>}
                </>
            ) : (
                <div>{message.message}</div>
            )}

            <div className="muted chatBubbleTime">
                {DateTime.fromISO(message.created_at).toFormat(timeFormat)}
            </div>
        </div>
    );
}