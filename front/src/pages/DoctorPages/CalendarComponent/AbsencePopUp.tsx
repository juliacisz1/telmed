import './SchedulePopUp.css';
import {useState, type ChangeEvent} from 'react';
import {DateTime} from 'luxon';
import {createAbsence, updateAbsence, deleteAbsence} from '../../../api/appointments.ts';
import {PopUp} from '../../../shared/UIComponents/PopUp/PopUp.tsx';
import type {Absence} from '../../../types.ts';

type AbsencePopUpProps = {
    absences: Absence[],
    absence?: Absence,
    onSelect: (absence: Absence) => void,
    onClose: () => void,
    onChanged: () => void,
};

export function AbsencePopUp({absences, absence, onSelect, onClose, onChanged}: AbsencePopUpProps) {
    const [form, setForm] = useState({
        start_date: absence?.start_date ?? '',
        end_date: absence?.end_date ?? '',
        all_day: absence?.all_day ?? false,
        start_time: absence?.start_time?.slice(0, 5) ?? '',
        end_time: absence?.end_time?.slice(0, 5) ?? '',
        description: absence?.description ?? '',
    });
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    function handleChange(event: ChangeEvent<HTMLInputElement>) {
        const {name, type, value, checked} = event.target;
        setForm(prev => ({...prev, [name]: type === 'checkbox' ? checked : value}));
    }

    async function handleSave() {
        if (saving) return;

        if (!form.start_date || !form.end_date) {
            setError('Podaj datę początku i końca nieobecności.');
            return;
        }
        if (!form.all_day && (!form.start_time || !form.end_time)) {
            setError('Podaj godziny nieobecności albo zaznacz cały dzień.');
            return;
        }

        setError('');
        setSaving(true);
        try {
            const payload = {
                ...form,
                start_time: form.all_day ? null : form.start_time,
                end_time: form.all_day ? null : form.end_time,
            };

            if (absence) {
                await updateAbsence(absence.id, payload);
            } else {
                await createAbsence(payload);
            }
            onChanged();
            onClose();
        } catch {
            setError('Nie udało się zapisać zmian.');
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete() {
        if (saving || !absence) return;

        setError('');
        try {
            await deleteAbsence(absence.id);
            onChanged();
            onClose();
        } catch {
            setError('Nie udało się usunąć nieobecności.');
        }
    }

    const today = DateTime.now().toFormat('yyyy-MM-dd');
    const current = absences.filter(item => item.end_date >= today)
        .sort((a, b) => a.start_date.localeCompare(b.start_date));

    return (
        <PopUp title={absence ? 'Edytuj nieobecność' : 'Dodaj nieobecność'} onClose={onClose}>
            <div className="absenceForm">
                <div className="row">
                    <label>Od</label>
                    <input className="input smallInput"
                           type="date"
                           name="start_date"
                           value={form.start_date}
                           onChange={handleChange}
                    />
                    <label>Do</label>
                    <input className="input smallInput"
                           type="date"
                           name="end_date"
                           value={form.end_date}
                           onChange={handleChange}
                    />
                </div>

                <div className="row">
                    <label>W godzinach</label>
                    <input className="input smallInput"
                           type="time"
                           name="start_time"
                           disabled={form.all_day}
                           value={form.start_time} onChange={handleChange}
                    />
                    <label>–</label>
                    <input className="input smallInput"
                           type="time"
                           name="end_time"
                           disabled={form.all_day}
                           value={form.end_time} onChange={handleChange}
                    />
                    <label className="checkbox">
                        <input type="checkbox"
                               name="all_day"
                               checked={form.all_day}
                               onChange={handleChange}
                        />
                        Cały dzień
                    </label>
                </div>

                <div className="row">
                    <label>Opis</label>
                    <input className="input smallInput"
                           type="text"
                           name="description"
                           placeholder="np. urlop"
                           value={form.description} onChange={handleChange}
                    />
                </div>
            </div>

            {error && <p className="formError">{error}</p>}

            <div className="row rowEnd">
                {absence && (
                    <button className="redBtn"
                            type="button"
                            onClick={handleDelete}
                    >
                        Usuń nieobecność
                    </button>
                )}
                <button className="greenBtn"
                        type="button"
                        disabled={saving}
                        onClick={handleSave}
                >
                    {saving ? 'Zapisywanie...' : 'Zapisz'}
                </button>
            </div>

            <div className="scrollBox">
                {current.length === 0 ? (<p className="muted">Brak zaplanowanych nieobecności.</p>)
                    : current.map(item => (
                        <div key={item.id}
                             className={item.id === absence?.id ? 'card rowCard rowCardActive' : 'card rowCard'}>
                            <button className="absenceEditBtn"
                                    type="button"
                                    onClick={() => onSelect(item)}
                            >
                                {item.description || 'Nieobecność'}: {item.start_date} – {item.end_date}
                                {!item.all_day && ` (${item.start_time?.slice(0, 5)}–${item.end_time?.slice(0, 5)})`}
                            </button>
                        </div>
                    ))}
            </div>
        </PopUp>
    );
}