import {createContext, useContext, useEffect, useState, type ReactNode} from 'react';
import {getUser, loginUser} from "../api/users.ts";
import {logoutRequest, markSessionStarted} from '../api/api.ts';
import type {User} from "../types.ts"

// https://www.digitalocean.com/community/tutorials/build-a-to-do-application-using-django-and-react
// https://medium.com/@kumaraditya7125/protected-routes-role-based-access-in-react-with-typescript-b42e2e8ed63f

interface AuthContextType {
    user: User | null;
    setUser: (user: User | null) => void;
    login: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    loading: boolean;
}

type AuthProviderProps = { children: ReactNode };

const AuthContext = createContext<AuthContextType | null>(null);


export const AuthProvider = ({ children }: AuthProviderProps) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        getUser()
            .then(loggedIn => {
                if (cancelled) return;
                setUser(loggedIn);
                markSessionStarted();
            })
            .catch(() => {
                if (!cancelled) setUser(null);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => { cancelled = true; };
    }, []);

    const login = async (email: string, password: string) => {
        await loginUser(email, password);
        markSessionStarted();

        try {
            setUser(await getUser());
        } catch (er) {
            await logoutRequest();
            setUser(null);
            throw er;
        } finally {
            setLoading(false);
        }
    }

    const logout = async () => {
        await logoutRequest();
        setUser(null);
    }

    const value = {
        user,
        setUser,
        login,
        logout,
        loading
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within an AuthProvider');
    return context;
};