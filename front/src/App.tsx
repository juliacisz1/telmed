import type {ReactNode} from 'react';
import { BrowserRouter, Routes, Route, useParams, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute.tsx';
import { HomePage } from './pages/HomePage.tsx'
import {LoginPage} from "./pages/AuthPages/LoginPage.tsx";
import {RoleChoicePage} from "./pages/AuthPages/RoleChoicePage.tsx";
import {PatientRegisterPage} from "./pages/AuthPages/PatientRegisterPage.tsx";
import {DoctorRegisterPage} from "./pages/AuthPages/DoctorRegisterPage.tsx";
import {DoctorSearchPage} from "./pages/SearchPages/DoctorSearchPage.tsx";
import {DoctorPublicPage} from "./pages/SearchPages/DoctorPublicPage.tsx";

import {PatientDashboardPage} from "./pages/PatientPages/Dashboard/PatientDashboardPage.tsx";
import {PatientProfilePage} from "./pages/PatientPages/Profile/PatientProfilePage.tsx";
import {PatientDocumentsPage} from "./pages/PatientPages/Documents/PatientDocumentsPage.tsx";

import {DoctorDashboardPage} from "./pages/DoctorPages/Dashboard/DoctorDashboardPage.tsx";
import {DoctorProfilePage} from "./pages/DoctorPages/Profile/DoctorProfilePage.tsx";
import {AppointmentDetailsPage} from "./shared/UIComponents/Account/appointments/AppointmentDetailsPage.tsx";
import {AppointmentListPage} from "./shared/UIComponents/Account/appointments/AppointmentListPage.tsx";

import {PatientsListPage} from "./pages/DoctorPages/PatientsList/PatientsListPage.tsx";
import {PatientDetailsPage} from "./pages/DoctorPages/PatientsList/PatientDetailsPage.tsx";

import {MessagesPage} from "./shared/UIComponents/Account/messages/MessagesPage.tsx";

import {AppointmentRoomPage} from "./shared/UIComponents/Account/AppointmentRoom/AppointmentRoomPage.tsx";
import {ResetPasswordPage} from "./pages/AuthPages/ResetPasswordPage.tsx";
import {ForgotPasswordPage} from "./pages/AuthPages/ForgotPasswordPage.tsx";


function KeyedByRouteParam({children}: {children: ReactNode}) {
    const {id} = useParams();
    return <div key={id} className="routeInstance">{children}</div>;
}

function App() {
    //react używa programowanie deklaratywne - nie dekladujemy wszystkiego co robimy, tylko to co chcemy pokazać
    return (<BrowserRouter>
            <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RoleChoicePage />} />
                <Route path="/register-patient" element={<PatientRegisterPage />} />
                <Route path="/register-doctor" element={<DoctorRegisterPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset/:uid/:token" element={<ResetPasswordPage />} />
                <Route path="/search" element={<DoctorSearchPage />} />
                <Route path="/doctors/:id" element={<KeyedByRouteParam><DoctorPublicPage /></KeyedByRouteParam>} />

                <Route path="/patient" element={<ProtectedRoute requiredRole="patient"><PatientDashboardPage /></ProtectedRoute>} />
                <Route path="/patient/profile" element={<ProtectedRoute requiredRole="patient"><PatientProfilePage /></ProtectedRoute>} />
                <Route path="/patient/documents" element={<ProtectedRoute requiredRole="patient"><PatientDocumentsPage /></ProtectedRoute>} />

                <Route path="/doctor" element={<ProtectedRoute requiredRole="doctor"><DoctorDashboardPage /></ProtectedRoute>} />
                <Route path="/doctor/profile" element={<ProtectedRoute requiredRole="doctor"><DoctorProfilePage /></ProtectedRoute>} />

                <Route path="/patient/appointment/:id" element={<ProtectedRoute requiredRole="patient"><KeyedByRouteParam><AppointmentDetailsPage /></KeyedByRouteParam></ProtectedRoute>} />
                <Route path="/doctor/appointment/:id" element={<ProtectedRoute requiredRole="doctor"><KeyedByRouteParam><AppointmentDetailsPage /></KeyedByRouteParam></ProtectedRoute>} />

                <Route path="/patient/appointments" element={<ProtectedRoute requiredRole="patient"><AppointmentListPage /></ProtectedRoute>} />
                <Route path="/doctor/appointments" element={<ProtectedRoute requiredRole="doctor"><AppointmentListPage /></ProtectedRoute>} />

                <Route path="/doctor/patients" element={<ProtectedRoute requiredRole="doctor"><PatientsListPage /></ProtectedRoute>} />
                <Route path="/doctor/patients/:id" element={<ProtectedRoute requiredRole="doctor"><KeyedByRouteParam><PatientDetailsPage /></KeyedByRouteParam></ProtectedRoute>} />

                <Route path="/patient/messages" element={<ProtectedRoute requiredRole="patient"><MessagesPage /></ProtectedRoute>} />
                <Route path="/doctor/messages" element={<ProtectedRoute requiredRole="doctor"><MessagesPage /></ProtectedRoute>} />

                <Route path="/patient/appointment/:id/room" element={<ProtectedRoute requiredRole="patient"><KeyedByRouteParam><AppointmentRoomPage /></KeyedByRouteParam></ProtectedRoute>} />
                <Route path="/doctor/appointment/:id/room" element={<ProtectedRoute requiredRole="doctor"><KeyedByRouteParam><AppointmentRoomPage /></KeyedByRouteParam></ProtectedRoute>} />

                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </BrowserRouter>

    )
}

export default App