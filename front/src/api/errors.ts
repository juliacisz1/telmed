import axios from 'axios';

function getErrorData(err: unknown): Record<string, unknown> | null {
    if (axios.isAxiosError(err) && err.response?.data && typeof err.response.data === 'object') {
        return err.response.data as Record<string, unknown>;
    }
    return null;
}

export function getErrorStatus(error: unknown): number | undefined {
    return axios.isAxiosError(error) ? error.response?.status : undefined;
}

export function getFieldErrors(err: unknown): Record<string, string[]> {
    const data = getErrorData(err);
    if (!data) return {};

    const result: Record<string, string[]> = {};
    for (const [field, value] of Object.entries(data)) {
        if (Array.isArray(value)) result[field] = value.map(String);
    }
    return result;
}

export function getErrorMessage(error: unknown, fallback: string): string {

    const data = getErrorData(error);
    if (typeof data?.detail === 'string') return data.detail;

    const first = Object.values(getFieldErrors(error))[0];
    return first?.[0] ?? fallback;
}