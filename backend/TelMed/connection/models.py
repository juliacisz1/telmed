from django.db import models
from encrypted_files.fields import EncryptedFileField

from TelMed.users.models import User, Doctor, Patient
from TelMed.appointments.models import Appointment


#https://github.com/bitlabstudio/django-conversation/blob/master/conversation/models.py

# Create your models here.

class Conversation(models.Model):
    doctor = models.ForeignKey(Doctor, on_delete=models.CASCADE, related_name='conversations')
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name='conversations')

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['doctor', 'patient'], name='unique_conversation_pair'),
        ]

    def __str__(self):
        return f"Rozmowa: {self.patient} – {self.doctor}"

class Message(models.Model):
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name='messages')
    appointment = models.ForeignKey(Appointment, on_delete=models.SET_NULL, null=True, blank=True, related_name='messages')
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_messages')
    message = models.TextField(blank=True, max_length=500)
    file = EncryptedFileField(upload_to='chat_files/', null=True, blank=True)
    sent_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['sent_at']

    def __str__(self):
        return f"{self.sender} ({self.sent_at:%d.%m %H:%M}): {self.message[:15]}..."