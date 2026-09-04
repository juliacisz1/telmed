from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils.encoding import force_str
from django.utils.http import urlsafe_base64_decode
from rest_framework import serializers
from rest_framework.validators import UniqueValidator
from TelMed.users.models import Doctor, Patient, Specialty, User, pesel_fingerprint

#https://www.django-rest-framework.org/api-guide/serializers/

MAX_SPECIALTIES = 3

EMAIL_UNIQUE = UniqueValidator(queryset=User.objects.all(), lookup='iexact',
                               message='Użytkownik o takim adresie e-mail już istnieje.')

def run_password_validators(password, user, field):
    try:
        validate_password(password, user)
    except ValidationError as error:
        raise serializers.ValidationError({field: list(error.messages)})


def rating_result(doctor):
    ratings = [review.rating for review in doctor.reviews.all()]
    if not ratings:
        return None, 0
    return round(sum(ratings) / len(ratings), 1), len(ratings)


class SpecialtySerializer(serializers.ModelSerializer):
    class Meta:
        model = Specialty
        fields = ['id', 'name']


class UserRegisterSerializer(serializers.Serializer):
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150)
    email = serializers.EmailField(max_length=200, validators=[EMAIL_UNIQUE])
    password = serializers.CharField(
        write_only=True, min_length=8,
        error_messages={'required': 'Uzupełnij hasło.', 'blank': 'Uzupełnij hasło.'},
    )
    password_confirm = serializers.CharField(
        write_only=True,
        error_messages={'required': 'Powtórz hasło.', 'blank': 'Powtórz hasło.'},
    )

    role = None

    def validate_email(self, value):
        return value.lower()

    def validate(self, data):
        if data['password'] != data['password_confirm']:
            raise serializers.ValidationError({'password_confirm': 'Hasła nie są identyczne.'})

        candidate = User(email=data.get('email', ''), first_name=data.get('first_name', ''),
                         last_name=data.get('last_name', ''))
        run_password_validators(data['password'], candidate, 'password')
        return data

    def create_user(self, validated_data):
        password = validated_data.pop('password')
        validated_data.pop('password_confirm')
        user = User(role=self.role, **validated_data)
        user.set_password(password)
        user.save()
        return user


class PatientRegisterSerializer(UserRegisterSerializer):
    role = 'patient'

    @transaction.atomic
    def create(self, validated_data):
        user = self.create_user(validated_data)
        Patient.objects.create(user=user)
        return user


class DoctorRegisterSerializer(UserRegisterSerializer):
    role = 'doctor'

    pwz_number = serializers.CharField(
        min_length=7, max_length=7,
        validators=[UniqueValidator(queryset=Doctor.objects.all(),
                                    message='Lekarz z tym numerem PWZ już istnieje.')],
        error_messages={
            'min_length': 'Numer PWZ musi mieć dokładnie 7 znaków.',
            'max_length': 'Numer PWZ musi mieć dokładnie 7 znaków.',
            'required': 'Uzupełnij numer PWZ.',
            'blank': 'Uzupełnij numer PWZ.',
        },
    )
    specialty = serializers.PrimaryKeyRelatedField(
        queryset=Specialty.objects.all(),
        error_messages={
            'required': 'Wybierz specjalizację.',
            'does_not_exist': 'Wybrana specjalizacja nie istnieje.',
        },
    )

    @transaction.atomic
    def create(self, validated_data):
        specialty = validated_data.pop('specialty')
        pwz_number = validated_data.pop('pwz_number')
        user = self.create_user(validated_data)
        doctor = Doctor.objects.create(user=user, pwz_number=pwz_number)
        doctor.specialties.add(specialty)
        return user


class PatientMeSerializer(serializers.ModelSerializer):
    date_of_birth = serializers.DateField(source='patient.date_of_birth', allow_null=True, required=False)
    pesel = serializers.CharField(source='patient.pesel', allow_null=True, required=False)

    class Meta:
        model = User
        fields = ['id', 'role', 'first_name', 'last_name', 'date_of_birth', 'pesel', 'email']
        read_only_fields = ['id', 'role']
        extra_kwargs = {'email': {'validators': [EMAIL_UNIQUE]}}

    def validate_email(self, value):
        return value.lower()

    def validate_pesel(self, value):
        if not value:
            return value
        if len(value) != 11 or not value.isdigit():
            raise serializers.ValidationError('PESEL musi składać się z 11 cyfr.')

        duplicate = Patient.objects.filter(pesel_hash=pesel_fingerprint(value))
        if self.instance is not None:
            duplicate = duplicate.exclude(user=self.instance)
        if duplicate.exists():
            raise serializers.ValidationError('Nie da się zapisać numeru PESEL.')
        return value

    @transaction.atomic
    def update(self, instance, validated_data):
        patient_data = validated_data.pop('patient', {})

        instance.first_name = validated_data.get('first_name', instance.first_name)
        instance.last_name = validated_data.get('last_name', instance.last_name)
        instance.email = validated_data.get('email', instance.email)
        instance.save()

        patient = instance.patient
        patient.date_of_birth = patient_data.get('date_of_birth', patient.date_of_birth)
        patient.pesel = patient_data.get('pesel', patient.pesel)
        patient.save()
        return instance


