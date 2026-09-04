import './PatientsListPage.css';
import '../../../shared/Styles/PageStyle.css';
import {TopBar} from '../../../shared/UIComponents/TopBar/TopBar.tsx';
import {useCallback, useEffect, useRef, useState, type ChangeEvent} from 'react';
import {useNavigate, useParams} from 'react-router-dom';
import {getDoctorPatients, getAppointments, createAppointment} from '../../../api/appointments.ts';
import {createConversation} from '../../../api/messages.ts';
import {getErrorMessage, getErrorStatus} from '../../../api/errors.ts';
import {type Appointment, type DoctorPatient, type VisitFilter, filterAppointments} from '../../../types.ts';
import {useAuth} from '../../../context/AuthContext.tsx';
import {DateTime} from 'luxon';
import {StatusBadge} from "../../../shared/UIComponents/Account/appointments/StatusBadge.tsx";
import {PopUp} from "../../../shared/UIComponents/PopUp/PopUp.tsx";
import {DEFAULT_VISIT_DURATION, DURATION_STEP_MINUTES} from "../../../constants.ts";
import {validateDuration} from "../../../api/validation.ts";

export function PatientDetailsPage() {
    const {id = ''} = useParams();
    const navigate = useNavigate();
    const {user} = useAuth();

    const defaultDuration = String(user?.default_duration ?? DEFAULT_VISIT_DURATION);

    const [patient, setPatient] = useState<DoctorPatient | null>(null);
    const [visits, setVisits] = useState<Appointment[]>([]);
    const [error, setError] = useState('');
    const [filter, setFilter] = useState<VisitFilter>({
        showBooked: false,
        showCompleted: true,
        showCancelled: false,
        dateFrom: '',
        dateTo: '',
    });
    const [showAddVisit, setShowAddVisit] = useState(false);
    const [visitForm, setVisitForm] = useState({
        date: '',
        time: '',
        duration: defaultDuration
    });
    const [conflictMessage, setConflictMessage] = useState('');
    const [creating, setCreating] = useState(false);
    const [booking, setBooking] = useState(false);

    const newVisitDuration = Number(visitForm.duration);
    const durationError = validateDuration(visitForm.duration);
    const requestId = useRef(0);

    const fetchData = useCallback(async () => {
        const currentRequest = ++requestId.current;
        setError('');

        try {
            const patients = await getDoctorPatients();
            if (currentRequest !== requestId.current) return;
            setPatient(patients.find(candidate => candidate.id === Number(id)) ?? null);
        } catch {
            if (currentRequest !== requestId.current) return;
            setError('Nie udało się pobrać danych pacjenta.');
        }

        try {
            const appointments = await getAppointments();
            if (currentRequest !== requestId.current) return;
            setVisits(appointments.filter(appointment => appointment.patient === Number(id)));
        } catch {
            if (currentRequest !== requestId.current) return;
            setVisits([]);
            setError('Nie udało się pobrać historii wizyt.');
        }
    }, [id]);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void fetchData();
    }, [fetchData]);

    function handleVisitChange(event: ChangeEvent<HTMLInputElement>) {
        setVisitForm({...visitForm, [event.target.name]: event.target.value});
    }

    function handleFilterChange(event: ChangeEvent<HTMLInputElement>) {
        const {name, type, value, checked} = event.target;
        setFilter(prev => ({...prev, [name]: type === 'checkbox' ? checked : value}));
    }

    async function sendVisit(confirmConflict: boolean) {
        const start = DateTime.fromISO(`${visitForm.date}T${visitForm.time}`);
        const end = start.plus({minutes: newVisitDuration});

        if (!start.isValid || !end.isValid) {
            setError('Podaj poprawną datę, godzinę i czas trwania wizyty.');
            return;
        }

        setBooking(true);
        try {
            await createAppointment({
                patient: Number(id),
                start_time: start.toISO(),
                end_time: end.toISO(), ...(confirmConflict ? {confirm_conflict: true} : {}),
            });
            setConflictMessage('');
            setShowAddVisit(false);
            setVisitForm({date: '', time: '', duration: defaultDuration});
            void fetchData();
        } catch (er) {
            if (getErrorStatus(er) === 409) {
                setConflictMessage(getErrorMessage(er, 'Masz już wizytę w tym czasie.'));
                return;
            }
            setError(getErrorMessage(er, 'Nie udało się dodać wizyty.'));
        } finally {
            setBooking(false);
        }
    }

    async function handleAddVisit() {
        if (creating || booking) return;

        if (!visitForm.date || !visitForm.time) {
            setError('Podaj datę i godzinę wizyty.');
            return;
        }
        if (durationError) {
            setError(durationError);
            return;
        }
        setError('');

        await sendVisit(false);
    }

    async function handleSendMessage() {
        if (creating || booking) return;

        setError('');
        setCreating(true);
        try {
            const conversation = await createConversation({patient: Number(id)});
            navigate('/doctor/messages', {state: {conversationId: conversation.id}});
        } catch {
            setError('Nie udało się otworzyć rozmowy.');
        } finally {
            setCreating(false);
        }
    }

    const filteredVisits = filterAppointments(visits, filter);

    return (
        <div className="page">
            <TopBar logoTo="/doctor">
                <button className="greenBtn"
                        type='button'
                        onClick={() => navigate('/doctor/patients')}>
                    Powrót do listy pacjentów
                </button>
            </TopBar>

            <main className="patientsMain">

                {!patient && (error ? <p className="formError">{error}</p> : <p className="muted">Nie znaleziono pacjenta.</p>)}

                {patient && (
                    <>
                        <h1>{patient.first_name} {patient.last_name}</h1>

                        <section className="card">
                            <div className="patientInfoRow">
                                <span className="label">E-mail</span>
                                <span>{patient.email}</span>
                            </div>
                            <div className="patientInfoRow">
                                <span className="label">Data urodzenia</span>
                                <span>{patient.date_of_birth
                                    ? DateTime.fromISO(patient.date_of_birth).toFormat('dd.MM.yyyy')
                                    : '–'}</span>
                            </div>

                            <div className="row">
                                <button className="greenBtnSmall"
                                        type="button"
                                        onClick={handleSendMessage}
                                >
                                    Wyślij wiadomość
                                </button>
                                <button className="linkBtn"
                                        type="button"
                                        onClick={() => setShowAddVisit(!showAddVisit)}
                                >
                                    + Dodaj wizytę
                                </button>
                            </div>

                            {showAddVisit && (
                                <div className="row">

                                    <label>Data</label>
                                    <input className="input smallInput"
                                           type="date"
                                           name="date"
                                           value={visitForm.date}
                                           onChange={handleVisitChange}
                                    />

                                    <label>Godzina</label>
                                    <input className="input smallInput"
                                           type="time"
                                           name="time"
                                           value={visitForm.time}
                                           onChange={handleVisitChange}
                                    />

                                    <label>Czas trwania (min)</label>
                                    <input className="input smallInput"
                                           type="number" name="duration"
                                           min={DURATION_STEP_MINUTES}
                                           step={DURATION_STEP_MINUTES}
                                           value={visitForm.duration}
                                           onChange={handleVisitChange}
                                    />

                                    <button className="greenBtnSmall"
                                            type="button"
                                            onClick={handleAddVisit}
                                            disabled={booking || durationError !== null}
                                    >
                                        {booking ? 'Zapisywanie...' : 'Zapisz wizytę'}
                                    </button>
                                </div>
                            )}
                            {error && <p className="formError">{error}</p>}
                        </section>

                        <div className="row">
                            <div className="row">
                                <label>Od</label>
                                <input className="input smallInput"
                                       type="date"
                                       name="dateFrom"
                                       value={filter.dateFrom}
                                       onChange={handleFilterChange}
                                />

                                <label>Do</label>
                                <input className="input smallInput"
                                       type="date"
                                       name="dateTo"
                                       value={filter.dateTo}
                                       onChange={handleFilterChange}
                                />
                            </div>
                            <div className="row">
                                <label className="checkbox">
                                    <input type="checkbox"
                                           name="showBooked"
                                           checked={filter.showBooked} onChange={handleFilterChange}
                                    />
                                    Umówione
                                </label>
                                <label className="checkbox">
                                    <input type="checkbox"
                                           name="showCompleted"
                                           checked={filter.showCompleted} onChange={handleFilterChange}
                                    />
                                    Zrealizowane
                                </label>
                                <label className="checkbox">
                                    <input type="checkbox"
                                           name="showCancelled"
                                           checked={filter.showCancelled} onChange={handleFilterChange}
                                    />
                                    Anulowane
                                </label>
                            </div>
                        </div>

                        <h2>Wizyty</h2>
                        {!error && filteredVisits.length === 0 && <p className="muted">Brak wizyt.</p>}
                        {filteredVisits.map(appointment => (
                            <div key={appointment.id} className="card rowCard"
                                 onClick={() => navigate(`/doctor/appointment/${appointment.id}`)}>
                                <div className="rowTitle">
                                    {DateTime.fromISO(appointment.start_time).toFormat('cccc, dd.MM.yyyy, HH:mm')}
                                    {' – '}
                                    {DateTime.fromISO(appointment.end_time).toFormat('HH:mm')}
                                </div>
                                <StatusBadge appointment={appointment}/>
                            </div>
                        ))}

                        {conflictMessage && (
                            <PopUp title="Nakładające się wizyty" onClose={() => setConflictMessage('')}>
                                <p style={{margin: 0, textAlign: 'center'}}>{conflictMessage}</p>
                                <div className="row rowEnd">
                                    <button className="whiteBtn"
                                            type="button"
                                            onClick={() => setConflictMessage('')}
                                    >
                                        Anuluj
                                    </button>
                                    <button className="greenBtn"
                                            type="button"
                                            onClick={() => void sendVisit(true)}
                                    >
                                        Umów mimo to
                                    </button>
                                </div>
                            </PopUp>
                        )}
                    </>
                )}
            </main>
        </div>
    );
}