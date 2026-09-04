import os
from datetime import datetime, timedelta, time
from functools import partial

from django.db import transaction, IntegrityError
from django.db.models import Avg, Q
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from TelMed.appointments.models import Appointment, Diagnosis, DoctorAbsence, DoctorSchedule, Drug, MedicalDocument, Review
from TelMed.appointments.pdf import generate_document_pdf
from TelMed.appointments.serializers import (AppointmentNotesSerializer, AppointmentSerializer, DiagnosisSerializer,
                                             DoctorAbsenceSerializer, DoctorAppointmentSerializer, DoctorPatientSerializer,
                                             DoctorScheduleSerializer, DrugSerializer,MedicalDocumentSerializer, PatientDocumentSerializer,
                                             PrescriptionSerializer, PublicReviewSerializer, ReferralSerializer, ReviewSerializer, SickLeaveSerializer
                                             )
from TelMed.appointments.tasks import cancel_reminder, schedule_reminder, send_booking_confirmation, send_cancellation_notification, send_reschedule_notification
from TelMed.users.models import Doctor, Patient
from TelMed.users.permissions import IsAppointmentParticipant, IsDoctor, IsDoctorOrPatient, IsOwningDoctor, IsPatient
from TelMed_backend.visit_utils import visit_room_open

DOC_SERIALIZER_CHOICE = {
    'prescription': PrescriptionSerializer,
    'referral': ReferralSerializer,
    'sick_leave': SickLeaveSerializer,
}

MIN_QUERY_LENGTH = 3

def get_appointment_slots(doctor, day):
    if doctor.default_duration <= 0:
        return []

    day_schedule = doctor.schedule.filter(day_of_week=day.weekday(), is_working=True).first()
    if not day_schedule:
        return []

    absences = list(doctor.absences.filter(start_date__lte=day, end_date__gte=day))
    if any(absence.all_day for absence in absences):
        return []

    duration = timedelta(minutes=doctor.default_duration)
    current = timezone.make_aware(datetime.combine(day, day_schedule.start_time))
    day_end = timezone.make_aware(datetime.combine(day, day_schedule.end_time))

    slots = []
    while current + duration <= day_end:
        slot_end = current + duration
        in_absence = any(absence.start_time < slot_end.time() and absence.end_time > current.time() for absence in absences)
        if not in_absence:
            slots.append((current, slot_end))
        current = slot_end
    return slots


def is_slot_in_schedule(doctor, start, end):
    if start <= timezone.now():
        return False
    return (start, end) in get_appointment_slots(doctor, timezone.localtime(start).date())


def end_of_day(start):
    local_start = timezone.localtime(start)
    return timezone.make_aware(datetime.combine(local_start.date() + timedelta(days=1), time.min))


def has_conflict(start, end, doctor=None, patient=None, exclude_pk=None):
    conflicts = Appointment.objects.filter(status='booked', start_time__lt=end, end_time__gt=start)
    if doctor is not None:
        conflicts = conflicts.filter(doctor=doctor)
    if patient is not None:
        conflicts = conflicts.filter(patient=patient)
    if exclude_pk is not None:
        conflicts = conflicts.exclude(pk=exclude_pk)
    return conflicts.exists()



class DoctorScheduleView(generics.GenericAPIView):
    permission_classes = [IsDoctor]
    serializer_class = DoctorScheduleSerializer

    def get_queryset(self):
        return DoctorSchedule.objects.filter(doctor=self.request.user.doctor)

    def get(self, request):
        return Response(self.get_serializer(self.get_queryset(), many=True).data)

    def put(self, request):
        serializer = self.get_serializer(data=request.data, many=True)
        serializer.is_valid(raise_exception=True)
        doctor = request.user.doctor

        with transaction.atomic():
            Doctor.objects.select_for_update().get(pk=doctor.pk)
            for day_data in serializer.validated_data:
                DoctorSchedule.objects.update_or_create(
                    doctor=doctor,
                    day_of_week=day_data['day_of_week'],
                    defaults={
                        'is_working': day_data['is_working'],
                        'start_time': day_data.get('start_time'),
                        'end_time': day_data.get('end_time'),
                    },
                )
        return Response(self.get_serializer(self.get_queryset(), many=True).data)

