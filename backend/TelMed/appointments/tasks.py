from datetime import timedelta
from django.utils import timezone
from django.core.mail import send_mail
from django.conf import settings
from celery import shared_task
from TelMed.appointments.models import Appointment
from TelMed_backend import celery_app


def appointment_start(appointment):
    #aby pokazało dobry timezone a nie 2 godz wczesiej
    return timezone.localtime(appointment.start_time).strftime('%d.%m.%Y %H:%M')


@shared_task
def send_booking_confirmation(appointment_id):
    try:
        appointment = Appointment.objects.get(id=appointment_id)
    except Appointment.DoesNotExist:
        return

    patient = appointment.patient.user
    doctor = appointment.doctor.user
    start = appointment_start(appointment)

    send_mail(
        'Potwierdzenie rezerwacji wizyty',
        f'Dzień dobry {patient.first_name},\n\n'
        f'Twoja wizyta u {appointment.doctor} została zarezerwowana.\n'
        f'Termin: {start}\n\n'
        f'Platforma telemedyczna',
        settings.DEFAULT_FROM_EMAIL, [patient.email], fail_silently=True,
    )
    send_mail(
        'Nowa wizyta w kalendarzu',
        f'Dzień dobry {doctor.first_name},\n\n'
        f'W Twoim kalendarzu pojawiła się nowa wizyta.\n'
        f'Pacjent: {appointment.patient}\n'
        f'Termin: {start}\n\n'
        f'Platforma telemedyczna',
        settings.DEFAULT_FROM_EMAIL, [doctor.email], fail_silently=True,
    )


@shared_task
def send_reschedule_notification(appointment_id):
    try:
        appointment = Appointment.objects.get(id=appointment_id)
    except Appointment.DoesNotExist:
        return

    patient = appointment.patient.user
    doctor = appointment.doctor.user
    start = appointment_start(appointment)

    send_mail(
        'Zmiana terminu wizyty',
        f'Dzień dobry {patient.first_name},\n\n'
        f'Termin Twojej wizyty u {appointment.doctor} został zmieniony.\n'
        f'Nowy termin: {start}\n\n'
        f'Platforma telemedyczna',
        settings.DEFAULT_FROM_EMAIL, [patient.email], fail_silently=True,
    )
    send_mail(
        'Zmiana terminu wizyty',
        f'Dzień dobry {doctor.first_name},\n\n'
        f'Termin wizyty w Twoim kalendarzu został zmieniony.\n'
        f'Pacjent: {appointment.patient}\n'
        f'Nowy termin: {start}\n\n'
        f'Platforma telemedyczna',
        settings.DEFAULT_FROM_EMAIL, [doctor.email], fail_silently=True,
    )


@shared_task
def send_cancellation_notification(appointment_id):
    try:
        appointment = Appointment.objects.get(id=appointment_id)
    except Appointment.DoesNotExist:
        return

    patient = appointment.patient.user
    doctor = appointment.doctor.user
    start = appointment_start(appointment)

    send_mail(
        'Anulowanie wizyty',
        f'Dzień dobry {patient.first_name},\n\n'
        f'Twoja wizyta u {appointment.doctor} z dnia {start} została anulowana.\n\n'
        f'Platforma telemedyczna',
        settings.DEFAULT_FROM_EMAIL, [patient.email], fail_silently=True,
    )
    send_mail(
        'Anulowanie wizyty',
        f'Dzień dobry {doctor.first_name},\n\n'
        f'Wizyta w Twoim kalendarzu została anulowana.\n'
        f'Pacjent: {appointment.patient}\n'
        f'Termin: {start}\n\n'
        f'Platforma telemedyczna',
        settings.DEFAULT_FROM_EMAIL, [doctor.email], fail_silently=True,
    )

REMIND_BEFORE = timedelta(hours=24)


def cancel_reminder(appointment_id):
    try:
        appointment = Appointment.objects.get(id=appointment_id)
    except Appointment.DoesNotExist:
        return
    if not appointment.reminder_task_id:
        return

    celery_app.control.revoke(appointment.reminder_task_id)
    Appointment.objects.filter(pk=appointment.pk).update(reminder_task_id=None)


def schedule_reminder(appointment_id):
    try:
        appointment = Appointment.objects.get(id=appointment_id)
    except Appointment.DoesNotExist:
        return

    if appointment.status != 'booked':
        return

    cancel_reminder(appointment_id)
    send_at = appointment.start_time - REMIND_BEFORE
    if send_at <= timezone.now():
        return

    result = send_appointment_reminder.apply_async((appointment.id,), eta=send_at)
    (Appointment.objects.filter(pk=appointment.pk).update(reminder_task_id=result.id))

@shared_task(bind=True)
def send_appointment_reminder(self, appointment_id):
    try:
        appointment = Appointment.objects.get(id=appointment_id)
    except Appointment.DoesNotExist:
        return
    if appointment.status != 'booked':
        return
    if appointment.reminder_task_id != self.request.id:
        return

    patient = appointment.patient.user
    send_mail(
        'Przypomnienie o wizycie',
        f'Dzień dobry {patient.first_name},\n\n'
        f'Przypominamy o zbliżającej się wizycie u {appointment.doctor}.\n'
        f'Termin: {appointment_start(appointment)}\n\n'
        f'Platforma telemedyczna',
        settings.DEFAULT_FROM_EMAIL, [patient.email], fail_silently=True,
    )