class DoctorMeSerializer(serializers.ModelSerializer):
    doctor_id = serializers.IntegerField(source='doctor.id', read_only=True)
    title = serializers.ChoiceField(source='doctor.title', choices=Doctor.TITLE_CHOICES,
                                    allow_blank=True, required=False)
    bio = serializers.CharField(source='doctor.bio', allow_blank=True, required=False)
    pwz_number = serializers.CharField(
        source='doctor.pwz_number', required=False, min_length=7, max_length=7,
        error_messages={
            'min_length': 'Numer PWZ musi mieć dokładnie 7 znaków.',
            'max_length': 'Numer PWZ musi mieć dokładnie 7 znaków.',
        },
    )
    default_duration = serializers.IntegerField(
        source='doctor.default_duration', required=False, min_value=5, max_value=240,
        error_messages={
            'min_value': 'Czas trwania wizyty musi wynosić co najmniej 5 minut.',
            'max_value': 'Czas trwania wizyty nie może przekraczać 240 minut.',
        },
    )
    specialties = serializers.PrimaryKeyRelatedField(queryset=Specialty.objects.all(), many=True, required=False)
    average_rating = serializers.SerializerMethodField()
    reviews_count = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'role', 'title', 'first_name', 'last_name', 'doctor_id', 'pwz_number', 'specialties',
                  'email', 'bio', 'default_duration', 'average_rating', 'reviews_count']
        read_only_fields = ['id', 'role', 'average_rating', 'reviews_count']
        extra_kwargs = {'email': {'validators': [EMAIL_UNIQUE]}}

    def validate_email(self, value):
        return value.lower()

    def validate_pwz_number(self, value):
        if value and Doctor.objects.filter(pwz_number=value).exclude(user=self.instance).exists():
            raise serializers.ValidationError('Lekarz z tym numerem PWZ już istnieje.')
        return value

    def validate_specialties(self, value):
        if len(value) > MAX_SPECIALTIES:
            raise serializers.ValidationError(f'Można wybrać najwyżej {MAX_SPECIALTIES} specjalizacje.')
        return value

    def get_average_rating(self, obj):
        return rating_result(obj.doctor)[0]

    def get_reviews_count(self, obj):
        return rating_result(obj.doctor)[1]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['specialties'] = SpecialtySerializer(instance.doctor.specialties.all(), many=True).data
        return data

    @transaction.atomic
    def update(self, instance, validated_data):
        doctor_data = validated_data.pop('doctor', {})
        specialties = validated_data.pop('specialties', None)

        instance.first_name = validated_data.get('first_name', instance.first_name)
        instance.last_name = validated_data.get('last_name', instance.last_name)
        instance.email = validated_data.get('email', instance.email)
        instance.save()

        doctor = instance.doctor
        doctor.title = doctor_data.get('title', doctor.title)
        doctor.bio = doctor_data.get('bio', doctor.bio)
        doctor.pwz_number = doctor_data.get('pwz_number', doctor.pwz_number)
        doctor.default_duration = doctor_data.get('default_duration', doctor.default_duration)
        doctor.save()

        if specialties is not None:
            doctor.specialties.set(specialties)
        return instance

class DoctorPublicSerializer(serializers.ModelSerializer):
    doctor_id = serializers.IntegerField(source='doctor.id')
    title = serializers.CharField(source='doctor.title')
    bio = serializers.CharField(source='doctor.bio')
    pwz_number = serializers.CharField(source='doctor.pwz_number')
    specialties = SpecialtySerializer(source='doctor.specialties', many=True)
    average_rating = serializers.SerializerMethodField()
    reviews_count = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['doctor_id', 'title', 'first_name', 'last_name', 'specialties', 'bio', 'pwz_number',
                  'average_rating', 'reviews_count']
        read_only_fields = fields

    def get_average_rating(self, obj):
        return rating_result(obj.doctor)[0]

    def get_reviews_count(self, obj):
        return rating_result(obj.doctor)[1]

class PasswordChangeSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8)
    new_password_confirm = serializers.CharField(write_only=True)

    def validate_old_password(self, value):
        if not self.context['request'].user.check_password(value):
            raise serializers.ValidationError('Nieprawidłowe hasło.')
        return value

    def validate(self, data):
        if data['new_password'] != data['new_password_confirm']:
            raise serializers.ValidationError({'new_password_confirm': 'Hasła nie są identyczne.'})
        run_password_validators(data['new_password'], self.context['request'].user, 'new_password')
        return data


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()


class PasswordResetConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    password = serializers.CharField(write_only=True)

    def validate(self, data):
        try:
            self.user = User.objects.get(pk=force_str(urlsafe_base64_decode(data['uid'])))
        except (User.DoesNotExist, ValueError, TypeError, OverflowError):
            raise serializers.ValidationError({'token': 'Odnośnik jest nieprawidłowy lub wygasł.'})
        if not default_token_generator.check_token(self.user, data['token']):
            raise serializers.ValidationError({'token': 'Odnośnik jest nieprawidłowy lub wygasł.'})
        run_password_validators(data['password'], self.user, 'password')
        return data