import {DateTime} from 'luxon';
import {JOIN_EARLY_MINUTES} from "./constants.ts";

export type Specialty = {
    id: number;
    name: string;
};

export type User = {
    id: number;
    role: 'patient' | 'doctor';
    first_name: string;
    last_name: string;
    email: string;

    pesel?: string | null;
    date_of_birth?: string | null;

    doctor_id?: number;
    title?: string;
    pwz_number?: string;
    specialties?: Specialty[];
    bio?: string;
    default_duration?: number;
};

export type DoctorPublic = {
    doctor_id: number;
    title: string;
    first_name: string;
    last_name: string;
    specialties: Specialty[];
    bio: string;
    pwz_number: string;
    average_rating: number | null;
    reviews_count: number;
};


export type DoctorPatient = {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    date_of_birth: string | null;
};

export type SearchItem =
    | { kind: 'specialization'; id: string; label: string }
    | { kind: 'doctor'; id: string; label: string; specialization: string }
    | { kind: 'patient'; id: string; label: string }
    | { kind: 'drug'; id: string; label: string }
    | { kind: 'diagnosis'; id: string; label: string };

export type AppointmentStatus = 'booked' | 'completed' | 'cancelled';

export type Appointment = {
    id: number;
    doctor: number;
    patient: number;
    patient_name: string;
    doctor_name: string;
    start_time: string;
    end_time: string;
    advice?: string;
    notes?: string;
    status: AppointmentStatus;
    has_review: boolean;
};

export type Slot = {
    start_time: string;
    end_time: string;
};


export type DaySchedule = {
    day_of_week: number;
    is_working: boolean;
    start_time: string | null;
    end_time: string | null;
};

export type Absence = {
    id: number;
    start_date: string;
    end_date: string;
    all_day: boolean;
    start_time: string | null;
    end_time: string | null;
    description: string;
};

export type Review = {
    id: number;
    patient_name: string;
    rating: number;
    comment: string;
    created_at: string;
};

export type VisitFilter = {
    showBooked: boolean;
    showCompleted: boolean;
    showCancelled: boolean;
    dateFrom: string;
    dateTo: string;
};

export type Diagnosis = {
    id: number;
    code: string;
    name: string;
}

export type Drug = {
    id: number;
    name: string;
    form: string;
    strength: string;
};

export type MedicalDocument = {
    id: number;
    doc_type: 'prescription' | 'referral' | 'sick_leave';
    doc_type_display: string;
    pdf: string | null;
    created_at: string;

    doctor_name?: string

    drug_display?: string;
    dosage?: string;
    quantity?: string;

    date_from?: string | null;
    date_to?: string | null;

    target?: 'doctor' | 'exam';
    target_display?: string;
    specialty_display?: string;
    exam_name?: string;
};


export type Conversation = {
    id: number;
    doctor: number;
    patient: number;
    doctor_name: string;
    patient_name: string;
    last_message: string | null;
};

export type ChatMessage = {
    id: number;
    sender: number;
    sender_name: string;
    sender_role: 'patient' | 'doctor';
    message: string;
    file: string | null;
    file_name?: string | null;
    created_at: string;
};

export function appointmentStatus(appointment: Appointment): AppointmentStatus {
    if (appointment.status === 'cancelled') return 'cancelled';
    if (appointment.status === 'completed' || DateTime.fromISO(appointment.end_time) < DateTime.now()) return 'completed';
    return 'booked';
}

export function isAppointmentOpen(appointment: Appointment): boolean {
    const now = DateTime.now();
    const start = DateTime.fromISO(appointment.start_time);
    const end = DateTime.fromISO(appointment.end_time);
    return start.diff(now, 'minutes').minutes <= JOIN_EARLY_MINUTES && now <= end;
}

export function dateFormatAppointment(start: string, end: string): string {
    const startTime = DateTime.fromISO(start);
    const endTime = DateTime.fromISO(end);
    return `${startTime.toFormat('dd.MM.yyyy')}, ${startTime.toFormat('HH:mm')} – ${endTime.toFormat('HH:mm')}`;
}


export function filterAppointments(appointments: Appointment[], filter: VisitFilter): Appointment[] {
    return appointments
        .filter(appointment => {
            const status = appointmentStatus(appointment);

            if (status === 'booked') return filter.showBooked;
            if (status === 'completed') return filter.showCompleted;
            return filter.showCancelled;
        })
        .filter(appointment => {
            const day = DateTime.fromISO(appointment.start_time).toFormat('yyyy-MM-dd');

            if (filter.dateFrom && day < filter.dateFrom) return false;
            if (filter.dateTo && day > filter.dateTo) return false;
            return true;
        })
        .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());
}

export function hadAppointmentTogether(appointments: Appointment[], viewerRole: User['role']): SearchItem[] {
    if (viewerRole === 'doctor') {
        return appointments
            .filter((appointment, index, all) =>
                all.findIndex(other => other.patient === appointment.patient) === index)
            .map(appointment => ({
                kind: 'patient',
                id: String(appointment.patient),
                label: appointment.patient_name,
            }));
    }
    return appointments
        .filter((appointment, index, all) =>
            all.findIndex(other => other.doctor === appointment.doctor) === index)
        .map(appointment => ({
            kind: 'doctor',
            id: String(appointment.doctor),
            label: appointment.doctor_name,
            specialization: '',
        }));
}

export function bookedAppointments(appointments: Appointment[]): Appointment[] {
    return appointments
        .filter(appointment => appointmentStatus(appointment) === 'booked')
        .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
}