class AppointmentView(generics.GenericAPIView):
    permission_classes = [IsDoctorOrPatient]

    def get_queryset(self):
        user = self.request.user
        owner = {'doctor': user.doctor} if user.role == 'doctor' else {'patient': user.patient}
        return (Appointment.objects.filter(**owner)
                .select_related('doctor__user', 'patient__user', 'review'))

    def get_serializer_class(self):
        return DoctorAppointmentSerializer if self.request.user.role == 'doctor' else AppointmentSerializer

    def get(self, request):
        return Response(self.get_serializer(self.get_queryset(), many=True).data)

    def post(self, request):
        if request.user.role == 'doctor':
            return self.book_as_doctor(request)
        return self.book_as_patient(request)

    def book_as_patient(self, request):
        patient = request.user.patient
        if not patient.pesel or not patient.date_of_birth:
            return Response({'detail': 'Dodaj numer PESEL i datę urodzenia aby umówić wizytę.'},
                            status=status.HTTP_400_BAD_REQUEST)

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        doctor = serializer.validated_data['doctor']
        start = serializer.validated_data['start_time']
        end = serializer.validated_data['end_time']
        confirmed = bool(request.data.get('confirm_conflict'))

        with transaction.atomic():
            Doctor.objects.select_for_update().get(pk=doctor.pk)

            if not is_slot_in_schedule(doctor, start, end):
                return Response({'detail': 'Wybierz jeden z terminów dostępnych na liście.'},
                                status=status.HTTP_400_BAD_REQUEST)

            #wizyty mogą się nakładać pacjentowi
            if has_conflict(start, end, patient=patient) and not confirmed:
                return Response({'detail': 'Masz już wizytę w tym czasie. Czy na pewno chcesz umówić kolejną?'},
                                status=status.HTTP_409_CONFLICT)

            #lekarz ma zajęty termin, który pacjent umawia
            if has_conflict(start, end, doctor=doctor):
                return Response({'detail': 'Ten termin jest już zajęty.'}, status=status.HTTP_400_BAD_REQUEST)

            appointment = serializer.save(patient=patient)
            transaction.on_commit(partial(send_booking_confirmation.delay, appointment.id), robust=True)
            transaction.on_commit(partial(schedule_reminder, appointment.id), robust=True)

        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def book_as_doctor(self, request):
        doctor = request.user.doctor
        patient_id = request.data.get('patient')
        patient = Patient.objects.filter(id=patient_id, appointments__doctor=doctor).distinct().first()
        if patient is None:
            return Response({'patient': ['Wskaż pacjenta, z którym masz już wizytę.']},
                            status=status.HTTP_400_BAD_REQUEST)

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        start = serializer.validated_data['start_time']
        end = serializer.validated_data['end_time']
        confirmed = bool(request.data.get('confirm_conflict'))

        if start <= timezone.now():
            return Response({'detail': 'Termin wizyty musi być w przyszłości.'}, status=status.HTTP_400_BAD_REQUEST)
        #wizyta musi się zakończyć w dniu jej rozpoczęcia
        if end > end_of_day(start):
            return Response({'detail': 'Wizyta musi zakończyć się tego samego dnia.'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            Doctor.objects.select_for_update().get(pk=doctor.pk)
            if has_conflict(start, end, doctor=doctor) and not confirmed:
                return Response({'detail': 'Masz już wizytę w tym czasie. Czy na pewno chcesz umówić kolejną?'}, status=status.HTTP_409_CONFLICT)

            appointment = serializer.save(doctor=doctor, patient=patient)
            transaction.on_commit(partial(send_booking_confirmation.delay, appointment.id), robust=True)
            transaction.on_commit(partial(schedule_reminder, appointment.id), robust=True)

        return Response(serializer.data, status=status.HTTP_201_CREATED)


class AppointmentDetailView(generics.GenericAPIView):
    queryset = Appointment.objects.select_related('doctor__user', 'patient__user', 'review')
    serializer_class = AppointmentSerializer
    permission_classes = [IsAuthenticated, IsAppointmentParticipant]

    def get(self, request, pk):
        return Response(self.get_serializer(self.get_object()).data)

    def patch(self, request, pk):
        appointment = self.get_object()

        if request.data.get('status') == 'cancelled':
            return self.cancel_appointment(request, appointment)

        if request.data.get('start_time') and request.data.get('end_time'):
            return self.reschedule_appointment(request, appointment)

        if request.data.get('status') == 'completed':
            return self.finish_appointment(request, appointment)

        if 'advice' in request.data or 'notes' in request.data:
            return self.update_notes(request, appointment)
        return Response({'detail': 'Brak danych do zmiany.'}, status=status.HTTP_400_BAD_REQUEST)

    def cancel_appointment(self, request, appointment):
        with transaction.atomic():
            appointment = Appointment.objects.select_for_update().get(pk=appointment.pk)
            if appointment.status == 'cancelled':
                return Response({'detail': 'Wizyta została już anulowana.'}, status=status.HTTP_400_BAD_REQUEST)

            if appointment.status != 'booked':
                return Response({'detail': 'Anulować można wyłącznie umówioną wizytę.'}, status=status.HTTP_400_BAD_REQUEST)

            if appointment.start_time <= timezone.now():
                return Response({'detail': 'Rozpoczętej wizyty nie można anulować.'}, status=status.HTTP_400_BAD_REQUEST)

            appointment.status = 'cancelled'
            appointment.save(update_fields=['status', 'updated_at'])
            transaction.on_commit(partial(send_cancellation_notification.delay, appointment.id), robust=True)
            transaction.on_commit(partial(cancel_reminder, appointment.id), robust=True)

        return Response(self.get_serializer(appointment).data)

    def reschedule_appointment(self, request, appointment):
        confirmed = bool(request.data.get('confirm_conflict'))

        new_start = parse_datetime(str(request.data.get('start_time', '')))
        new_end = parse_datetime(str(request.data.get('end_time', '')))

        if not new_start or not new_end or new_end <= new_start:
            return Response({'detail': 'Nieprawidłowy termin wizyty.'}, status=status.HTTP_400_BAD_REQUEST)

        if new_end > end_of_day(new_start):
            return Response({'detail': 'Wizyta musi zakończyć się tego samego dnia.'}, status=status.HTTP_400_BAD_REQUEST)

        if new_start <= timezone.now():
            return Response({'detail': 'Termin wizyty musi być w przyszłości.'}, status=status.HTTP_400_BAD_REQUEST)

        if appointment.start_time <= timezone.now():
            return Response({'detail': 'Rozpoczętej wizyty nie można zmienić.'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            Doctor.objects.select_for_update().get(pk=appointment.doctor_id)
            appointment = Appointment.objects.select_for_update().get(pk=appointment.pk)

            if appointment.status != 'booked':
                return Response({'detail': 'Termin można zmienić wyłącznie w umówionej wizycie.'}, status=status.HTTP_400_BAD_REQUEST)


            if request.user.role == 'patient':
                if not is_slot_in_schedule(appointment.doctor, new_start, new_end):
                    return Response({'detail': 'Wybierz jeden z terminów dostępnych na liście.'}, status=status.HTTP_400_BAD_REQUEST)

                if has_conflict(new_start, new_end, exclude_pk=appointment.pk, patient=appointment.patient) and not confirmed:
                    return Response({'detail':'Masz już wizytę w tym czasie. Czy na pewno chcesz zmienić wizytę na ten termin?'},
                                    status=status.HTTP_409_CONFLICT)


            if has_conflict(new_start, new_end, exclude_pk=appointment.pk, doctor=appointment.doctor):
                if request.user.role != 'doctor':
                    return Response({'detail': 'Ten termin jest już zajęty.'}, status=status.HTTP_400_BAD_REQUEST)

                if not confirmed:
                    return Response({'detail':'Masz już wizytę w tym czasie. Czy na pewno chcesz zmienić wizytę na ten termin?'},
                                    status=status.HTTP_409_CONFLICT)

            appointment.start_time = new_start
            appointment.end_time = new_end
            appointment.save(update_fields=['start_time', 'end_time', 'updated_at'])
            transaction.on_commit(partial(send_reschedule_notification.delay, appointment.id), robust=True)
            transaction.on_commit(partial(schedule_reminder, appointment.id), robust=True)

        return Response(self.get_serializer(appointment).data)

    def finish_appointment(self, request, appointment):
        if request.user.role != 'doctor':
            return Response({'detail': 'Wizytę może zakończyć wyłącznie lekarz.'}, status=status.HTTP_403_FORBIDDEN)

        with transaction.atomic():
            appointment = Appointment.objects.select_for_update().get(pk=appointment.pk)

            if appointment.status != 'booked':
                return Response({'detail': 'Zakończyć można wyłącznie umówioną wizytę.'}, status=status.HTTP_400_BAD_REQUEST)

            appointment.status = 'completed'
            appointment.save(update_fields=['status', 'updated_at'])

        return Response(self.get_serializer(appointment).data)

    def update_notes(self, request, appointment):
        if request.user.role != 'doctor':
            return Response({'detail': 'Dokumentację może uzupełniac jedynie lekarz.'}, status=status.HTTP_403_FORBIDDEN)

        if not visit_room_open(appointment):
            return Response({'detail': 'Nie można wystawiać dokumentów'}, status=status.HTTP_400_BAD_REQUEST)

        serializer = AppointmentNotesSerializer(appointment, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(self.get_serializer(appointment).data)


class AvailableSlotsView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request, doctor_id):
        doctor = get_object_or_404(Doctor, id=doctor_id)

        date_str = request.query_params.get('date')
        if not date_str:
            return Response({'detail': 'Podaj datę.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            day = datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            return Response({'detail': 'Zły format daty, musi być RRRR-MM-DD.'}, status=status.HTTP_400_BAD_REQUEST)

        booked = list(Appointment.objects
                      .filter(doctor=doctor, status='booked', start_time__date=day)
                      .values_list('start_time', 'end_time'))
        now = timezone.now()

        slots = [
            {'start_time': start.isoformat(), 'end_time': end.isoformat()}
            for start, end in get_appointment_slots(doctor, day)
            if start > now and not any(b_start < end and b_end > start for b_start, b_end in booked)
        ]
        return Response(slots)


class DoctorPatientsView(generics.ListAPIView):
    permission_classes = [IsDoctor]
    serializer_class = DoctorPatientSerializer

    def get_queryset(self):
        return (Patient.objects
                .filter(appointments__doctor=self.request.user.doctor)
                .distinct()
                .select_related('user')
                .order_by('user__last_name', 'user__first_name'))

class DoctorAbsenceView(generics.GenericAPIView):
    permission_classes = [IsDoctor]
    serializer_class = DoctorAbsenceSerializer

    def get_queryset(self):
        return DoctorAbsence.objects.filter(doctor=self.request.user.doctor).order_by('start_date', 'start_time')

    def get(self, request):
        return Response(self.get_serializer(self.get_queryset(), many=True).data)

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            Doctor.objects.select_for_update().get(pk=request.user.doctor.pk)
            serializer.save(doctor=request.user.doctor)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class DoctorAbsenceDetailView(generics.GenericAPIView):
    queryset = DoctorAbsence.objects.all()
    serializer_class = DoctorAbsenceSerializer
    permission_classes = [IsDoctor, IsOwningDoctor]

    def patch(self, request, pk):
        absence = self.get_object()
        serializer = self.get_serializer(absence, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            Doctor.objects.select_for_update().get(pk=request.user.doctor.pk)
            serializer.save()
        return Response(serializer.data)

    def delete(self, request, pk):
        absence = self.get_object()

        with transaction.atomic():
            Doctor.objects.select_for_update().get(pk=request.user.doctor.pk)
            absence.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class DiagnosisListView(generics.ListAPIView):
    permission_classes = [IsDoctor]
    serializer_class = DiagnosisSerializer

    def get_queryset(self):
        search = self.request.query_params.get('search', '').strip()
        if len(search) < MIN_QUERY_LENGTH:
            return Diagnosis.objects.none()
        return Diagnosis.objects.filter(Q(name__icontains=search) | Q(code__istartswith=search))


class DrugListView(generics.ListAPIView):
    permission_classes = [IsDoctor]
    serializer_class = DrugSerializer

    def get_queryset(self):
        search = self.request.query_params.get('search', '').strip()
        if len(search) < MIN_QUERY_LENGTH:
            return Drug.objects.none()
        return Drug.objects.filter(name__icontains=search)


class AppointmentDocumentsView(generics.GenericAPIView):
    queryset = Appointment.objects.select_related('doctor__user', 'patient__user')
    permission_classes = [IsAuthenticated, IsAppointmentParticipant]

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsDoctor(), IsAppointmentParticipant()]
        return super().get_permissions()

    def get(self, request, pk):
        appointment = self.get_object()
        serializer = MedicalDocumentSerializer(appointment.documents.all(), many=True, context=self.get_serializer_context())
        return Response(serializer.data)

    def post(self, request, pk):
        appointment = self.get_object()
        if not visit_room_open(appointment):
            return Response({'detail': 'Nie mozna wystawiać dokumentów.'}, status=status.HTTP_400_BAD_REQUEST)

        serializer_class = DOC_SERIALIZER_CHOICE[request.data.get('doc_type')]
        serializer = serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            with transaction.atomic():
                document = serializer.save(appointment=appointment)
                generate_document_pdf(document)
        except Exception:
            return Response({'detail': 'Błąd generowania dokumentu.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        return Response(MedicalDocumentSerializer(document, context=self.get_serializer_context()).data, status=status.HTTP_201_CREATED)


class PatientDocumentsView(generics.ListAPIView):
    permission_classes = [IsPatient]
    serializer_class = PatientDocumentSerializer

    def get_queryset(self):
        return (MedicalDocument.objects
                .filter(appointment__patient=self.request.user.patient)
                .select_related('appointment__doctor__user')
                .order_by('-created_at'))


class MedicalDocumentPdfView(generics.GenericAPIView):
    queryset = MedicalDocument.objects.select_related('appointment')
    permission_classes = [IsAuthenticated, IsAppointmentParticipant]

    def get(self, request, pk):
        document = self.get_object()
        if not document.pdf_file:
            return Response({'detail': 'Plik nie istnieje.'}, status=status.HTTP_404_NOT_FOUND)
        return FileResponse(document.pdf_file.open('rb'), filename=os.path.basename(document.pdf_file.name))

class ReviewView(generics.GenericAPIView):
    permission_classes = [IsPatient, IsAppointmentParticipant]
    serializer_class = ReviewSerializer

    def post(self, request):
        appointment = Appointment.objects.filter(pk=request.data.get('appointment')).first()
        if appointment is None:
            return Response({'appointment': ['Nie znaleziono wizyty.']}, status=status.HTTP_400_BAD_REQUEST)
        self.check_object_permissions(request, appointment)

        already_happened = appointment.end_time <= timezone.now()
        if appointment.status == 'cancelled' or not (appointment.status == 'completed' or already_happened):
            return Response({'detail': 'Wizytę można ocenić dopiero po jej zakończeniu.'}, status=status.HTTP_400_BAD_REQUEST)

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            with transaction.atomic():
                serializer.save(doctor=appointment.doctor, patient=request.user.patient)
        except IntegrityError:
            return Response({'detail': 'Wizyta została już oceniona.'}, status=status.HTTP_400_BAD_REQUEST)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class DoctorReviewsView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request, doctor_id):
        reviews = Review.objects.filter(doctor_id=doctor_id).select_related('patient__user')
        return Response(PublicReviewSerializer(reviews, many=True).data)