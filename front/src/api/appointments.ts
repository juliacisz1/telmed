import api from './api.ts';
import type {
    Absence, Appointment, DaySchedule, Diagnosis, DoctorPatient, Drug, MedicalDocument, Review,
    SearchItem, Slot
} from '../types.ts';

export async function getAppointments(): Promise<Appointment[]> {
    const {data} = await api.get<Appointment[]>('/appointments/');
    return data;
}

export async function getAppointment(id: number | string): Promise<Appointment> {
    const {data} = await api.get<Appointment>(`/appointments/${id}/`);
    return data;
}

export async function createAppointment(payload: Record<string, unknown>): Promise<Appointment> {
    const {data} = await api.post<Appointment>('/appointments/', payload);
    return data;
}

export async function updateAppointment(id: number | string, payload: Record<string, unknown>): Promise<Appointment> {
    const {data} = await api.patch<Appointment>(`/appointments/${id}/`, payload);
    return data;
}

export async function getAvailableSlots(doctorId: number | string, date: string): Promise<Slot[]> {
    const {data} = await api.get<Slot[]>(`/doctors/${doctorId}/slots/?date=${date}`);
    return data;
}

export async function getSchedule(): Promise<DaySchedule[]> {
    const {data} = await api.get<DaySchedule[]>('/doctor/schedule/');
    return data;
}

export async function saveSchedule(schedule: DaySchedule[]): Promise<DaySchedule[]> {
    const {data} = await api.put<DaySchedule[]>('/doctor/schedule/', schedule);
    return data;
}

export async function getAbsences(): Promise<Absence[]> {
    const {data} = await api.get<Absence[]>('/doctor/absences/');
    return data;
}

export async function createAbsence(payload: Record<string, unknown>): Promise<Absence> {
    const {data} = await api.post<Absence>('/doctor/absences/', payload);
    return data;
}

export async function updateAbsence(id: number, payload: Record<string, unknown>): Promise<Absence> {
    const {data} = await api.patch<Absence>(`/doctor/absences/${id}/`, payload);
    return data;
}

export async function deleteAbsence(id: number): Promise<void> {
    await api.delete(`/doctor/absences/${id}/`);
}

export async function getDoctorPatients(): Promise<DoctorPatient[]> {
    const {data} = await api.get<DoctorPatient[]>('/doctor/patients/');
    return data;
}


export async function getAppointmentDocuments(appointmentId: number | string): Promise<MedicalDocument[]> {
    const {data} = await api.get<MedicalDocument[]>(`/appointments/${appointmentId}/documents/`);
    return data;
}

export async function searchDiagnoses(query: string): Promise<SearchItem[]> {
    const {data} = await api.get<Diagnosis[]>('/diagnoses/', {params: {search: query}});
    return data.map(diagnosis => ({
        kind: 'diagnosis',
        id: String(diagnosis.id),
        label: `${diagnosis.code} ${diagnosis.name}`,
    }));
}

export async function searchDrugs(query: string): Promise<SearchItem[]> {
    const {data} = await api.get<Drug[]>('/drugs/', {params: {search: query}});
    return data.map(drug => ({
        kind: 'drug',
        id: String(drug.id),
        label: [drug.name, drug.form, drug.strength].filter(Boolean).join(', '),
    }));
}

export async function createDocument(
    appointmentId: number, payload: Record<string, unknown>): Promise<MedicalDocument> {
    const {data} = await api.post<MedicalDocument>(`/appointments/${appointmentId}/documents/`, payload);
    return data;
}

export async function getPatientDocuments(): Promise<MedicalDocument[]> {
    const {data} = await api.get<MedicalDocument[]>('/patient/documents/');
    return data;
}


export async function createReview(payload: {
    appointment: number;
    rating: number;
    comment: string;
}): Promise<void> {
    await api.post('/reviews/', payload);
}

export async function getDoctorReviews(doctorId: number | string): Promise<Review[]> {
    const {data} = await api.get<Review[]>(`/doctors/${doctorId}/reviews/`);
    return data;
}