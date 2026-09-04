import {useEffect, useState} from 'react';
import {getAppointments} from '../../api/appointments.ts';
import type {Appointment} from '../../types.ts';

export function useAppointments() {
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [error, setError] = useState('');

    useEffect(() => {
        getAppointments()
            .then(setAppointments)
            .catch(() => setError('Nie udało się pobrać wizyt.'))
    }, []);

    return {appointments, error};
}