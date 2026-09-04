import './DoctorPublicPage.css';
import '../../shared/Styles/PageStyle.css';
import {TopBar} from '../../shared/UIComponents/TopBar/TopBar.tsx';
import {useEffect, useState} from 'react';
import {useNavigate, useParams} from 'react-router-dom';
import {getDoctor} from '../../api/users.ts';
import {getDoctorReviews, createAppointment} from '../../api/appointments.ts';
import {getErrorMessage, getErrorStatus} from '../../api/errors.ts';
import {useAuth} from '../../context/AuthContext.tsx';
import type {DoctorPublic, Review, Slot} from '../../types.ts';
import {SlotPicker} from '../../shared/UIComponents/SlotPicker/SlotPicker.tsx';
import {PopUp} from '../../shared/UIComponents/PopUp/PopUp.tsx';
import {TITLE_LABELS} from "../../constants.ts";
import {createConversation} from "../../api/messages.ts";

function StarRating({value}: {value: number}) {
    const fillPercent = (value / 5) * 100;
    return (
        <div className="starRating">
            <div className="starsBg">
                {[...Array(5)].map((_star, index) => <span key={index}>&#9733;</span>)}
            </div>
            <div className="starsFill" style={{width: `${fillPercent}%`}}>
                {[...Array(5)].map((_star, index) => <span key={index}>&#9733;</span>)}
            </div>
        </div>
    );
}

export function DoctorPublicPage() {
    const {id = ''} = useParams();
    const navigate = useNavigate();
    const {user} = useAuth();

    const [doctor, setDoctor] = useState<DoctorPublic | null>(null);
    const [error, setError] = useState('');
    const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
    const [booked, setBooked] = useState(false);
    const [conflictMessage, setConflictMessage] = useState('');
    const [reviews, setReviews] = useState<Review[]>([]);
    const [creating, setCreating] = useState(false);
    const [booking, setBooking] = useState(false);

    const profileComplete = Boolean(user?.pesel && user?.date_of_birth);

    useEffect(() => {
        if (user?.role === 'doctor' && String(user.doctor_id) !== String(id)) navigate('/doctor');
    }, [user, id, navigate]);

    useEffect(() => {
        let cancelled = false;

        getDoctor(id)
            .then(data => {
                if (!cancelled) setDoctor(data);
            })
            .catch(() => {
                if (!cancelled) {
                    setDoctor(null);
                    setError('Nie udało się pobrać profilu lekarza.');
                }
            });

        getDoctorReviews(id)
            .then(data => {
                if (!cancelled) setReviews(data);
            })
            .catch(() => {
                if (!cancelled) setError('Nie udało się pobrać opinii.');
            });

        return () => { cancelled = true; };
    }, [id]);

    async function handleSendMessage() {
        if (creating || booking || !doctor) return;

        setError('');
        setCreating(true);
        try {
            const conversation = await createConversation({doctor: doctor.doctor_id});
            navigate('/patient/messages', {state: {conversationId: conversation.id}});
        } catch (er) {
            const status = getErrorStatus(er);
            setError(status === 403 || status === 400 ? 'Umów wizytę u tego lekarza, aby wysłać mu wiadomość.' :
                getErrorMessage(er, 'Nie udało się otworzyć rozmowy.'));
        } finally {
            setCreating(false);
        }
    }

    async function sendBooking(confirmConflict: boolean) {
        if (creating || booking) return;
        if (!selectedSlot || !doctor) return;
        if (String(doctor.doctor_id) !== String(id)) return;

        setError('');
        setBooking(true);
        try {
            await createAppointment({
                doctor: doctor.doctor_id,
                start_time: selectedSlot.start_time,
                end_time: selectedSlot.end_time,
                ...(confirmConflict ? {confirm_conflict: true} : {}),
            });
            setConflictMessage('');
            setBooked(true);
            setSelectedSlot(null);
        } catch (er) {
            if (getErrorStatus(er) === 409) {
                setConflictMessage(getErrorMessage(er, 'Masz już wizytę w tym czasie.'));
                return;
            }
            setError(getErrorMessage(er, 'Nie udało się umówić wizyty.'));
        } finally {
            setBooking(false);
        }
    }

    return (
        <div className="page">
            <TopBar logoTo={ user?.role === 'doctor' ? '/doctor' :
                user?.role === 'patient' ? '/patient' : '/'}
            >
                <button className="greenBtn"
                        type='button'
                        onClick={() => navigate(-1)}
                >
                    Powrót
                </button>
            </TopBar>

            <main className="publicMain">

                {!doctor && (error ? <p className="formError">{error}</p> : <p className="muted">Nie znaleziono lekarza.</p>)}

                {doctor && (
                    <div className="publicLayout">
                        <section className="card publicCard">

                            <div className="publicCardTop">
                                <div>
                                    <h1>{TITLE_LABELS[doctor.title] ? `${TITLE_LABELS[doctor.title]} ` : ''}
                                        {doctor.first_name} {doctor.last_name}
                                    </h1>
                                    <div className="specTags">
                                        {doctor.specialties.map(specialty => (
                                            <span key={specialty.id} className="badge badgeGreen">{specialty.name}</span>
                                        ))}
                                    </div>
                                    <div className="muted">Nr PWZ: {doctor.pwz_number}</div>

                                    {user?.role === 'patient' && (
                                        <div className="publicContact">
                                            <button className="greenBtnSmall"
                                                    type="button"
                                                    onClick={handleSendMessage}
                                            >
                                                Wyślij wiadomość
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {doctor.average_rating !== null && (
                                    <div className="ratingSummary">
                                        <div className="ratingNumber">{doctor.average_rating.toFixed(1)}</div>
                                        <StarRating value={doctor.average_rating}/>
                                        <div className="muted">{doctor.reviews_count} opinii</div>
                                    </div>
                                )}
                            </div>

                            {error && <p className="formError">{error}</p>}

                            <div className="scrollArea">
                                {doctor.bio && (
                                    <div className="publicSection">
                                        <h2>O mnie</h2>
                                        <p>{doctor.bio}</p>
                                    </div>
                                )}
                                {(!user || user.role === 'patient') && (
                                    <div className="publicSection">
                                        <h2>Umów wizytę</h2>
                                        {booked ? (
                                            <p className="bookedMessage">Wizyta została umówiona!</p>
                                        ) : (
                                            <>
                                                <SlotPicker
                                                    doctorId={id}
                                                    selectedSlot={selectedSlot}
                                                    onSelect={setSelectedSlot}
                                                />

                                                {!user ? (
                                                    <div className="bookingNotice">
                                                        <p className="muted">
                                                            Zaloguj się, aby umówić wizytę
                                                        </p>
                                                        <button className="greenBtn"
                                                                type="button"
                                                                onClick={() => navigate('/login', {state: {from: `/doctors/${id}`}})}
                                                        >
                                                            Zaloguj się
                                                        </button>
                                                    </div>
                                                ) : !profileComplete ? (
                                                    <div className="bookingNotice">
                                                        <p className="muted">
                                                            Aby umówić wizytę, uzupełnij numer PESEL i datę urodzenia w profilu.
                                                        </p>
                                                        <button className="greenBtn"
                                                                type="button"
                                                                onClick={() => navigate('/patient/profile')}
                                                        >
                                                            Uzupełnij profil
                                                        </button>
                                                    </div>
                                                ) : selectedSlot && (
                                                    <button className="greenBtn"
                                                            type="button"
                                                            disabled={booking}
                                                            onClick={() => void sendBooking(false)}
                                                    >
                                                        {booking ? 'Umawianie...' : 'Umów wizytę'}
                                                    </button>
                                                )}
                                            </>
                                        )}
                                    </div>
                                )}


                            </div>
                        </section>

                        <aside className="card reviewsBar">
                            <h2>Opinie</h2>
                            <div className="scrollArea">

                                {!error && reviews.length === 0 && (<p className="muted">Brak opinii.</p>)}

                                {reviews.map(review => (
                                    <div key={review.id} className="reviewCard">
                                        <div className="row">
                                            <span className="rowTitle">{review.patient_name}</span>
                                            <StarRating value={review.rating}/>
                                        </div>
                                        {review.comment && <p>{review.comment}</p>}
                                    </div>
                                ))}
                            </div>
                        </aside>
                    </div>
                )}

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
                                    disabled={booking}
                                    onClick={() => void sendBooking(true)}
                            >
                                {booking ? 'Umawianie...' : 'Umów mimo to'}
                            </button>
                        </div>
                    </PopUp>
                )}
            </main>
        </div>
    );
}