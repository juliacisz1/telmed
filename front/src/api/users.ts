import api from './api.ts';
import type {DoctorPublic, User} from '../types.ts';

export async function loginUser(email: string, password: string): Promise<void> {
    await api.post('/token/', {email, password});
}

export async function getUser(): Promise<User> {
    const {data} = await api.get<User>('/user/');
    return data;
}

export async function updateUser(payload: Record<string, unknown>): Promise<User> {
    const {data} = await api.patch<User>('/user/', payload);
    return data;
}

export async function deleteUser(): Promise<void> {
    await api.delete('/user/');
}

export async function requestPasswordReset(email: string): Promise<void> {
    await api.post('/password-reset/', {email});
}

export async function confirmPasswordReset(uid: string, token: string, password: string): Promise<void> {
    await api.post('/password-reset/confirm/', {uid, token, password});
}

export type PatientRegistration = {
    first_name: string;
    last_name: string;
    email: string;
    password: string;
    password_confirm: string;
};

export type DoctorRegistration = PatientRegistration & {
    pwz_number: string;
    specialty: number;
};

export async function registerPatient(payload: PatientRegistration): Promise<void> {
    await api.post('/register/patient/', payload);
}

export async function registerDoctor(payload: DoctorRegistration): Promise<void> {
    await api.post('/register/doctor/', payload);
}

export async function changePassword(payload: {
    old_password: string;
    new_password: string;
    new_password_confirm: string;
}): Promise<void> {
    await api.post('/password-change/', payload);
}

export async function getDoctors(search = ''): Promise<DoctorPublic[]> {
    const {data} = await api.get<DoctorPublic[]>(`/doctors/?search=${encodeURIComponent(search)}`);
    return data;
}

export async function getDoctor(doctorId: number | string): Promise<DoctorPublic> {
    const {data} = await api.get<DoctorPublic>(`/doctors/${doctorId}/`);
    return data;
}