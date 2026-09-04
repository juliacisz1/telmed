import {DURATION_STEP_MINUTES, MIN_PASSWORD_LENGTH} from '../constants.ts';

export type PasswordError = {
    field: 'password' | 'password_confirm';
    message: string;
};

export function validatePassword(password: string, confirm: string): PasswordError | null {
    if (password.length < MIN_PASSWORD_LENGTH) {
        return {
            field: 'password',
            message: `Hasło musi zawierać przynajmniej 8 znaków`,
        };
    }
    if (password !== confirm) {
        return {field: 'password_confirm', message: 'Podane hasła muszą być identyczne'};
    }
    return null;
}

export function validateDuration(text: string): string | null {
    const minutes = Number(text);
    if (!text.trim() || !Number.isFinite(minutes) || minutes < DURATION_STEP_MINUTES) {
        return `Czas trwania wizyty musi wynosić co najmniej 5 minut.`;
    }
    return null;
}