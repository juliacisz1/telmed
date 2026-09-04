import os

from rest_framework import serializers
from TelMed.connection.models import Conversation, Message


class MessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.SerializerMethodField()
    sender_role = serializers.CharField(source='sender.role', read_only=True)
    created_at = serializers.DateTimeField(source='sent_at', read_only=True)
    file = serializers.SerializerMethodField()
    file_name = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = ['id', 'conversation', 'appointment', 'sender', 'sender_name', 'sender_role',
                  'message', 'file', 'file_name', 'created_at']
        read_only_fields = fields

    def get_sender_name(self, obj):
        return f"{obj.sender.first_name} {obj.sender.last_name}"

    def get_file(self, obj):
        return f'/messages/{obj.id}/file/' if obj.file else None

    def get_file_name(self, obj):
        return os.path.basename(obj.file.name) if obj.file else None


class ConversationSerializer(serializers.ModelSerializer):
    doctor_name = serializers.SerializerMethodField()
    patient_name = serializers.SerializerMethodField()
    last_message = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = ['id', 'doctor', 'patient', 'doctor_name', 'patient_name', 'last_message']
        read_only_fields = fields

    def get_doctor_name(self, obj):
        return str(obj.doctor)

    def get_patient_name(self, obj):
        return str(obj.patient)

    def get_last_message(self, obj):
        last = obj.messages.filter(appointment__isnull=True).order_by('sent_at').last()
        return last.message if last else None