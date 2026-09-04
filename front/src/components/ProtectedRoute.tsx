import {Navigate} from "react-router-dom";
import {useAuth} from "../context/AuthContext.tsx";
import type {ReactElement} from "react";


export const ProtectedRoute = (
    {children, requiredRole}: { children: ReactElement; requiredRole?: 'patient' | 'doctor' }) => {
    const {user, loading} = useAuth();

    if (loading) return <p className="muted">Wczytywanie...</p>;

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    if (requiredRole && user.role !== requiredRole) {
        return <Navigate to={user.role === 'doctor' ? '/doctor' : '/patient'} replace />;
    }

    return children;
};