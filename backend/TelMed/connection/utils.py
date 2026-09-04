import os

from asgiref.sync import async_to_sync
from channels.db import database_sync_to_async
from channels.layers import get_channel_layer
from TelMed.appointments.models import Appointment
from TelMed_backend.visit_utils import visit_room_open
from .exceptions import ClientError
from .models import Conversation, Message

#http://channels.readthedocs.io/en/latest/topics/databases.html
@database_sync_to_async
def get_appointment_permission(appointment_id, user):
    try:
        appointment = Appointment.objects.get(id=appointment_id)
    except (Appointment.DoesNotExist, ValueError):
        raise ClientError("APPOINTMENT_NOT_FOUND")
    if appointment.doctor.user_id != user.id and appointment.patient.user_id != user.id:
        raise ClientError("APPOINTMENT_ACCESS_DENIED")
    if not visit_room_open(appointment):
        raise ClientError("VISIT_ROOM_CLOSED")
    return appointment


@database_sync_to_async
def get_conversation_permission(conversation_id, user):
    try:
        conversation = Conversation.objects.get(id=conversation_id)
    except (Conversation.DoesNotExist, ValueError):
        raise ClientError("CONVERSATION_NOT_FOUND")
    if conversation.doctor.user_id != user.id and conversation.patient.user_id != user.id:
        raise ClientError("CONVERSATION_ACCESS_DENIED")
    return conversation


@database_sync_to_async
def create_conversation_message(conversation_id, sender, text):
    conversation = Conversation.objects.get(id=conversation_id)
    return Message.objects.create(conversation=conversation, sender=sender, message=text)


@database_sync_to_async
def create_appointment_message(appointment_id, sender, text):
    appointment = Appointment.objects.select_related('doctor', 'patient').get(id=appointment_id)
    conversation, _ = Conversation.objects.get_or_create(
        doctor=appointment.doctor, patient=appointment.patient)
    return Message.objects.create(
        conversation=conversation, appointment=appointment, sender=sender, message=text)


def chat_event(message, sender):
    return {
        "type": "chat.message",
        "id": message.id,
        "sender": sender.id,
        "sender_name": f"{sender.first_name} {sender.last_name}",
        "sender_role": sender.role,
        "message": message.message,
        "file": f"/messages/{message.id}/file/" if message.file else None,
        "file_name": os.path.basename(message.file.name) if message.file else None,
        "created_at": message.sent_at.isoformat(),
    }


def broadcast_message(group_name, message, sender):
    async_to_sync(get_channel_layer().group_send)(group_name, chat_event(message, sender))