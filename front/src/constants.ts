import type {AppointmentStatus} from './types.ts';


export const STATUS_LABEL: Record<AppointmentStatus, string> = {
    booked: 'Umówiona',
    completed: 'Zrealizowana',
    cancelled: 'Anulowana'
}

export const TITLE_LABELS: Record<string, string> = {
    lek: 'lek.',
    dr_n_med: 'dr n. med.',
    dr_hab_n_med: 'dr hab. n. med.',
    prof_dr_hab: 'prof. dr hab. n. med.',
};

export const DAYS = [
    { id: 0, label: 'Poniedziałek' },
    { id: 1, label: 'Wtorek' },
    { id: 2, label: 'Środa' },
    { id: 3, label: 'Czwartek' },
    { id: 4, label: 'Piątek' },
    { id: 5, label: 'Sobota' },
    { id: 6, label: 'Niedziela' },
];

export const MIN_PASSWORD_LENGTH = 8;

export const MAX_SPECIALTIES = 3;

export const SEARCH_DEBOUNCE_MS = 300;
export const MIN_QUERY_LENGTH = 3;

export const CALENDAR_START_HOUR = 6;
export const CALENDAR_END_HOUR = 21;

export const DEFAULT_VISIT_DURATION = 30;
export const VISIT_DURATION_OPTIONS = [15, 30, 45, 60];
export const DEFAULT_WORK_START = '07:30';
export const DEFAULT_WORK_END = '15:00';
export const JOIN_EARLY_MINUTES = 10;
export const PERMANENT_CLOSE_CODES = [1002, 1003, 1008];


export const DURATION_STEP_MINUTES = 5;

export const PESEL_LENGTH = 11;

export const MAX_MESSAGE_LENGTH = 500;

//serwer stun od googla
export const ICE_SERVERS = [{urls: 'stun:stun.l.google.com:19302'}];
