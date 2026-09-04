from rest_framework.permissions import BasePermission


def has_profile(user, role):
    return bool(user and user.is_authenticated and user.role == role and hasattr(user, role))


def is_doctor_and_patient(user, obj):
    if user.role == 'doctor':
        return obj.doctor.user_id == user.id
    if user.role == 'patient':
        return obj.patient.user_id == user.id
    return False


class IsDoctor(BasePermission):
    message = 'Musisz być lekarzem, aby uzyskać dostęp do tego zasobu.'

    def has_permission(self, request, view):
        return has_profile(request.user, 'doctor')


class IsPatient(BasePermission):
    message = 'Musisz być pacjentem, aby uzyskać dostęp do tego zasobu.'

    def has_permission(self, request, view):
        return has_profile(request.user, 'patient')


class IsDoctorOrPatient(BasePermission):
    message = 'Konto nie ma roli pacjenta ani lekarza.'

    def has_permission(self, request, view):
        return has_profile(request.user, 'doctor') or has_profile(request.user, 'patient')


class IsAppointmentParticipant(BasePermission):
    message = 'Nie należysz do tej wizyty.'

    def has_object_permission(self, request, view, obj):
        return is_doctor_and_patient(request.user, getattr(obj, 'appointment', obj))


class IsConversationParticipant(BasePermission):
    message = 'Nie należysz do tej rozmowy.'

    def has_object_permission(self, request, view, obj):
        return is_doctor_and_patient(request.user, getattr(obj, 'conversation', obj))


class IsOwningDoctor(BasePermission):
    message = 'Ten zasób należy do innego lekarza.'

    def has_object_permission(self, request, view, obj):
        return obj.doctor.user_id == request.user.id