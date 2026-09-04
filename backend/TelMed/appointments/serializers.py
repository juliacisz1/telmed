from django.utils import timezone
from rest_framework import serializers
from TelMed.appointments.models import (DoctorSchedule, Appointment, DoctorAbsence, MedicalDocument, Review,
                                        Prescription, Referral, SickLeave, Drug, Diagnosis)
from TelMed.users.models import Patient

MAX_NOTE_LENGTH = 500

class DoctorScheduleSerializer(serializers.ModelSerializer):
    class Meta:
        model = DoctorSchedule
        fields = ['day_of_week', 'is_working', 'start_time', 'end_time']

    def validate(self, data):
        if data.get('is_working'):
            start_time = data.get('start_time')
            end_time = data.get('end_time')
            if not start_time or not end_time:
                raise serializers.ValidationError('Podaj godziny pracy albo odznacz dzień.')
            if end_time <= start_time:
                raise serializers.ValidationError(
                    {'end_time': 'Koniec pracy musi być później niż początek.'})
        return data

class AppointmentSerializer(serializers.ModelSerializer):
    patient_name = serializers.SerializerMethodField()
    doctor_name = serializers.SerializerMethodField()
    has_review  =serializers.SerializerMethodField()

    class Meta:
        model = Appointment
        fields = ['id', 'doctor', 'patient', 'patient_name', 'doctor_name', 'start_time', 'end_time', 'advice', 'notes', 'status', 'has_review']
        read_only_fields = ['patient', 'status', 'advice', 'notes']

    def validate(self, data):
        start = data.get('start_time')
        end = data.get('end_time')
        if start and end and end <= start:
            raise serializers.ValidationError(
                {'end_time': 'Koniec wizyty musi być później niż początek.'}
            )
        return data

    def get_patient_name(self, obj):
        return str(obj.patient)

    def get_doctor_name(self, obj):
        return str(obj.doctor)

    def get_has_review(self, obj):
        return hasattr(obj, 'review')

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get('request')
        if request and request.user.role == 'patient':
            data.pop('notes', None)
        return data

class AppointmentNotesSerializer(serializers.ModelSerializer):
    advice = serializers.CharField(required=False, allow_blank=True, max_length=MAX_NOTE_LENGTH)
    notes = serializers.CharField(required=False, allow_blank=True, max_length=MAX_NOTE_LENGTH)

    class Meta:
        model = Appointment
        fields = ['advice', 'notes']

class DoctorAppointmentSerializer(AppointmentSerializer):
    class Meta(AppointmentSerializer.Meta):
        read_only_fields = AppointmentSerializer.Meta.read_only_fields + ['doctor']

class DoctorPatientSerializer(serializers.ModelSerializer):
    first_name = serializers.CharField(source='user.first_name')
    last_name = serializers.CharField(source='user.last_name')
    email = serializers.EmailField(source='user.email')

    class Meta:
        model = Patient
        fields = ['id', 'first_name', 'last_name', 'email', 'date_of_birth']
        read_only_fields = fields

class DoctorAbsenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = DoctorAbsence
        fields = ['id', 'start_date', 'end_date', 'all_day', 'start_time', 'end_time', 'description']

    def validate(self, data):
        instance = self.instance

        start_date = data.get('start_date', getattr(instance, 'start_date', None))
        end_date = data.get('end_date', getattr(instance, 'end_date', None))
        if start_date and end_date and end_date < start_date:
            raise serializers.ValidationError({'end_date': 'Data końca nie może być wcześniejsza niż data początku.'})

        all_day = data.get('all_day', getattr(instance, 'all_day', False))
        if not all_day:
            start_time = data.get('start_time', getattr(instance, 'start_time', None))
            end_time = data.get('end_time', getattr(instance, 'end_time', None))
            if not start_time or not end_time:
                raise serializers.ValidationError('Podaj godziny nieobecności albo zaznacz cały dzień.')
            if end_time <= start_time:
                raise serializers.ValidationError({'end_time': 'Koniec musi być później niż początek.'})

        if all_day:
            data['start_time'] = None
            data['end_time'] = None
        return data

class DiagnosisSerializer(serializers.ModelSerializer):
    class Meta:
        model = Diagnosis
        fields = ['id', 'code', 'name']

class DrugSerializer(serializers.ModelSerializer):
    class Meta:
        model = Drug
        fields = ['id', 'name', 'form', 'strength']


