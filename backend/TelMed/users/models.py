from django.contrib.auth.models import AbstractUser
from django.db import models
from django.contrib.auth.base_user import BaseUserManager
from encrypted_model_fields.fields import EncryptedCharField

# Create your models here.
#https://docs.djangoproject.com/en/6.0/topics/auth/customizing/#a-full-example
#https://www.geeksforgeeks.org/python/custom-user-models-in-django/
#https://docs.djangoproject.com/en/6.0/ref/models/fields/
#https://docs.djangoproject.com/en/6.0/ref/models/instances/

import hmac
import hashlib
from django.conf import settings


def pesel_fingerprint(value):
    if not value:
        return None
    return hmac.new(settings.PESEL_HASH_KEY.encode(), value.encode(), hashlib.sha256).hexdigest()

class CustomUserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('Email jest wymagany')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        return self.create_user(email, password, **extra_fields)

class User(AbstractUser):
    ROLE_CHOICES = [
        ('doctor', 'Lekarz'),
        ('patient', 'Pacjent'),
    ]

    username = None
    email = models.EmailField(unique=True, null=False, blank=False)
    role = models.CharField(choices=ROLE_CHOICES, max_length=10)
    updated_at = models.DateTimeField(auto_now=True)

    objects = CustomUserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []


class Specialty(models.Model):
    name = models.CharField(max_length=100, unique=True)

    class Meta:
        verbose_name = 'Specialty'
        verbose_name_plural = 'Specialties'

    def __str__(self):
        return self.name

class Doctor(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)

    TITLE_CHOICES = [
        ('lek', 'lek.'),
        ('dr_n_med', 'dr n. med.'),
        ('dr_hab_n_med', 'dr hab. n. med.'),
        ('prof_dr_hab', 'prof. dr hab. n. med.')
    ]

    title = models.CharField(choices=TITLE_CHOICES, max_length=20, blank=True)
    specialties = models.ManyToManyField(Specialty)
    pwz_number = models.CharField(max_length=7, unique=True)
    bio = models.TextField(blank=True)
    default_duration = models.IntegerField(default=30)

    def __str__(self):
        return f"{self.get_title_display()} {self.user.first_name} {self.user.last_name}".strip()

class Patient(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    date_of_birth = models.DateField(blank=True, null=True)
    pesel = EncryptedCharField(max_length=11, blank=True, null=True)
    pesel_hash = models.CharField(max_length=64, unique=True, null=True, blank=True, editable=False)

    def save(self, *args, **kwargs):
        self.pesel_hash = pesel_fingerprint(self.pesel)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.user.first_name} {self.user.last_name}"