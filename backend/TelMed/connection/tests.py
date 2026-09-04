import json
from datetime import date, timedelta

from channels.db import database_sync_to_async
from channels.testing import WebsocketCommunicator
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TransactionTestCase
from django.utils import timezone
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from TelMed.appointments.models import Appointment
from TelMed.connection.models import Conversation
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


class MessageTests(APITestCase):
    def setUp(self):
        self.doctor, self.patient1, self.patient2 = get_test_users()
        self.conversation = Conversation.objects.create(doctor=self.doctor, patient=self.patient1)
        self.client.force_authenticate(user=self.patient1.user)

    def test_upload_png(self):
        file = SimpleUploadedFile('photo.png', b'\x89PNG\r\n\x1a\n' + b'\x00' * 64, content_type='image/png')
        response = self.client.post(f'/conversations/{self.conversation.id}/messages/', {'file': file})
        self.assertEqual(response.status_code, 201)

    def test_upload_too_big(self):
        file = SimpleUploadedFile('big_file.pdf', b'%PDF-' + b'\x00' * (5 * 1024 * 1024),
                                  content_type='application/pdf')
        response = self.client.post(f'/conversations/{self.conversation.id}/messages/', {'file': file})
        self.assertEqual(response.status_code, 400)

    def test_upload_renamed_file(self):
        file = SimpleUploadedFile('wrong_signature.pdf', b'MZ\x90\x00 fake data', content_type='application/pdf')
        response = self.client.post(f'/conversations/{self.conversation.id}/messages/', {'file': file})
        self.assertEqual(response.status_code, 400)

    def test_stranger_cant_read_conversation(self):
        self.client.force_authenticate(user=self.patient2.user)
        response = self.client.get(f'/conversations/{self.conversation.id}/messages/')
        self.assertEqual(response.status_code, 403)


class WebSocketTests(TransactionTestCase):
    def setUp(self):
        self.doctor, self.patient1, self.patient2 = get_test_users()
        now = timezone.now()
        self.appointment = Appointment.objects.create(doctor=self.doctor, patient=self.patient1,
                                                      start_time=now - timedelta(minutes=5),
                                                      end_time=now + timedelta(minutes=25))

    def connect_as(self, user):
        from TelMed_backend.asgi import application
        token = str(RefreshToken.for_user(user).access_token)
        return WebsocketCommunicator(application, f'/ws/appointment-chat/{self.appointment.id}/', headers=[
            (b'origin', b'http://localhost'), (b'host', b'localhost'),
            (b'cookie', f'access_token={token}'.encode()),
        ])

    async def test_stranger_is_rejected(self):
        communicator = await database_sync_to_async(self.connect_as)(self.patient2.user)
        connected, code = await communicator.connect()
        self.assertFalse(connected)
        self.assertEqual(code, 1008)

    async def test_message_reaches_doctor(self):
        patient = await database_sync_to_async(self.connect_as)(self.patient1.user)
        doctor = await database_sync_to_async(self.connect_as)(self.doctor.user)
        await patient.connect()
        await doctor.connect()
        await patient.send_to(text_data=json.dumps({'message': 'Dzień dobry'}))
        received = json.loads(await doctor.receive_from())
        self.assertEqual(received['message'], 'Dzień dobry')
        await patient.disconnect()
        await doctor.disconnect()

    async def test_too_long_message_is_ignored(self):
        patient = await database_sync_to_async(self.connect_as)(self.patient1.user)
        doctor = await database_sync_to_async(self.connect_as)(self.doctor.user)
        await patient.connect()
        await doctor.connect()

        await patient.send_to(text_data=json.dumps({'message': 'a' * 501}))
        self.assertTrue(await doctor.receive_nothing())

        await patient.disconnect()
        await doctor.disconnect()


class VideoSignallingTests(TransactionTestCase):
    def setUp(self):
        self.doctor, self.patient1, self.patient2 = get_test_users()
        now = timezone.now()
        self.appointment = Appointment.objects.create(doctor=self.doctor, patient=self.patient1,
                                                      start_time=now - timedelta(minutes=5),
                                                      end_time=now + timedelta(minutes=25))

    def connect_as(self, user):
        from TelMed_backend.asgi import application
        token = str(RefreshToken.for_user(user).access_token)
        return WebsocketCommunicator(application, f'/ws/connection/{self.appointment.id}/', headers=[
            (b'origin', b'http://localhost'), (b'host', b'localhost'),
            (b'cookie', f'access_token={token}'.encode()),
        ])

    async def test_offer_reaches_the_other_side(self):
        doctor = await database_sync_to_async(self.connect_as)(self.doctor.user)
        patient = await database_sync_to_async(self.connect_as)(self.patient1.user)
        await doctor.connect()
        await patient.connect()

        await doctor.send_to(text_data=json.dumps(
            {'type': 'offer', 'sdp': {'type': 'offer', 'sdp': 'v=0'}}))
        received = json.loads(await patient.receive_from())
        self.assertEqual(received['type'], 'offer')

        await doctor.disconnect()
        await patient.disconnect()

    async def test_only_doctor_can_end_the_visit(self):
        doctor = await database_sync_to_async(self.connect_as)(self.doctor.user)
        patient = await database_sync_to_async(self.connect_as)(self.patient1.user)
        await doctor.connect()
        await patient.connect()

        await patient.send_to(text_data=json.dumps({'type': 'ended'}))
        self.assertTrue(await doctor.receive_nothing())

        await doctor.disconnect()
        await patient.disconnect()