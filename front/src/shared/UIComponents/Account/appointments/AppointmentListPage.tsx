import './AppointmentListPage.css';
import '../../../Styles/PageStyle.css';
import {useState, type ChangeEvent} from 'react';
import {useNavigate} from 'react-router-dom';
import {useAuth} from '../../../../context/AuthContext.tsx';
import {useAppointments} from '../../../Hooks/UseAppointments.ts';
import {type Appointment, filterAppointments, type SearchItem, hadAppointmentTogether} from '../../../../types.ts';
import SearchDropdown from '../../SearchDropdown/SearchDropdown.tsx';
import {TopBar} from '../../TopBar/TopBar.tsx';
import {StatusBadge} from "./StatusBadge.tsx";
import {DateTime} from 'luxon';

const DEFAULT_FILTER = {
    showBooked: true,
    showCompleted: false,
    showCancelled: false,
    dateFrom: '',
    dateTo: '',
    personSearch: '',
};

function groupLabel(startISO: string): string {
    const start = DateTime.fromISO(startISO);
    const now = DateTime.now();

    const isPast = start < now;
    const isOtherMonth = !start.hasSame(now, 'month');

    if (isPast || isOtherMonth) return start.toFormat('LLLL yyyy');
    if (start.hasSame(now, 'day')) return 'Dzisiaj';
    if (start.hasSame(now, 'week')) return 'W tym tygodniu';
    return 'Późniejsze';
}

export function AppointmentListPage() {
    const navigate = useNavigate();
    const {user} = useAuth();
    const isDoctor = user?.role === 'doctor';

    const {appointments, error} = useAppointments();

    const [draft, setDraft] = useState(DEFAULT_FILTER);
    const [applied, setApplied] = useState(DEFAULT_FILTER);

    function handleChange(event: ChangeEvent<HTMLInputElement>) {
        const {name, type, value, checked} = event.target;
        setDraft(prev => ({...prev, [name]: type === 'checkbox' ? checked : value}));
    }

    function personName(appointment: Appointment): string {
        return isDoctor ? appointment.patient_name : appointment.doctor_name;
    }

    const filtered = filterAppointments(appointments, applied)
        .filter(appointment => {
            if (!applied.personSearch.trim()) return true;
            return personName(appointment).toLowerCase()
                .includes(applied.personSearch.trim().toLowerCase());
        });

    const people: SearchItem[] = hadAppointmentTogether(appointments, user?.role ?? 'patient');

    const groups: { label: string; items: Appointment[] }[] = [];
    for (const appointment of filtered) {
        const label = groupLabel(appointment.start_time);
        const existingGroup = groups.find(group => group.label === label);

        if (existingGroup) existingGroup.items.push(appointment);
        else groups.push({label, items: [appointment]});
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

            <main className="listMain">
                <aside className="card">
                    <h3>Filtry</h3>

                    <div className="filterGroup">
                        <label className="label">{isDoctor ? 'Pacjent' : 'Lekarz'}</label>
                        <SearchDropdown
                            options={people}
                            placeholder='Imię lub nazwisko'
                            onQueryChange={(query) => setDraft(prev => ({...prev, personSearch: query}))}
                        />
                    </div>

                    <div className="filterGroup">
                        <span className="label">Status</span>
                        <label className="checkbox">
                            <input type="checkbox"
                                   name="showBooked"
                                   checked={draft.showBooked}
                                   onChange={handleChange}
                            />
                            Nadchodzące
                        </label>
                        <label className="checkbox">
                            <input type="checkbox"
                                   name="showCompleted"
                                   checked={draft.showCompleted}
                                   onChange={handleChange}
                            />
                            Zrealizowane
                        </label>
                        <label className="checkbox">
                            <input type="checkbox"
                                   name="showCancelled"
                                   checked={draft.showCancelled}
                                   onChange={handleChange}
                            />
                            Anulowane
                        </label>
                    </div>

                    <div className="filterGroup">
                        <span className="label">Zakres dat</span>
                        <label>Od</label>
                        <input className="input smallInput"
                               type="date"
                               name="dateFrom"
                               value={draft.dateFrom}
                               onChange={handleChange}
                        />
                        <label>Do</label>
                        <input className="input smallInput"
                               type="date"
                               name="dateTo"
                               value={draft.dateTo}
                               onChange={handleChange}
                        />
                        {(draft.dateFrom || draft.dateTo) && (
                            <button className="linkBtn"
                                    type="button"
                                    onClick={() => setDraft(prev => ({...prev, dateFrom: '', dateTo: ''}))}
                            >
                                Wyczyść daty
                            </button>
                        )}
                    </div>

                    <button type="button"
                            className="greenBtn"
                            onClick={() => setApplied(draft)}
                    >
                        Zastosuj filtry
                    </button>
                </aside>

                <div className="listContent">
                    <h1>Moje wizyty</h1>
                    {error ? <p className="formError">{error}</p> : groups.length === 0 && <p className="muted">Brak wizyt do wyświetlenia.</p>}

                    {groups.map(group => (
                        <section key={group.label} className="visitGroup">
                            <h2>{group.label}</h2>
                            {group.items.map(appointment => (
                                <div key={appointment.id} className="card rowCard"
                                     onClick={() => navigate(`${isDoctor ? '/doctor' : '/patient'}/appointment/${appointment.id}`)}>
                                    <div>
                                        <div className="rowTitle">{personName(appointment)}</div>
                                        <div className="muted">
                                            {DateTime.fromISO(appointment.start_time).toFormat('dd.MM.yyyy, HH:mm')}
                                            {' – '}
                                            {DateTime.fromISO(appointment.end_time).toFormat('HH:mm')}
                                        </div>
                                    </div>
                                    <StatusBadge appointment={appointment}/>
                                </div>
                            ))}
                        </section>
                    ))}
                </div>
            </main>
        </div>
    );
}