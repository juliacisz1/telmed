import api from './api.ts';
import {getDoctors} from './users.ts';
import type {SearchItem, Specialty} from '../types.ts';

export async function fetchSpecialtySuggestions(): Promise<SearchItem[]> {
    const {data} = await api.get<Specialty[]>('/specialties/');
    return data.map(specialty => ({
        kind: 'specialization',
        id: String(specialty.id),
        label: specialty.name,
    }));
}

async function searchSpecialties(query: string): Promise<SearchItem[]> {
    const specialties = await fetchSpecialtySuggestions();
    const needle = query.toLowerCase();
    return specialties.filter(specialty => specialty.label.toLowerCase().includes(needle));
}

export async function searchDoctorsAndSpecialties(query: string): Promise<SearchItem[]> {
    const [doctorsResult, specialtiesResult] = await Promise.allSettled([
        getDoctors(query),
        searchSpecialties(query),
    ]);

    if (doctorsResult.status === 'rejected') {
        throw doctorsResult.reason;
    }

    const doctors: SearchItem[] = doctorsResult.value.map(doctor => ({
        kind: 'doctor',
        id: String(doctor.doctor_id),
        label: `${doctor.first_name} ${doctor.last_name}`,
        specialization: doctor.specialties.map(specialty => specialty.name).join(', '),
    }));

    const specialties: SearchItem[] = specialtiesResult.status === 'fulfilled' ? specialtiesResult.value : [];

    return [...specialties, ...doctors];
}