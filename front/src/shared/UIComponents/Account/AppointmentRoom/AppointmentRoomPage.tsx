import './AppointmentRoomPage.css';
import '../../../Styles/PageStyle.css';
import '../../../Styles/Chat.css'
import {TopBar} from '../../TopBar/TopBar.tsx';
import {useCallback, useEffect, useRef, useState, type ChangeEvent} from 'react';
import {useNavigate, useParams} from 'react-router-dom';
import {useAuth} from '../../../../context/AuthContext.tsx';

import {getAppointment, getAppointmentDocuments, updateAppointment} from '../../../../api/appointments.ts';
import {uploadAppointmentFile} from '../../../../api/messages.ts';
import {getErrorMessage} from '../../../../api/errors.ts';
import {MedicalDocumentPopUp, type DocType} from './MedicalDocumentPopUp.tsx';
import {RatingPopUp} from './RatingPopUp.tsx';
import {PopUp} from '../../PopUp/PopUp.tsx';
import {useChatSocket} from '../../../Hooks/UseChatSocket.ts';
import {useVideoCall} from '../../../Hooks/UseVideoCall.ts';
import {ChatBubble} from '../../Chat/ChatBubble.tsx';
import {MAX_MESSAGE_LENGTH} from "../../../../constants.ts";
import {downloadFile} from '../../../../api/api.ts';
import type {Appointment, MedicalDocument} from '../../../../types.ts';

type NoteField = 'advice' | 'notes';

