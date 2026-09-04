from datetime import date

from rest_framework.test import APITestCase

from TelMed.users.models import Doctor, Patient, Specialty, User

# https://www.django-rest-framework.org/api-guide/testing/

PASSWORD = 'VeryDifficultTestPassword123.'


def get_test_users():
    doctor_user = User.objects.create_user(email='doctor@test.com', password=PASSWORD, first_name='Doctor', last_name='Test', role='doctor')
    doctor = Doctor.objects.create(user=doctor_user, pwz_number='1234567')
    patient_user1 = User.objects.create_user(email='patient1@test.com', password=PASSWORD,first_name='Patient1', last_name='Test',
                                             role='patient')
    patient1 = Patient.objects.create(user=patient_user1, pesel='00210112344', date_of_birth=date(2000, 1, 1))
    patient_user2 = User.objects.create_user(email='patient2@test.com', password=PASSWORD,
                                             first_name='Patient2', last_name='Test', role='patient')
    patient2 = Patient.objects.create(user=patient_user2, pesel='00210212341', date_of_birth=date(2000, 1, 2))
    return doctor, patient1, patient2


class UserTests(APITestCase):
    def setUp(self):
        self.doctor, self.patient1, self.patient2 = get_test_users()

    def test_register_patient(self):
        response = self.client.post('/register/patient/', {
            'first_name': 'Patient3', 'last_name': 'Test', 'email': 'patient3@test.com',
            'password': PASSWORD, 'password_confirm': PASSWORD,
        }, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertTrue(User.objects.filter(email='patient3@test.com').exists())

    def test_register_doctor(self):
        specialty = Specialty.objects.create(name='Kardiolog')
        response = self.client.post('/register/doctor/', {
            'first_name': 'Doctor2', 'last_name': 'Test', 'email': 'doctor2@test.com',
            'password': PASSWORD, 'password_confirm': PASSWORD,
            'pwz_number': '7654321', 'specialty': specialty.id,
        }, format='json')
        self.assertEqual(response.status_code, 201)

    def test_register_same_email_twice(self):
        response = self.client.post('/register/patient/', {
            'first_name': 'Patient1', 'last_name': 'Test', 'email': 'patient1@test.com',
            'password': PASSWORD, 'password_confirm': PASSWORD,
        }, format='json')
        self.assertEqual(response.status_code, 400)

    def test_login(self):
        response = self.client.post('/token/', {'email': 'patient1@test.com', 'password': PASSWORD}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.cookies['access_token']['httponly'])

    def test_login_wrong_password(self):
        response = self.client.post('/token/', {'email': 'patient1@test.com', 'password': 'WrongPassword123.'},
                                    format='json')
        self.assertEqual(response.status_code, 400)

    def test_user_page_needs_login(self):
        response = self.client.get('/user/')
        self.assertEqual(response.status_code, 401)

    def test_user_page_after_login(self):
        self.client.post('/token/', {'email': 'patient1@test.com', 'password': PASSWORD}, format='json')
        response = self.client.get('/user/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['email'], 'patient1@test.com')

    def test_user_can_edit_profile(self):
        self.client.post('/token/', {'email': 'patient1@test.com', 'password': PASSWORD}, format='json')
        response = self.client.patch('/user/', {'first_name': 'DifferentPatient'}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['first_name'], 'DifferentPatient')

    def test_logout(self):
        self.client.post('/token/', {'email': 'patient1@test.com', 'password': PASSWORD}, format='json')
        self.client.post('/logout/')
        response = self.client.get('/user/')
        self.assertEqual(response.status_code, 401)

    def test_delete_user(self):
        self.client.post('/token/', {'email': 'patient1@test.com', 'password': PASSWORD}, format='json')
        response = self.client.delete('/user/')
        self.assertEqual(response.status_code, 204)
        deleted_patient = User.objects.get(email='patient1@test.com')
        self.assertFalse(deleted_patient.is_active)
        login = self.client.post('/token/', {'email': 'patient1@test.com', 'password': PASSWORD}, format='json')
        self.assertNotEqual(login.status_code, 200)