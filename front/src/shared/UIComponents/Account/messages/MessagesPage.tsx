import './MessagesPage.css';
import '../../../Styles/Chat.css'
import '../../../Styles/PageStyle.css';
import {useEffect, useRef, useState, type ChangeEvent} from 'react';
import {useNavigate, useLocation} from 'react-router-dom';
import {useAuth} from '../../../../context/AuthContext.tsx';
import {getConversations, createConversation, uploadConversationFile} from '../../../../api/messages.ts';
import {getErrorMessage} from '../../../../api/errors.ts';
import SearchDropdown from '../../SearchDropdown/SearchDropdown.tsx';
import {TopBar} from '../../TopBar/TopBar.tsx';
import {useChatSocket} from '../../../Hooks/UseChatSocket.ts';
import {useAppointments} from '../../../Hooks/UseAppointments.ts';
import {ChatBubble} from '../../Chat/ChatBubble.tsx';
import {type SearchItem, type Conversation, hadAppointmentTogether} from '../../../../types.ts';
import {MAX_MESSAGE_LENGTH} from "../../../../constants.ts";

export function MessagesPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const {user} = useAuth();
    const isDoctor = user?.role === 'doctor';

    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selected, setSelected] = useState<Conversation | null>(null);
    const [input, setInput] = useState('');
    const [error, setError] = useState('');

    const creatingConversation = useRef(false);
    const navigationStateUsed = useRef(false);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const bottomRef = useRef<HTMLDivElement | null>(null);

    const {appointments, error: appointmentsError} = useAppointments();

    const {messages, sendMessage, error: messagesError} =
        useChatSocket('conversation', selected?.id ?? null);

    useEffect(() => {
        getConversations()
            .then(setConversations)
            .catch(() => setError('Nie udało się pobrać rozmów.'));
    }, []);

    const people: SearchItem[] = hadAppointmentTogether(appointments, user?.role ?? 'patient');

    useEffect(() => {
        if (navigationStateUsed.current) return;

        const conversationId = location.state?.conversationId;
        if (!conversationId) return;

        const found = conversations.find(conversation => conversation.id === conversationId);
        if (!found) return;

        navigationStateUsed.current = true;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSelected(found);
    }, [conversations, location.state]);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setInput('');
    }, [selected?.id]);

    function conversationName(conversation: Conversation): string {
        return isDoctor ? conversation.patient_name : conversation.doctor_name;
    }

    useEffect(() => {
        bottomRef.current?.scrollIntoView({behavior: 'smooth'});
    }, [messages]);

    async function handleSelectPerson(item: SearchItem) {
        if (creatingConversation.current) return;

        const personId = Number(item.id);
        const existing = conversations.find(conversation =>
            isDoctor ? conversation.patient === personId : conversation.doctor === personId);

        if (existing) {
            setSelected(existing);
            return;
        }

        creatingConversation.current = true;
        setError('');
        try {
            const conversation = await createConversation(
                isDoctor ? {patient: personId} : {doctor: personId});
            setConversations(prev =>
                prev.some(existing => existing.id === conversation.id) ? prev : [...prev, conversation]);
            setSelected(conversation);
        } catch {
            setError('Nie udało się rozpocząć rozmowy.');
        } finally {
            creatingConversation.current = false;
        }
    }

    function handleSend() {
        const text = input.trim();
        if (!text || !selected) return;
        if (text.length > MAX_MESSAGE_LENGTH) {
            setError(`Wiadomość może mieć najwyżej 500 znaków.`);
            return;
        }
        setError('');

        if (sendMessage(text)) {
            setInput('');
        } else {
            setError('Połączenie z czatem zostało przerwane.');
        }
    }

    async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file || !selected) return;

        setError('');
        try {
            await uploadConversationFile(selected.id, file);
        } catch (er) {
            setError(getErrorMessage(er, 'Nie udało się wysłać załącznika.'));
        }
    }

    function handleHeaderClick() {
        if (!selected) return;
        navigate(isDoctor ? `/doctor/patients/${selected.patient}` : `/doctors/${selected.doctor}`);
    }

    return (
        <div className="page">
            <TopBar logoTo={isDoctor ? '/doctor' : '/patient'}>
                <button className="greenBtn"
                        type='button'
                        onClick={() => navigate(-1)}>
                    Powrót
                </button>
            </TopBar>

            <main className="messagesMain">
                <aside className="leftColumn">
                    <div className="card">
                        <SearchDropdown
                            options={people}
                            placeholder={isDoctor ? 'Wyszukaj pacjenta' : 'Wyszukaj lekarza'}
                            onSelect={(item) => void handleSelectPerson(item)}
                        />
                        {appointmentsError && <p className="formError">{appointmentsError}</p>}
                    </div>

                    <div className="card tallCard">
                        <h2>Rozmowy</h2>
                        <div className="scrollArea">
                            {!error && conversations.length === 0 && <p className="muted">Brak rozmów.</p>}
                            {conversations.map(conversation => (
                                <div key={conversation.id}
                                     className={`card rowCard ${selected?.id === conversation.id ? 'rowCardActive' : ''}`}
                                     onClick={() => setSelected(conversation)}>
                                    <div className="rowTitle">{conversationName(conversation)}</div>
                                    {conversation.last_message &&
                                        <div className="muted ellipsis">{conversation.last_message}</div>}
                                </div>
                            ))}
                        </div>
                    </div>
                </aside>

                <section className="card tallCard">
                    {error && <p className="formError">{error}</p>}
                    {selected ? (
                        <>
                            <div className="chatHeader">
                                <button className="linkBtn"
                                        type="button"
                                        onClick={handleHeaderClick}
                                >
                                    {conversationName(selected)}
                                </button>
                            </div>

                            <div className="scrollArea chatMessages">
                                {messagesError && <p className="formError">{messagesError}</p>}
                                {messages.map(message => (
                                    <ChatBubble
                                        key={message.id}
                                        message={message}
                                        isMine={message.sender === user?.id}
                                        senderName={message.sender_role === 'doctor' ? selected.doctor_name : selected.patient_name}
                                        timeFormat="dd.MM, HH:mm"
                                    />
                                ))}
                                <div ref={bottomRef}/>
                            </div>

                            <div className="row chatInputRow">
                                <input ref={fileInputRef} type="file" hidden
                                       accept=".pdf,.jpg,.jpeg,.png"
                                       onChange={handleFileChange}
                                />
                                <button className="linkBtn"
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                >
                                    + Wyślij załącznik
                                </button>
                                <input className="input" type="text"
                                       placeholder="Napisz wiadomość..."
                                       value={input}
                                       maxLength={MAX_MESSAGE_LENGTH}
                                       onChange={(changeEvent) => setInput(changeEvent.target.value)}
                                       onKeyDown={(keyEvent) => keyEvent.key === 'Enter' && handleSend()}
                                />
                                <button className="greenBtnSmall"
                                        type="button"
                                        onClick={handleSend}
                                >
                                    Wyślij
                                </button>
                            </div>
                        </>
                    ) : (
                        <p className="muted chatPlaceholder">Wybierz rozmowę lub wyszukaj osobę</p>
                    )}
                </section>
            </main>
        </div>
    );
}