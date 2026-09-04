from celery import shared_task
from django.core.mail import send_mail
from django.conf import settings

from TelMed.users.models import User


@shared_task
def send_welcome_email(user_id):
    user = User.objects.get(id=user_id)
    send_mail(
        'Witamy na platformie telemedycznej',
        f'Dzień dobry {user.first_name},'
        f'Twoje konto zostało utworzone. '
        f'Platforma telemedyczna',
        settings.DEFAULT_FROM_EMAIL,
        [user.email], fail_silently=True,
    )


@shared_task
def send_password_changed_email(user_id):
    user = User.objects.get(id=user_id)
    send_mail(
        'Zmiana hasła',
        f'Dzień dobry {user.first_name},\n\n'
        f'Twoje hasło zostało zmienione.\n'
        f'Jeśli to nie Ty, skontaktuj się z nami.\n\n'
        f'Platforma telemedyczna',
        settings.DEFAULT_FROM_EMAIL,
        [user.email], fail_silently=True,
    )


@shared_task
def send_profile_updated_email(user_id):
    user = User.objects.get(id=user_id)
    send_mail(
        'Aktualizacja konta',
        f'Dzień dobry {user.first_name},\n\n'
        f'Twoje dane w profilu zostały zaktualizowane.\n\n'
        f'Platforma telemedyczna',
        settings.DEFAULT_FROM_EMAIL,
        [user.email], fail_silently=True,
    )


@shared_task
def send_account_deleted_email(email, first_name):
    send_mail(
        'Usunięcie konta',
        f'Dzień dobry {first_name},\n\n'
        f'Twoje konto zostało usunięte.\n\n'
        f'Platforma telemedyczna',
        settings.DEFAULT_FROM_EMAIL,
        [email], fail_silently=True,
    )

@shared_task
def send_password_reset_email(user_id, reset_url):
    user = User.objects.get(id=user_id)
    send_mail(
        'Odzyskiwanie hasła',
        f'Dzień dobry {user.first_name},\n\n'
        f'Aby zresetować hasło, otwórz poniższy link:\n'
        f'{reset_url}\n'
        f'Link jest ważny przez godzinę.\n\n'
        f'Platforma telemedyczna',
        settings.DEFAULT_FROM_EMAIL,
        [user.email], fail_silently=True,
    )

