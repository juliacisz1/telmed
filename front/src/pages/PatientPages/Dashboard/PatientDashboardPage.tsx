import '../../../shared/Styles/PageStyle.css';
import '../../../shared/Styles/Dashboard.css'
import {useNavigate} from "react-router-dom";
import SearchDropdown from "../../../shared/UIComponents/SearchDropdown/SearchDropdown.tsx";
import {TopBar} from "../../../shared/UIComponents/TopBar/TopBar.tsx";
import {useAppointments} from "../../../shared/Hooks/UseAppointments.ts";
import {fetchSpecialtySuggestions, searchDoctorsAndSpecialties} from "../../../api/search.ts";
import {useState} from "react";
import {useAuth} from "../../../context/AuthContext.tsx";
import {dateFormatAppointment, isAppointmentOpen, bookedAppointments} from "../../../types.ts";
import {useRefresh} from "../../../shared/Hooks/useRefresh.ts";

export function PatientDashboardPage() {
    const navigate = useNavigate();
    const { logout } = useAuth();
    const [searchQuery, setSearchQuery] = useState('');
    const {appointments, error} = useAppointments();

    useRefresh();

    const nextAppointment = bookedAppointments(appointments)[0] ?? null;

    function handleSearch() {
        navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return(
        <div className="page">
            <TopBar logoTo="/patient">
                <button className="linkBtn"
                        type='button'
                        onClick={() => navigate('/patient/profile')}
                >
                    Profil Lekarza
                </button>
                <button className="greenBtn"
                        type='button'
                        onClick={handleLogout}
                >
                    Wyloguj
                </button>
            </TopBar>

            <main>
                <div className="dashboardMain">
                    <aside className="leftBar">
                        <section className="card">
                            <h2>Najbliższa wizyta</h2>
                            {error ? (<p className="formError">{error}</p>) : nextAppointment ? (
                                <div className="card rowCard"
                                     onClick={() => navigate(`/patient/appointment/${nextAppointment.id}`)}>
                                    <div className="rowTitle">{nextAppointment.doctor_name}</div>
                                    <div className="muted">
                                        {dateFormatAppointment(nextAppointment.start_time, nextAppointment.end_time)}
                                    </div>
                                    {isAppointmentOpen(nextAppointment) && (
                                        <button  className="greenBtnSmall"
                                                 type="button"
                                                 onClick={(event) => {
                                                     event.stopPropagation();
                                                     navigate(`/patient/appointment/${nextAppointment.id}/room`);
                                                }}
                                        >
                                            Rozpocznij wizytę
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <p>Brak nadchodzących wizyt</p>
                            )}
                        </section>

                        <section className="card clickableCard" onClick={() => navigate('/patient/appointments')}>
                            <h2>Wizyty</h2>
                        </section>

                        <section className="card clickableCard" onClick={() => navigate('/patient/messages')}>
                            <h2>Wiadomości</h2>
                        </section>

                        <section className="card clickableCard" onClick={() => navigate('/patient/documents')}>
                            <h2>Moje dokumenty</h2>
                        </section>
                    </aside>

                    <section className="card">
                        <h2>Znajdź lekarza i umów wizytę już dziś!</h2>
                        <div className="row">
                            <SearchDropdown
                                fetchSuggestions={fetchSpecialtySuggestions}
                                fetchOptions={searchDoctorsAndSpecialties}
                                placeholder="Specjalizacja lub imię lekarza"
                                onQueryChange={setSearchQuery}
                            />
                            <button className="greenBtn"
                                    type="button"
                                    onClick={handleSearch}
                            >
                                Szukaj
                            </button>
                        </div>
                    </section>
                </div>
            </main>
        </div>
    )
}