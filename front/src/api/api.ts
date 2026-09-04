import axios, {type AxiosError, type InternalAxiosRequestConfig} from "axios"

//https://developer.mozilla.org/en-US/docs/Web/API/URL/createObjectURL_static
//https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/a
//https://django-rest-framework-simplejwt.readthedocs.io/en/latest/getting_started.html
//https://github.com/iMerica/dj-rest-auth/blob/master/dj_rest_auth/jwt_auth.py
//https://github.com/Flyrell/axios-auth-refresh

const API_BASEURL = import.meta.env.VITE_API_BASEURL || '/api';

const api = axios.create({
    baseURL: API_BASEURL,
    withCredentials: true,
})

let hasSession = false;

export function markSessionStarted(): void {
    hasSession = true;
}

function markSessionEnded(): void {
    hasSession = false;
}


async function fetchFile(path: string): Promise<string> {
    const response = await api.get(path, {responseType: 'blob'});
    return URL.createObjectURL(response.data);
}

export async function downloadFile(path: string, filename: string): Promise<void> {
    const objectUrl = await fetchFile(path);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}

export function getWebSocketUrl(path: string): string {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    return `${wsProtocol}://${window.location.host}${API_BASEURL}${path}`;
}

let refreshCall: Promise<unknown> | undefined;

function refreshSession(): Promise<unknown> {
    if (!refreshCall) {
        refreshCall = api.post('/token/refresh/', {})
            .finally(() => { refreshCall = undefined; });
    }
    return refreshCall;
}

export async function logoutRequest(): Promise<void> {
    markSessionEnded();
    try {
        await api.post('/logout/');
    } catch {
        //
    }
}

function redirectToLogin(): void {
    void logoutRequest().finally(() => { window.location.href = '/login'; });
}

//https://axios.rest/pages/advanced/interceptors
//https://axios.rest/pages/advanced/retry

api.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        const original = error.config as InternalAxiosRequestConfig & {
            retry?: boolean
        };

        if (error.response?.status !== 401 || !original || original.retry || original.url?.includes('/token/')) {
            return Promise.reject(error);
        }
        original.retry = true;

        if (!hasSession) {
            return Promise.reject(error);
        }

        try {
            await refreshSession();
            return api(original);
        } catch {
            redirectToLogin();
            return Promise.reject(error);
        }
    }
)

export default api