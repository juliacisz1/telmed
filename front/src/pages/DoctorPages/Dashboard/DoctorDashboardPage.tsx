import '../../../shared/Styles/Dashboard.css'
import '../../../shared/Styles/PageStyle.css'
import {useNavigate} from "react-router-dom";
import {useEffect, useState} from "react";
import {useAuth} from "../../../context/AuthContext.tsx";
import {getSchedule, getAbsences} from "../../../api/appointments.ts";
import {useAppointments} from "../../../shared/Hooks/UseAppointments.ts";
import {SchedulePopUp} from "../CalendarComponent/SchedulePopUp.tsx";
import {AbsencePopUp} from "../CalendarComponent/AbsencePopUp.tsx";
import {DoctorCalendar} from "../CalendarComponent/DoctorCalendar.tsx";
import {TopBar} from "../../../shared/UIComponents/TopBar/TopBar.tsx";
import {isAppointmentOpen, dateFormatAppointment, type DaySchedule, type Absence, bookedAppointments} from "../../../types.ts";
import {DEFAULT_VISIT_DURATION} from "../../../constants.ts";
import {useRefresh} from "../../../shared/Hooks/useRefresh.ts";

export function DoctorDashboardPage() {
    const navigate = useNavigate();
    const {user, logout} = useAuth();

    const {appointments, error: appointmentsError} = useAppointments();
    const [schedule, setSchedule] = useState<DaySchedule[]>([]);
    const [scheduleLoaded, setScheduleLoaded] = useState(false);
    const [durationOverride, setDurationOverride] = useState<number | null>(null);
    const [absences, setAbsences] = useState<Absence[]>([]);
    const [showScheduleSettings, setShowScheduleSettings] = useState(false);
    const [absenceEdit, setAbsenceEdit] = useState<Absence | 'new' | null>(null);
    const [error, setError] = useState('');

    const duration = durationOverride ?? user?.default_duration ?? DEFAULT_VISIT_DURATION;

    useRefresh();

    const fetchAbsences = async () => {
        try {
            setAbsences(await getAbsences());
        } catch {
            setError('Nie udało się pobrać nieobecności.');
        }
    };

    useEffect(() => {
        getSchedule()
            .then(data => {
                setSchedule(data);
                setScheduleLoaded(true);
            })
            .catch(() => setError('Nie udało się pobrać grafiku pracy.'));

        fetchAbsences();
    }, []);

    const nextAppointments = bookedAppointments(appointments).slice(0, 3);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className="page">
            <TopBar logoTo="/doctor">
                <button className="linkBtn"
                        type='button'
                        onClick={() => navigate('/doctor/profile')}>
                    Profil Lekarza
                </button>
                <button className="greenBtn"
                        type='button'
                        onClick={handleLogout}>
                    Wyloguj
                </button>
            </TopBar>

            <main className="dashboardMain">
                <aside className="leftBar">
                    <section className="card">
                        <h2>Nadchodzące wizyty</h2>
                        {appointmentsError ? (
                            <p className="formError">{appointmentsError}</p>) : nextAppointments.length > 0 ? (
                            nextAppointments.map(appointment => (
                                <div key={appointment.id} className="card rowCard"
                                     onClick={() => navigate(`/doctor/appointment/${appointment.id}`)}>
                                    <div className="rowTitle">{appointment.patient_name}</div>
                                    <div className="muted">
                                        {dateFormatAppointment(appointment.start_time, appointment.end_time)}
                                    </div>
                                    {isAppointmentOpen(appointment) && (
                                        <button type="button" className="greenBtnSmall"
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    navigate(`/doctor/appointment/${appointment.id}/room`);
                                                }}
                                        >
                                            Rozpocznij wizytę
                                        </button>
                                    )}
                                </div>
                            ))
                        ) : (
                            <p>Brak nadchodzących wizyt</p>
                        )}
                    </section>

                    <section className="card clickableCard" onClick={() => navigate('/doctor/appointments')}>
                        <h2>Wizyty</h2>
                    </section>

                    <section className="card clickableCard" onClick={() => navigate('/doctor/patients')}>
                        <h2>Lista pacjentów</h2>
                    </section>

                    <section className="card clickableCard" onClick={() => navigate('/doctor/messages')}>
                        <h2>Wiadomości</h2>
                    </section>

                    <section className="card clickableCard" onClick={() => navigate(`/doctors/${user?.doctor_id}`)}>
                        <h2>Mój profil</h2>
                    </section>
                </aside>

                <section className="card">
                    <div className="row rowBetween">
                        <h1>Terminarz</h1>
                        <div className="row">
                            <button className="linkBtn"
                                    type="button"
                                    onClick={() => setAbsenceEdit('new')}
                            >
                                + Dodaj nieobecność
                            </button>
                            <button className="greenBtnSmall"
                                    type="button"
                                    onClick={() => setShowScheduleSettings(true)}
                                    disabled={!scheduleLoaded}
                            >
                                Ustawienia kalendarza
                            </button>
                        </div>
                    </div>

                    {error && <p className="formError">{error}</p>}

                    {showScheduleSettings && (
                        <SchedulePopUp
                            onClose={() => setShowScheduleSettings(false)}
                            onSave={(newSchedule, newDuration) => {
                                setSchedule(newSchedule);
                                setDurationOverride(newDuration);
                            }}
                            initialSchedule={schedule}
                            initialDuration={duration}
                        />
                    )}

                    {absenceEdit && (
                        <AbsencePopUp
                            key={absenceEdit === 'new' ? 'new' : absenceEdit.id}
                            absences={absences}
                            absence={absenceEdit === 'new' ? undefined : absenceEdit}
                            onSelect={setAbsenceEdit}
                            onClose={() => setAbsenceEdit(null)}
                            onChanged={fetchAbsences}
                        />
                    )}

                    <DoctorCalendar
                        appointments={appointments}
                        schedule={schedule}
                        absences={absences}
                        onSelectAppointment={(id) => navigate(`/doctor/appointment/${id}`)}
                        onSelectAbsence={(absence) => setAbsenceEdit(absence)}
                    />
                </section>
            </main>
        </div>
    );
}