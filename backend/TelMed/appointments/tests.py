import threading
from datetime import date, time, timedelta

from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import connection
from django.test import TransactionTestCase
from django.utils import timezone
from rest_framework.test import APIClient, APITestCase

from TelMed.appointments.models import Appointment, DoctorSchedule, MedicalDocument
from TelMed.users.models import Doctor, Patient, User


PASSWORD = 'VeryDifficultTestPassword123.'


def get_test_users():
    doctor_user = User.objects.create_user(email='doctor@test.com', password=PASSWORD,
                                           first_name='Doctor', last_name='Test', role='doctor')
    doctor = Doctor.objects.create(user=doctor_user, pwz_number='1234567')
    patient_user1 = User.objects.create_user(email='patient1@test.com', password=PASSWORD,
                                             first_name='Patient1', last_name='Test', role='patient')
    patient1 = Patient.objects.create(user=patient_user1, pesel='00210112344', date_of_birth=date(2000, 1, 1))
    patient_user2 = User.objects.create_user(email='patient2@test.com', password=PASSWORD,
                                             first_name='Patient2', last_name='Test', role='patient')
    patient2 = Patient.objects.create(user=patient_user2, pesel='00210212341', date_of_birth=date(2000, 1, 2))
    return doctor, patient1, patient2


def create_schedule(doctor):
    for day in range(7):
        DoctorSchedule.objects.create(doctor=doctor, day_of_week=day, is_working=True,
                                      start_time=time(8, 0), end_time=time(12, 0))


