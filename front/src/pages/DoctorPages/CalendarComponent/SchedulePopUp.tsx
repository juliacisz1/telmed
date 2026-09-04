import './SchedulePopUp.css';
import { useState } from 'react';
import { saveSchedule } from '../../../api/appointments.ts';
import { updateUser } from '../../../api/users.ts';
import { getErrorMessage } from '../../../api/errors.ts';
import { useAuth } from '../../../context/AuthContext.tsx';
import { PopUp } from '../../../shared/UIComponents/PopUp/PopUp.tsx';
import type { DaySchedule } from "../../../types.ts";
import {DAYS, DEFAULT_VISIT_DURATION, DEFAULT_WORK_END, DEFAULT_WORK_START, VISIT_DURATION_OPTIONS} from "../../../constants.ts";

const DEFAULT_SCHEDULE: DaySchedule[] = DAYS.map(day => ({
    day_of_week: day.id,
    is_working: day.id < 5,
    start_time: DEFAULT_WORK_START,
    end_time: DEFAULT_WORK_END,
}));

type SchedulePopUpProps = {
    onClose: () => void;
    onSave: (schedule: DaySchedule[], duration: number) => void;
    initialSchedule?: DaySchedule[];
    initialDuration?: number;
};

export function SchedulePopUp({ onSave, onClose, initialSchedule, initialDuration }: SchedulePopUpProps) {
    const { setUser } = useAuth();

    const [duration, setDuration] = useState(initialDuration ?? DEFAULT_VISIT_DURATION);
    const [schedule, setSchedule] = useState<DaySchedule[]>(initialSchedule && initialSchedule.length > 0 ? initialSchedule : DEFAULT_SCHEDULE);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    function updateDay<K extends keyof DaySchedule>(dayId: number, field: K, value: DaySchedule[K]) {
        setSchedule(prev => prev.map(day => day.day_of_week === dayId ? { ...day, [field]: value } : day));
    }

    async function handleSave() {
        if (saving) return;
        setSaving(true);
        setError(null);

        try {
            await saveSchedule(schedule);
        } catch (er) {
            setError(getErrorMessage(er, 'Nie udało się zapisać grafiku pracy.'));
            setSaving(false);
            return;
        }

        try {
            const updatedUser = await updateUser({ default_duration: duration });
            setUser(updatedUser);
            onSave(schedule, duration);
            onClose();
        } catch {
            onSave(schedule, initialDuration ?? DEFAULT_VISIT_DURATION);
            setError('Nie udało się zapisać domyślnego czasu wizyty.');
        } finally {
            setSaving(false);
        }
    }

    return (
        <PopUp title="Ustawienia harmonogramu" onClose={onClose}>

            <div className="row">
                <label>Czas trwania wizyty:</label>
                <select
                    className="input smallInput"
                    value={duration}
                    disabled={saving}
                    onChange={(event) => setDuration(Number(event.target.value))}
                >
                    {VISIT_DURATION_OPTIONS.map(minutes => (
                        <option key={minutes} value={minutes}>{minutes} minut</option>
                    ))}
                </select>
            </div>

            <div className="daysGrid">
                {schedule.map((day) => (
                    <div key={day.day_of_week} className="dayRow">
                        <input
                            type="checkbox"
                            className="scheduleCheckbox"
                            checked={day.is_working}
                            onChange={(event) => updateDay(day.day_of_week, 'is_working', event.target.checked)}
                        />
                        <label>{DAYS[day.day_of_week].label}</label>

                        <input
                            type="time"
                            className="input smallInput"
                            value={day.start_time ?? ''}
                            disabled={!day.is_working}
                            onChange={(event) => updateDay(day.day_of_week, 'start_time', event.target.value)}
                        />
                        <label>–</label>
                        <input
                            type="time"
                            className="input smallInput"
                            value={day.end_time ?? ''}
                            disabled={!day.is_working}
                            onChange={(event) => updateDay(day.day_of_week, 'end_time', event.target.value)}
                        />
                    </div>
                ))}
            </div>

            {error && <p className="formError">{error}</p>}

            <button className="greenBtn fullWidth"
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
            >
                {saving ? 'Zapisywanie...' : 'Zapisz'}
            </button>
        </PopUp>
    );
}