class PrescriptionSerializer(serializers.ModelSerializer):
    drug_display = serializers.CharField(source='drug.__str__', read_only=True)

    class Meta:
        model = Prescription
        fields = ['id', 'appointment', 'comment', 'drug', 'drug_display', 'diagnosis',
                  'dosage', 'quantity', 'description', 'created_at']
        read_only_fields = ['appointment', 'created_at']


class ReferralSerializer(serializers.ModelSerializer):
    specialty_display = serializers.CharField(source='specialty.name', read_only=True)
    target_display = serializers.CharField(source='get_target_display', read_only=True)

    class Meta:
        model = Referral
        fields = ['id', 'appointment', 'comment', 'diagnosis', 'target', 'target_display',
                  'specialty', 'specialty_display', 'exam_name', 'description', 'created_at']
        read_only_fields = ['appointment', 'created_at']

    def validate(self, data):
        if data.get('target') == 'doctor' and not data.get('specialty'):
            raise serializers.ValidationError({'specialty': 'Wskaż specjalizację.'})
        if data.get('target') == 'exam' and not (data.get('exam_name') or '').strip():
            raise serializers.ValidationError({'exam_name': 'Podaj rodzaj badania.'})
        return data


class SickLeaveSerializer(serializers.ModelSerializer):
    class Meta:
        model = SickLeave
        fields = ['id', 'appointment', 'comment', 'diagnosis', 'date_from', 'date_to', 'created_at']
        read_only_fields = ['appointment', 'created_at']

    def validate(self, data):
        date_from = data.get('date_from')
        date_to = data.get('date_to')
        if date_from and date_to and date_to < date_from:
            raise serializers.ValidationError(
                {'date_to': 'Data końca zwolnienia nie może być wcześniejsza niż data początku.'})
        return data

class MedicalDocumentSerializer(serializers.ModelSerializer):
    doc_type_display = serializers.CharField(source='get_doc_type_display', read_only=True)
    pdf = serializers.SerializerMethodField()

    class Meta:
        model = MedicalDocument
        fields = ['id', 'appointment', 'doc_type', 'doc_type_display', 'comment', 'pdf', 'created_at']
        read_only_fields = fields

    def get_pdf(self, obj):
        return f'/documents/{obj.id}/pdf/' if obj.pdf_file else None

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if instance.doc_type == 'prescription':
            child_data = PrescriptionSerializer(instance.prescription, context=self.context).data
        elif instance.doc_type == 'referral':
            child_data = ReferralSerializer(instance.referral, context=self.context).data
        elif instance.doc_type == 'sick_leave':
            child_data = SickLeaveSerializer(instance.sickleave, context=self.context).data
        else:
            return data

        child_data.update(data)
        return child_data

class PatientDocumentSerializer(MedicalDocumentSerializer):
    doctor_name = serializers.SerializerMethodField()

    class Meta(MedicalDocumentSerializer.Meta):
        fields = ['id', 'appointment', 'doctor_name', 'doc_type', 'doc_type_display', 'comment', 'pdf', 'created_at']
        read_only_fields = fields

    def get_doctor_name(self, obj):
        return str(obj.appointment.doctor)

class ReviewSerializer(serializers.ModelSerializer):
    rating = serializers.IntegerField(
        min_value=1, max_value=5,
        error_messages={
            'min_value': 'Ocena musi być w zakresie 1-5.',
            'max_value': 'Ocena musi być w zakresie 1-5.',
        }
    )

    class Meta:
        model = Review
        fields = ['id', 'doctor', 'patient', 'appointment', 'rating', 'comment', 'created_at']
        read_only_fields = ['doctor', 'patient']

def anonymize_patient_name(full_name):
    parts = [part for part in full_name.split() if part]
    if not parts:
        return 'Pacjent'
    initials = ' '.join(f'{part[0].upper()}.' for part in parts[1:])
    return f'{parts[0]} {initials}'.strip()


class PublicReviewSerializer(serializers.ModelSerializer):
    patient_name = serializers.SerializerMethodField()
    created_at = serializers.SerializerMethodField()

    class Meta:
        model = Review
        fields = ['id', 'patient_name', 'rating', 'comment', 'created_at']
        read_only_fields = fields

    def get_patient_name(self, obj):
        return anonymize_patient_name(str(obj.patient))

    def get_created_at(self, obj):
        return timezone.localdate(obj.created_at).isoformat()