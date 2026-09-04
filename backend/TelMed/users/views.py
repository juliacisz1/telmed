from functools import partial

from dj_rest_auth.jwt_auth import set_jwt_cookies
from django.conf import settings
from django.contrib.auth.tokens import default_token_generator
from django.db import IntegrityError, transaction
from django.db.models import Q
from django.utils import timezone
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
from rest_framework_simplejwt.tokens import RefreshToken

from TelMed.appointments.models import Appointment
from TelMed.appointments.tasks import cancel_reminder, send_cancellation_notification
from TelMed.users.models import Specialty, User
from TelMed.users.permissions import IsDoctorOrPatient
from TelMed.users.serializers import (
    DoctorMeSerializer, DoctorPublicSerializer, DoctorRegisterSerializer, PasswordChangeSerializer,
    PasswordResetConfirmSerializer, PasswordResetRequestSerializer, PatientMeSerializer,
    PatientRegisterSerializer, SpecialtySerializer,
)
from TelMed.users.tasks import (
    send_account_deleted_email, send_password_changed_email, send_password_reset_email,
    send_profile_updated_email, send_welcome_email,
)


def revoke_refresh_tokens(user):
    for token in OutstandingToken.objects.filter(user=user):
        BlacklistedToken.objects.get_or_create(token=token)


def start_session(response, user):
    refresh = RefreshToken.for_user(user)
    set_jwt_cookies(response, str(refresh.access_token), str(refresh))


def password_reset_url(user):
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)
    return f'{settings.FRONTEND_URL}/reset/{uid}/{token}'


def doctor_profiles():
    return (User.objects.filter(role='doctor', is_active=True)
            .select_related('doctor')
            .prefetch_related('doctor__specialties', 'doctor__reviews'))

def cancel_future_appointments(user):
    ids = list(
        Appointment.objects
        .filter(Q(patient__user=user) | Q(doctor__user=user),status='booked', start_time__gt=timezone.now())
        .values_list('id', flat=True)
    )
    for appointment_id in ids:
        with transaction.atomic():
            appointment = (Appointment.objects.select_for_update()
                           .filter(pk=appointment_id, status='booked').first())
            if not appointment:
                continue
            appointment.status = 'cancelled'
            appointment.save(update_fields=['status', 'updated_at'])
            transaction.on_commit(partial(send_cancellation_notification.delay, appointment_id), robust=True)
            transaction.on_commit(partial(cancel_reminder, appointment_id), robust=True)

class SpecialtyListView(generics.ListAPIView):
    queryset = Specialty.objects.all()
    serializer_class = SpecialtySerializer
    permission_classes = [AllowAny]
    authentication_classes = []

class RegisterView(generics.CreateAPIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            user = serializer.save()
        except IntegrityError as error:
            return Response(self.integrity_error(error), status=status.HTTP_400_BAD_REQUEST)
        transaction.on_commit(partial(send_welcome_email.delay, user.id), robust=True)
        return Response(status=status.HTTP_201_CREATED)

    def integrity_error(self, error):
        return {'email': ['Użytkownik o takim adresie e-mail już istnieje.']}


class RegisterPatientView(RegisterView):
    serializer_class = PatientRegisterSerializer


class RegisterDoctorView(RegisterView):
    serializer_class = DoctorRegisterSerializer

    def integrity_error(self, error):
        if 'pwz' in str(error).lower():
            return {'pwz_number': ['Lekarz z tym numerem PWZ już istnieje.']}
        return super().integrity_error(error)

class DoctorListView(generics.ListAPIView):
    serializer_class = DoctorPublicSerializer
    permission_classes = [AllowAny]
    authentication_classes = []

    def get_queryset(self):
        queryset = doctor_profiles()
        search = self.request.query_params.get('search', '')
        if search:
            query = Q()
            for word in search.split():
                query &= (Q(first_name__icontains=word) | Q(last_name__icontains=word) | Q(doctor__specialties__name__icontains=word))
            queryset = queryset.filter(query).distinct()
        return queryset


class DoctorDetailView(generics.RetrieveAPIView):
    serializer_class = DoctorPublicSerializer
    permission_classes = [AllowAny]
    authentication_classes = []
    queryset = doctor_profiles()
    lookup_field = 'doctor__id'
    lookup_url_kwarg = 'pk'

class UserView(generics.GenericAPIView):
    permission_classes = [IsDoctorOrPatient]

    def get_serializer_class(self):
        return DoctorMeSerializer if self.request.user.role == 'doctor' else PatientMeSerializer

    def get(self, request):
        return Response(self.get_serializer(request.user).data)

    def patch(self, request):
        serializer = self.get_serializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        try:
            serializer.save()
        except IntegrityError as error:
            if 'pwz' in str(error).lower():
                return Response({'pwz_number': ['Lekarz z tym numerem PWZ już istnieje.']}, status=status.HTTP_400_BAD_REQUEST)
            return Response({'email': ['Użytkownik o takim adresie e-mail już istnieje.']}, status=status.HTTP_400_BAD_REQUEST)
        transaction.on_commit(partial(send_profile_updated_email.delay, request.user.id), robust=True)
        return Response(serializer.data)

    def delete(self, request):
        user = request.user
        user.is_active = False
        user.save(update_fields=['is_active'])
        revoke_refresh_tokens(user)
        cancel_future_appointments(user)
        transaction.on_commit(partial(send_account_deleted_email.delay, user.email, user.first_name), robust=True)
        return Response(status=status.HTTP_204_NO_CONTENT)

class PasswordChangeView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = PasswordChangeSerializer

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = request.user
        user.set_password(serializer.validated_data['new_password'])
        user.save(update_fields=['password'])
        revoke_refresh_tokens(user)
        response = Response({'detail': 'Hasło zostało zmienione.'})
        start_session(response, user)
        transaction.on_commit(partial(send_password_changed_email.delay, user.id), robust=True)
        return response


class PasswordResetRequestView(generics.GenericAPIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    serializer_class = PasswordResetRequestSerializer

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = User.objects.filter(email__iexact=serializer.validated_data['email']).first()
        if user:
            transaction.on_commit(
                partial(send_password_reset_email.delay, user.id, password_reset_url(user)), robust=True)
        return Response({'detail': 'Wiadomość została wysłana.'})


class PasswordResetConfirmView(generics.GenericAPIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    serializer_class = PasswordResetConfirmSerializer

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = serializer.user
        user.set_password(serializer.validated_data['password'])
        user.save(update_fields=['password'])
        revoke_refresh_tokens(user)
        return Response({'detail': 'Hasło zostało zmienione.'})