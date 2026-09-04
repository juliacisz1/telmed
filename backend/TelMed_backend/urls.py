"""
URL configuration for TelMed_backend project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
"""
from dj_rest_auth.views import LoginView, LogoutView
from dj_rest_auth.jwt_auth import get_refresh_view
from django.contrib import admin
from django.urls import path
from TelMed.users.views import (
    UserView, RegisterPatientView, RegisterDoctorView, PasswordChangeView,
    SpecialtyListView, DoctorListView, DoctorDetailView,
    PasswordResetRequestView, PasswordResetConfirmView,
)
from TelMed.appointments.views import (
    DoctorScheduleView, AppointmentView, AppointmentDetailView, AvailableSlotsView,
    DoctorPatientsView, DoctorAbsenceView, DoctorAbsenceDetailView, AppointmentDocumentsView, PatientDocumentsView,
    ReviewView, DoctorReviewsView, MedicalDocumentPdfView, DrugListView, DiagnosisListView,
)
from TelMed.connection.views import ConversationListView, ConversationMessagesView, MessageFileView, \
    AppointmentMessagesView

urlpatterns = [
    path('admin/', admin.site.urls),

    path('token/', LoginView.as_view(), name='get_token'),
    path('token/refresh/', get_refresh_view().as_view(), name='refresh_token'),
    path('logout/', LogoutView.as_view(), name='logout'),

    #dane do logowania
    path('user/', UserView.as_view(), name='user_view'),

    #rejestracja
    path('register/patient/', RegisterPatientView.as_view(), name='patient_register'),
    path('register/doctor/', RegisterDoctorView.as_view(), name='doctor_register'),

    #zmiana hasła
    path('password-change/', PasswordChangeView.as_view(), name='password_change'),

    path('password-reset/', PasswordResetRequestView.as_view(), name='password_reset'),
    path('password-reset/confirm/', PasswordResetConfirmView.as_view(), name='password_reset_confirm'),

    #specjalizacje
    path('specialties/', SpecialtyListView.as_view(), name='specialties_list'),

    #lista lekarzy po wyszukaniu
    path('doctors/', DoctorListView.as_view(), name='doctor_list'),
    #strona publiczna lekarza
    path('doctors/<int:pk>/', DoctorDetailView.as_view(), name='doctor_detail'),

    #grafik lekarza
    path('doctor/schedule/', DoctorScheduleView.as_view(), name='doctor_schedule'),

    #WIZYTY
    path('appointments/', AppointmentView.as_view(), name='appointments'),
    path('doctor/absences/', DoctorAbsenceView.as_view(), name='doctor_absences'),
    path('doctor/absences/<int:pk>/', DoctorAbsenceDetailView.as_view(), name='doctor_absence_detail'),

    #detale danej wizyty
    path('appointments/<int:pk>/', AppointmentDetailView.as_view(), name='appointment_detail'),
    path('appointments/<int:pk>/messages/', AppointmentMessagesView.as_view(), name='appointment_messages'),

    #wolne terminy do lekarza
    path('doctors/<int:doctor_id>/slots/', AvailableSlotsView.as_view(), name='available_slots'),

    #lista pacjentów
    path('doctor/patients/', DoctorPatientsView.as_view(), name='doctor_patients'),

    #wiadomosci
    path('conversations/', ConversationListView.as_view(), name='conversations'),
    path('conversations/<int:pk>/messages/', ConversationMessagesView.as_view(), name='conversation_messages'),
    path('appointments/<int:pk>/documents/', AppointmentDocumentsView.as_view(), name='appointment_documents'),
    path('messages/<int:pk>/file/', MessageFileView.as_view(), name='message_file'),
    #oceny
    path('reviews/', ReviewView.as_view(), name='reviews'),
    path('doctors/<int:doctor_id>/reviews/', DoctorReviewsView.as_view(), name='doctor_reviews'),

    #dokumentacja medyczna
    path('patient/documents/', PatientDocumentsView.as_view(), name='patient_documents'),

    path('documents/<int:pk>/pdf/', MedicalDocumentPdfView.as_view(), name='document_pdf'),

    path('diagnoses/', DiagnosisListView.as_view(), name='diagnoses'),
    path('drugs/', DrugListView.as_view(), name='drugs'),

]