class AppointmentTests(APITestCase):
    def setUp(self):
        self.doctor, self.patient1, self.patient2 = get_test_users()
        create_schedule(self.doctor)

        tomorrow = timezone.localdate() + timedelta(days=1)
        self.start = timezone.make_aware(timezone.datetime.combine(tomorrow, time(8, 0)))
        self.end = self.start + timedelta(minutes=30)
        self.slot = {'start_time': self.start.isoformat(), 'end_time': self.end.isoformat()}

    def test_free_slots(self):
        day = (timezone.localdate() + timedelta(days=1)).isoformat()
        response = self.client.get(f'/doctors/{self.doctor.id}/slots/?date={day}')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 8)

    def test_book_appointment(self):
        self.client.force_authenticate(user=self.patient1.user)
        response = self.client.post('/appointments/', {'doctor': self.doctor.id, **self.slot}, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(Appointment.objects.count(), 1)

    def test_book_taken_slot(self):
        Appointment.objects.create(doctor=self.doctor, patient=self.patient1, start_time=self.start, end_time=self.end)
        self.client.force_authenticate(user=self.patient2.user)
        response = self.client.post('/appointments/', {'doctor': self.doctor.id, **self.slot}, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(Appointment.objects.count(), 1)

    def test_book_outside_schedule(self):
        self.client.force_authenticate(user=self.patient1.user)
        response = self.client.post('/appointments/', {
            'doctor': self.doctor.id,
            'start_time': (self.start + timedelta(hours=6)).isoformat(),
            'end_time': (self.end + timedelta(hours=6)).isoformat(),
        }, format='json')
        self.assertEqual(response.status_code, 400)

    def test_book_without_pesel(self):
        user = User.objects.create_user(email='patient3@test.com', password=PASSWORD,
                                        first_name='Patient3', last_name='Test', role='patient')
        Patient.objects.create(user=user)
        self.client.force_authenticate(user=user)
        response = self.client.post('/appointments/', {'doctor': self.doctor.id, **self.slot}, format='json')
        self.assertEqual(response.status_code, 400)

    def test_see_own_appointment(self):
        appointment = Appointment.objects.create(doctor=self.doctor, patient=self.patient1,
                                                 start_time=self.start, end_time=self.end)
        self.client.force_authenticate(user=self.patient1.user)
        response = self.client.get(f'/appointments/{appointment.id}/')
        self.assertEqual(response.status_code, 200)

    def test_cannot_see_someone_elses_appointment(self):
        appointment = Appointment.objects.create(doctor=self.doctor, patient=self.patient1,
                                                 start_time=self.start, end_time=self.end)
        self.client.force_authenticate(user=self.patient2.user)
        response = self.client.get(f'/appointments/{appointment.id}/')
        self.assertEqual(response.status_code, 403)

    def test_patient_cannot_open_doctor_schedule(self):
        self.client.force_authenticate(user=self.patient1.user)
        response = self.client.get('/doctor/schedule/')
        self.assertEqual(response.status_code, 403)

    def test_cancel_appointment(self):
        appointment = Appointment.objects.create(doctor=self.doctor, patient=self.patient1,
                                                 start_time=self.start, end_time=self.end)
        self.client.force_authenticate(user=self.patient1.user)
        response = self.client.patch(f'/appointments/{appointment.id}/', {'status': 'cancelled'}, format='json')
        self.assertEqual(response.status_code, 200)
        appointment.refresh_from_db()
        self.assertEqual(appointment.status, 'cancelled')

    def test_patient_cannot_write_doctor_notes(self):
        appointment = Appointment.objects.create(doctor=self.doctor, patient=self.patient1,
                                                 start_time=self.start, end_time=self.end)
        self.client.force_authenticate(user=self.patient1.user)
        response = self.client.patch(f'/appointments/{appointment.id}/', {'notes': 'x'}, format='json')
        self.assertEqual(response.status_code, 403)

    def test_schedule_end_before_start(self):
        self.client.force_authenticate(user=self.doctor.user)
        response = self.client.put('/doctor/schedule/', [
            {'day_of_week': 0, 'is_working': True, 'start_time': '12:00', 'end_time': '08:00'},
        ], format='json')
        self.assertEqual(response.status_code, 400)


class ScheduleChangeTests(APITestCase):
    def setUp(self):
        self.doctor, self.patient1, self.patient2 = get_test_users()
        create_schedule(self.doctor)

        self.tomorrow = timezone.localdate() + timedelta(days=1)
        start = timezone.make_aware(timezone.datetime.combine(self.tomorrow, time(8, 0)))
        self.slot = {'start_time': start.isoformat(), 'end_time': (start + timedelta(minutes=30)).isoformat()}

    def test_slot_gone_after_schedule_change(self):
        self.client.force_authenticate(user=self.doctor.user)
        response = self.client.put('/doctor/schedule/', [
            {'day_of_week': self.tomorrow.weekday(), 'is_working': True,
             'start_time': '10:00', 'end_time': '12:00'},
        ], format='json')
        self.assertEqual(response.status_code, 200)

        self.client.force_authenticate(user=self.patient1.user)
        response = self.client.post('/appointments/', {'doctor': self.doctor.id, **self.slot}, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(Appointment.objects.count(), 0)


class BookingRaceTests(TransactionTestCase):
    def setUp(self):
        self.doctor, self.patient1, self.patient2 = get_test_users()
        create_schedule(self.doctor)

        tomorrow = timezone.localdate() + timedelta(days=1)
        start = timezone.make_aware(timezone.datetime.combine(tomorrow, time(8, 0)))
        self.slot = {'start_time': start.isoformat(), 'end_time': (start + timedelta(minutes=30)).isoformat()}

        self.barrier = threading.Barrier(2)
        self.results = []

    def book(self, user):
        client = APIClient()
        client.force_authenticate(user=user)
        self.barrier.wait()
        response = client.post('/appointments/', {'doctor': self.doctor.id, **self.slot}, format='json')
        self.results.append(response.status_code)
        connection.close()

    def test_two_patients_book_the_same_slot(self):
        threads = [threading.Thread(target=self.book, args=(user,))
                   for user in (self.patient1.user, self.patient2.user)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()

        self.assertEqual(sorted(self.results), [201, 400])
        self.assertEqual(Appointment.objects.count(), 1)


class DocumentAccessTests(APITestCase):
    def setUp(self):
        self.doctor, self.patient1, self.patient2 = get_test_users()

        now = timezone.now()
        appointment = Appointment.objects.create(doctor=self.doctor, patient=self.patient1,
                                                 start_time=now - timedelta(minutes=30),
                                                 end_time=now - timedelta(minutes=10))
        self.document = MedicalDocument.objects.create(
            appointment=appointment, doc_type='prescription',
            pdf_file=SimpleUploadedFile('prescription.pdf', b'%PDF-1.4 content', content_type='application/pdf'))

    def test_patient_can_download_own_document(self):
        self.client.force_authenticate(user=self.patient1.user)
        response = self.client.get(f'/documents/{self.document.id}/pdf/')
        self.assertEqual(response.status_code, 200)

    def test_stranger_cannot_download_document(self):
        self.client.force_authenticate(user=self.patient2.user)
        response = self.client.get(f'/documents/{self.document.id}/pdf/')
        self.assertEqual(response.status_code, 403)