import '../../Styles/PageStyle.css';
import "./SlotPicker.css"
import {useRef, useState} from 'react';
import {DateTime} from 'luxon';
import {getAvailableSlots} from '../../../api/appointments.ts';
import type {Slot} from '../../../types.ts';

import DatePicker, {registerLocale} from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import {pl} from 'date-fns/locale/pl';

registerLocale('pl', pl);

type SlotPickerProps = {
    doctorId: number | string;
    selectedSlot: Slot | null;
    onSelect: (slot: Slot | null) => void;
};

export function SlotPicker({doctorId, selectedSlot, onSelect}: SlotPickerProps) {
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [slots, setSlots] = useState<Slot[]>([]);
    const [error, setError] = useState('');
    const requestId = useRef(0);

    async function handleDateChange(date: Date | null) {
        const currentRequest = ++requestId.current;

        setSelectedDate(date);
        onSelect(null);
        setError('');
        setSlots([]);

        if (!date) return;

        const dateStr = DateTime.fromJSDate(date).toFormat('yyyy-MM-dd');
        try {
            const result = await getAvailableSlots(doctorId, dateStr);
            if (currentRequest === requestId.current) setSlots(result);
        } catch {
            if (currentRequest === requestId.current) {
                setError('Nie udało się pobrać wolnych terminów.');
            }
        }
    }

    return (
        <>
            <DatePicker
                locale="pl"
                selected={selectedDate}
                onChange={handleDateChange}
                minDate={new Date()}
                inline
            />

            {error && <p className="formError">{error}</p>}

            {!error && selectedDate && slots.length === 0 && (<p className="muted">Brak wolnych terminów w tym dniu.</p>)}

            {slots.length > 0 && (
                <div className="slots">
                    {slots.map(slot => (
                        <button
                            key={slot.start_time}
                            type="button"
                            className={`slot ${selectedSlot?.start_time === slot.start_time ? 'slotActive' : ''}`}
                            onClick={() => onSelect(slot)}
                        >
                            {DateTime.fromISO(slot.start_time).toFormat('HH:mm')}
                        </button>
                    ))}
                </div>
            )}
        </>
    );
}