export function AppointmentRoomPage() {
    const {id = ''} = useParams();
    const navigate = useNavigate();
    const {user} = useAuth();
    const isDoctor = user?.role === 'doctor';
    const [advice, setAdvice] = useState('');
    const [notes, setNotes] = useState('');
    const [appointment, setAppointment] = useState<Appointment | null>(null);
    const [error, setError] = useState('');
    const [ending, setEnding] = useState(false);
    const [documents, setDocuments] = useState<MedicalDocument[]>([]);

    const {localVideoRef, remoteVideoRef, connected, micOn, camOn, toggleMic, toggleCam, visitEnded,
        notifyVisitEnded, hasLocalMedia, mediaError, connectionError} = useVideoCall(id, isDoctor);

    const {messages, sendMessage, error: messagesError} = useChatSocket('appointment', id);

    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const bottomRef = useRef<HTMLDivElement | null>(null);
    const [input, setInput] = useState('');
    const [docPopup, setDocPopup] = useState<DocType | null>(null);

    const [showConfirmEnd, setShowConfirmEnd] = useState(false);
    const [showRating, setShowRating] = useState(false);
    const screenError = error || messagesError || mediaError || connectionError;

    function closeConfirmEnd() {
        setShowConfirmEnd(false);
        setError('');
    }

    const loadDocuments = useCallback(async () => {
        if (!isDoctor) return;
        try {
            setDocuments(await getAppointmentDocuments(Number(id)));
        } catch {
            setError('Nie udało się pobrać wystawionych dokumentów.');
        }
    }, [id, isDoctor]);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void loadDocuments();
    }, [loadDocuments]);

    async function handleOpenDocument(document: MedicalDocument) {
        if (!document.pdf) return;
        try {
            await downloadFile(document.pdf, `${document.doc_type_display}.pdf`);
        } catch {
            setError('Nie udało się pobrać dokumentu.');
        }
    }

    useEffect(() => {
        bottomRef.current?.scrollIntoView({behavior: 'smooth'});
    }, [messages]);

    useEffect(() => {
        let ignore = false;
        getAppointment(id)
            .then(data => {
                if (ignore) return;
                if (isDoctor) {
                    setAdvice(data.advice || '');
                    setNotes(data.notes || '');
                }
                setAppointment(data);
            })
            .catch(() => {
                if (!ignore) setError('Nie udało się pobrać danych wizyty.');
            });

        return () => { ignore = true; };
    }, [id, isDoctor]);

    async function saveField(field: NoteField, value: string) {
        if (!appointment) return;
        try {
            await updateAppointment(id, {[field]: value});
            setError('');
        } catch {
            setError('Nie udało się zapisać notatek z wizyty.');
        }
    }

    function handleSend() {
        if (!input) return;
        if (input.length > MAX_MESSAGE_LENGTH) {
            setError(`Wiadomość może mieć najwyżej 500 znaków.`);
            return;
        }

        if (sendMessage(input)) {
            setInput('');
            setError('');
        } else {
            setError('Nie udało się nawiązać połączenia z czatem.');
        }
    }

    async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;

        setError('');;
        try {
            await uploadAppointmentFile(id, file);
        } catch (er) {
            setError(getErrorMessage(er, 'Nie udało się wysłać pliku.'));
        }
    }

    async function handleEndVisit() {
        if (ending) return;
        setError('');
        setEnding(true);
        try {
            try {
                await updateAppointment(id, {advice, notes});
            } catch {
                setError('Nie udało się zapisać notatek, więc wizyta nie została zakończona.');
                return;
            }

            try {
                await updateAppointment(id, {status: 'completed'});
            } catch {
                setError('Nie udało się zakończyć wizyty.');
                return;
            }

            if (!notifyVisitEnded()) {
                setError('Nie udało się powiadomić pacjenta o zakończeniu wizyty.');
                return;
            }

            navigate('/doctor');
        } finally {
            setEnding(false);
        }
    }

    function handlePatientLeave() {
        if (visitEnded) {
            setShowRating(true);
        } else {
            navigate('/patient');
        }
    }

    return (
        <div className="page">
            <TopBar logoTo={isDoctor ? '/doctor' : '/patient'} />

            <main className="roomMain">
                <div className="videoColumn">
                    {visitEnded && !isDoctor && (<div className="endedBanner">Lekarz zakończył wizytę</div>)}

                    {screenError && <p className="formError">{screenError}</p>}

                    <div className="videoArea">
                        <video ref={remoteVideoRef} className="remoteVideo" autoPlay playsInline/>
                        {!connected && <p className="muted waitingInfo">Oczekiwanie na drugiego uczestnika rozmowy...</p>}
                        <video ref={localVideoRef} className="localVideo" autoPlay playsInline muted/>
                    </div>

                    <div className="row rowCenter">
                        <button className="whiteBtn"
                                type="button"
                                disabled={!hasLocalMedia}
                                onClick={toggleMic}>
                            {micOn ? 'Wycisz' : 'Włącz mikrofon'}
                        </button>
                        <button className="whiteBtn"
                                type="button"
                                disabled={!hasLocalMedia}
                                onClick={toggleCam}>
                            {camOn ? 'Wyłącz kamerę' : 'Włącz kamerę'}
                        </button>
                        <button type="button" className="redBtn"
                                onClick={isDoctor ? () => setShowConfirmEnd(true) : handlePatientLeave}>
                            Zakończ wizytę
                        </button>
                    </div>

                    {isDoctor && (
                        <>
                            <div className="row rowCenter">
                                <button type="button" className="linkBtn" onClick={() => setDocPopup('prescription')}>
                                    + Dodaj receptę
                                </button>
                                <button type="button" className="linkBtn" onClick={() => setDocPopup('referral')}>
                                    + Dodaj skierowanie
                                </button>
                                <button type="button" className="linkBtn" onClick={() => setDocPopup('sick_leave')}>
                                    + Dodaj zwolnienie lekarskie
                                </button>
                            </div>

                            <div className="fieldRow">
                                <div className="form">
                                    <label>Porada ambulatoryjna (widoczna dla pacjenta)</label>
                                    <textarea className="input"
                                              value={advice}
                                              onChange={(event) => setAdvice(event.target.value)}
                                              onBlur={() => saveField('advice', advice)}/>
                                </div>
                                <div className="form">
                                    <label>Notatki z wizyty (tylko dla Ciebie)</label>
                                    <textarea className="input"
                                              value={notes}
                                              onChange={(event) => setNotes(event.target.value)}
                                              onBlur={() => saveField('notes', notes)}/>
                                </div>
                            </div>

                            <span className="label">Wystawione dokumenty</span>
                            <div className="scrollBox">
                                {documents.length === 0 ? (
                                    <p className="muted">Brak wystawionych dokumentów.</p>
                                ) : (
                                    documents.map(document => {
                                        const label = document.doc_type_display + (document.drug_display ? `: ${document.drug_display}` : '');
                                        return (
                                            <div key={document.id}>
                                                {document.pdf ? (
                                                    <button type="button" className="linkBtn"
                                                            onClick={() => void handleOpenDocument(document)}>
                                                        {label}
                                                    </button>
                                                ) : (
                                                    <span className="muted">{label} — brak pliku</span>
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </>
                    )}
                </div>

                <aside className="card tallCard">
                    <div className="chatHeader">Czat wizyty</div>

                    <div className="scrollArea chatMessages">
                        {messages.map(message => (
                            <ChatBubble
                                key={message.id}
                                message={message}
                                isMine={message.sender === user?.id}
                                senderName={message.sender_role === 'doctor' ? appointment?.doctor_name : appointment?.patient_name}
                                timeFormat="dd.MM, HH:mm"
                            />
                        ))}
                        <div ref={bottomRef}/>
                    </div>

                    <div className="form chatInputRow">
                        <input ref={fileInputRef}
                               type="file" hidden
                               accept=".pdf,.jpg,.jpeg,.png"
                               onChange={handleFileChange}
                        />
                        <button className="linkBtn"
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                        >
                            Wyślij załącznik
                        </button>
                        <input className="input" type="text"
                               placeholder="Napisz wiadomość..."
                               value={input}
                               maxLength={MAX_MESSAGE_LENGTH}
                               onChange={(changeEvent) => setInput(changeEvent.target.value)}
                               onKeyDown={(keyEvent) => keyEvent.key === 'Enter' && handleSend()}
                        />
                        <button className="greenBtn fullWidth"
                                type="button"
                                onClick={handleSend}>
                            Wyślij
                        </button>
                    </div>
                </aside>

                {docPopup && (
                    <MedicalDocumentPopUp
                        appointmentId={Number(id)}
                        docType={docPopup}
                        onCreated={() => void loadDocuments()}
                        onClose={() => setDocPopup(null)}
                    />
                )}

                {showConfirmEnd && (
                    <PopUp title="Zakończ wizytę" onClose={closeConfirmEnd}>
                        <p style={{margin: 0, textAlign: 'center'}}>Czy na pewno chcesz zakończyć wizytę?</p>
                        {error && <p className="formError">{error}</p>}
                        <div className="row rowCenter">
                            <button className="redBtn"
                                    type="button"
                                    onClick={handleEndVisit}
                            >
                                Tak
                            </button>
                            <button className="linkBtn"
                                    type="button"
                                    onClick={closeConfirmEnd}
                            >
                                Anuluj
                            </button>
                        </div>
                    </PopUp>
                )}

                {showRating && (
                    <RatingPopUp
                        doctorName={appointment?.doctor_name ?? ''}
                        appointmentId={Number(id)}
                        onClose={() => navigate('/patient')}
                    />
                )}
            </main>
        </div>
    );
}