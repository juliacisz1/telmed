import './AppointmentDetailsPage.css';
import '../../../Styles/PageStyle.css';
import '../../../Styles/Chat.css'
import {useEffect, useRef, useState} from 'react';
import {useNavigate, useParams} from 'react-router-dom';
import {useAuth} from '../../../../context/AuthContext.tsx';
import {getAppointment, getAppointmentDocuments} from '../../../../api/appointments.ts';
import {getAppointmentMessages} from '../../../../api/messages.ts';
import {type Appointment, type ChatMessage, type MedicalDocument, appointmentStatus} from '../../../../types.ts';
import {AppointmentPopup} from './AppointmentPopUp.tsx';
import {RatingPopUp} from '../AppointmentRoom/RatingPopUp.tsx';
import {ChatBubble} from '../../Chat/ChatBubble.tsx';
import {TopBar} from '../../TopBar/TopBar.tsx';
import {DateTime} from 'luxon';
import {StatusBadge} from "./StatusBadge.tsx";
import {downloadFile} from "../../../../api/api.ts";

export function AppointmentDetailsPage() {
    const {user} = useAuth();
    const {id = ''} = useParams();
    const navigate = useNavigate();
    const [appointment, setAppointment] = useState<Appointment | null>(null);
    const [error, setError] = useState('');
    const [popupMode, setPopupMode] = useState<'reschedule' | 'cancel' | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [documents, setDocuments] = useState<MedicalDocument[]>([]);
    const [showRating, setShowRating] = useState(false);
    const requestId = useRef(0);
    const isDoctor = user?.role === 'doctor';


    const canModifyAppointment = appointment !== null && DateTime.fromISO(appointment.start_time) > DateTime.now();

    const fetchAppointment = async () => {
        const currentRequest = ++requestId.current;
        try {
            const data = await getAppointment(id);
            if (currentRequest !== requestId.current) return;
            setAppointment(data);
            setError('');
        } catch {
            if (currentRequest !== requestId.current) return;
            setError('Nie udało się pobrać danych wizyty.');
        }
    };

    async function handleOpenDocument(doc: MedicalDocument) {
        if (!doc.pdf) return;
        setError('');
        try {
            await downloadFile(doc.pdf, `${doc.doc_type_display}.pdf`);
        } catch {
            setError('Nie udało się pobrać dokumentu.');
        }
    }

    useEffect(() => {
        let cancelled = false;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchAppointment()
        getAppointmentMessages(id)
            .then(data => {
                if (!cancelled) setMessages(data);
            })
            .catch(() => {
                if (!cancelled) setError('Nie udało się pobrać przebiegu wizyty.');
            });

        getAppointmentDocuments(id)
            .then(data => {
                if (!cancelled) setDocuments(data);
            })
            .catch(() => {
                if (!cancelled) setError('Nie udało się pobrać wystawionych dokumentów.');
            });

        return () => { cancelled = true; };
    }, [id]);

    return (
        <div className="page">
            <TopBar logoTo={isDoctor ? '/doctor' : '/patient'}>
                <button className="greenBtn"
                        type='button'
                        onClick={() => navigate(-1)}>
                    Powrót
                </button>
            </TopBar>

            <main className="main">
                {!appointment && <p>{error}</p>}

                {appointment && (
                    <section className="card narrowCard">
                        <h1>Szczegóły wizyty</h1>

                        {error && <p className="formError">{error}</p>}

                        <div className="visitDetailsRow">
                            <span className="label">{isDoctor ? 'Pacjent' : 'Lekarz'}</span>
                            {isDoctor ? (
                                <button className="linkBtn"
                                        type="button"
                                        onClick={() => navigate(`/doctor/patients/${appointment.patient}`)}
                                >
                                    {appointment.patient_name}
                                </button>
                            ) : (
                                <button className="linkBtn"
                                        type="button"
                                        onClick={() => navigate(`/doctors/${appointment.doctor}`)}
                                >
                                    {appointment.doctor_name}
                                </button>
                            )}
                        </div>

                        <div className="visitDetailsRow">
                            <span className="label">Data</span>
                            <span className="rowTitle">
                                {DateTime.fromISO(appointment.start_time).toFormat('dd.MM.yyyy')}
                            </span>
                        </div>

                        <div className="visitDetailsRow">
                            <span className="label">Godzina</span>
                            <span className="rowTitle">
                                {DateTime.fromISO(appointment.start_time).toFormat('HH:mm')}
                                {' – '}
                                {DateTime.fromISO(appointment.end_time).toFormat('HH:mm')}
                            </span>
                        </div>

                        <div className="visitDetailsRow">
                            <span className="label">Status</span>
                            <StatusBadge appointment={appointment}/>
                        </div>

                        {documents.length > 0 && (
                            <div className="visitTextBlock">
                                <span className="label">Wystawione dokumenty</span>
                                {documents.map(document => (
                                    document.pdf ? (
                                        <button key={document.id}
                                                className="linkBtn"
                                                type="button"
                                                onClick={() => void handleOpenDocument(document)}
                                        >
                                            {document.doc_type_display}{document.drug_display ? `: ${document.drug_display}` : ''}
                                        </button>
                                    ) : (
                                        <span key={document.id} className="muted">
                                            {document.doc_type_display} Nie udało się wygenerować pliku</span>
                                    )
                                ))}
                            </div>
                        )}

                        {appointment.advice && (
                            <div className="visitTextBlock">
                                <span className="label">Porada ambulatoryjna</span>
                                <p className="visitTextContent">{appointment.advice}</p>
                            </div>
                        )}

                        {isDoctor && appointment.notes && (
                            <div className="visitTextBlock">
                                <span className="label">Notatki (prywatne)</span>
                                <p className="visitTextContent">{appointment.notes}</p>
                            </div>
                        )}

                        {appointment.status !== 'cancelled' && canModifyAppointment && (
                            <div className="row">
                                {appointmentStatus(appointment) === 'booked' && (
                                    <button className="greenBtn"
                                            type="button"
                                            onClick={() => setPopupMode('reschedule')}
                                    >
                                        Edytuj wizytę
                                    </button>
                                )}
                                <button className="whiteBtn"
                                        type="button"
                                        onClick={() => setPopupMode('cancel')}
                                >
                                    Anuluj wizytę
                                </button>
                            </div>
                        )}

                        {!isDoctor && appointmentStatus(appointment) === 'completed' && !appointment.has_review && (
                            <div className="row">
                                <button className="greenBtnSmall"
                                        type="button"
                                        onClick={() => setShowRating(true)}
                                >
                                    Oceń wizytę
                                </button>
                            </div>
                        )}

                        {appointmentStatus(appointment) === 'completed' && messages.length > 0 && (
                            <div className="visitHistory">
                                <h2>Przebieg wizyty</h2>
                                <div className="scrollBox visitHistoryChat">
                                    {messages.map(message => (
                                        <ChatBubble
                                            key={message.id}
                                            message={message}
                                            isMine={message.sender === user?.id}
                                            senderName={message.sender_role === 'doctor' ? appointment.doctor_name : appointment.patient_name}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </section>
                )}

                {popupMode && appointment && (
                    <AppointmentPopup
                        appointment={appointment}
                        mode={popupMode}
                        onClose={() => setPopupMode(null)}
                        onChanged={fetchAppointment}
                    />
                )}

                {showRating && appointment && (
                    <RatingPopUp
                        doctorName={appointment.doctor_name}
                        appointmentId={appointment.id}
                        onClose={() => {
                            setShowRating(false);
                            fetchAppointment();
                        }}
                    />
                )}
            </main>
        </div>
    );
}