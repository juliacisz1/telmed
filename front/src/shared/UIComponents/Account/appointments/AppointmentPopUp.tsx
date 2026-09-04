import './AppointmentPopUp.css';
import {useState, type ChangeEvent} from 'react';
import {updateAppointment} from '../../../../api/appointments.ts';
import {getErrorMessage, getErrorStatus} from '../../../../api/errors.ts';
import {PopUp} from '../../PopUp/PopUp.tsx';
import {SlotPicker} from '../../SlotPicker/SlotPicker.tsx';
import type {Appointment, Slot} from '../../../../types.ts';
import {useAuth} from '../../../../context/AuthContext.tsx';
import {DateTime} from 'luxon';
import {DURATION_STEP_MINUTES} from "../../../../constants.ts";
import {validateDuration} from "../../../../api/validation.ts";

type AppointmentPopUpProps = {
    appointment: Appointment;
    onClose: () => void;
    onChanged: () => void;
    mode: 'reschedule' | 'cancel';
};

export function AppointmentPopup({appointment, onClose, onChanged, mode}: AppointmentPopUpProps) {
    const {user} = useAuth();
    const isDoctor = user?.role === 'doctor';

    const [form, setForm] = useState({
        date: DateTime.fromISO(appointment.start_time).toFormat('yyyy-MM-dd'),
        time: DateTime.fromISO(appointment.start_time).toFormat('HH:mm'),
        duration: String(DateTime.fromISO(appointment.end_time)
            .diff(DateTime.fromISO(appointment.start_time), 'minutes').minutes),
    });
    const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
    const [error, setError] = useState('');
    const [conflictMessage, setConflictMessage] = useState('');
    const [saving, setSaving] = useState(false);

    const newDuration = Number(form.duration);
    const durationError = validateDuration(form.duration);
    const displayName = isDoctor ? appointment.patient_name : appointment.doctor_name;

    function handleChange(event: ChangeEvent<HTMLInputElement>) {
        setForm({...form, [event.target.name]: event.target.value});
    }

    async function handleCancel() {
        if (saving) return;

        setError('');
        setSaving(true);
        try {
            await updateAppointment(appointment.id, {status: 'cancelled'});
            onChanged();
            onClose();
        } catch (er) {
            setError(getErrorMessage(er, 'Nie udało się anulować wizyty.'));
        } finally {
            setSaving(false);
        }
    }

    async function sendReschedule(payload: Record<string, unknown>, confirmConflict: boolean) {
        setError('');
        setSaving(true);
        try {
            await updateAppointment(appointment.id, {
                ...payload,
                ...(confirmConflict ? {confirm_conflict: true} : {}),
            });
            setConflictMessage('');
            onChanged();
            onClose();
        } catch (er) {
            if (getErrorStatus(er) === 409) {
                setConflictMessage(getErrorMessage(er, 'Masz już wizytę w tym czasie.'));
                return;
            }
            setError(getErrorMessage(er, 'Nie udało się zmienić terminu wizyty.'));
        } finally {
            setSaving(false);
        }
    }

    async function handleReschedule(confirmConflict = false) {
        if (saving || !selectedSlot) return;

        await sendReschedule({
            start_time: selectedSlot.start_time,
            end_time: selectedSlot.end_time,
        }, confirmConflict);
    }

    async function handleRescheduleDoctor(confirmConflict = false) {
        if (saving) return;

        if (!form.date || !form.time) {
            setError('Podaj datę i godzinę wizyty.');
            return;
        }
        if (durationError) {
            setError(durationError);
            return;
        }

        const start = DateTime.fromISO(`${form.date}T${form.time}`);
        const end = start.plus({minutes: newDuration});

        if (!start.isValid || !end.isValid) {
            setError('Podaj poprawną datę, godzinę i czas trwania wizyty.');
            return;
        }

        await sendReschedule({start_time: start.toISO(), end_time: end.toISO()}, confirmConflict);
    }

    function confirmConflict() {
        if (isDoctor) {
            void handleRescheduleDoctor(true);
        } else {
            void handleReschedule(true);
        }
    }

    return (
        <PopUp title="Szczegóły wizyty" onClose={onClose}>
            <div className="appointmentDetails">
                <div className="rowTitle">{displayName}</div>
                <div className="muted">
                    {DateTime.fromISO(appointment.start_time).toFormat('dd.MM.yyyy, HH:mm')}
                    {' – '}
                    {DateTime.fromISO(appointment.end_time).toFormat('HH:mm')}
                </div>
            </div>

            {conflictMessage ? (
                <div className="cancelConfirm">
                    <p>{conflictMessage}</p>
                    <div className="row rowCenter">
                        <button type="button" className="greenBtn" disabled={saving}
                                onClick={confirmConflict}>
                            Zmień mimo to
                        </button>
                        <button type="button" className="linkBtn" disabled={saving}
                                onClick={() => setConflictMessage('')}>
                            Wróć
                        </button>
                    </div>
                </div>
            ) : mode === 'reschedule' ? (
                isDoctor ? (
                    <div className="rescheduleSection">
                        <div className="row">
                            <label>Data</label>
                            <input className="input smallInput" type="date" name="date"
                                   value={form.date} onChange={handleChange}/>
                            <label>Godzina</label>
                            <input className="input smallInput" type="time" name="time"
                                   value={form.time} onChange={handleChange}/>
                        </div>
                        <div className="row">
                            <label>Czas trwania (min)</label>
                            <input className="input smallInput" type="number" name="duration"
                                   min={DURATION_STEP_MINUTES} step={DURATION_STEP_MINUTES}
                                   value={form.duration} onChange={handleChange}/>
                        </div>
                        {error && <p className="formError">{error}</p>}
                        <button type="button" className="greenBtn"
                                onClick={() => void handleRescheduleDoctor()}
                                disabled={saving || durationError !== null}>
                            {saving ? 'Zapisywanie...' : 'Zapisz zmiany'}
                        </button>
                    </div>
                ) : (
                    <div className="rescheduleSection">
                        <SlotPicker
                            doctorId={appointment.doctor}
                            selectedSlot={selectedSlot}
                            onSelect={setSelectedSlot}
                        />
                        {error && <p className="formError">{error}</p>}
                        {selectedSlot && (
                            <button type="button" className="greenBtn"
                                    onClick={() => void handleReschedule()} disabled={saving}>
                                Zmień termin
                            </button>
                        )}
                    </div>
                )
            ) : (
                <div className="cancelConfirm">
                    <p>Czy na pewno chcesz anulować tę wizytę?</p>
                    {error && <p className="formError">{error}</p>}
                    <div className="row rowCenter">
                        <button type="button" className="redBtn"
                                onClick={handleCancel} disabled={saving}>
                            Tak, anuluj wizytę
                        </button>
                        <button type="button" className="linkBtn"
                                onClick={onClose} disabled={saving}>
                            Wróć
                        </button>
                    </div>
                </div>
            )}
        </PopUp>
    );
}