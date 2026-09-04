import os

from django.db.models import Max, F, Q
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from TelMed.appointments.models import Appointment
from TelMed.connection.models import Conversation, Message
from TelMed.connection.serializers import ConversationSerializer, MessageSerializer
from TelMed.connection.utils import broadcast_message
from TelMed.users.models import Doctor, Patient
from TelMed.users.permissions import IsAppointmentParticipant, IsConversationParticipant, IsDoctorOrPatient
from TelMed_backend.uploads import validate_upload
from TelMed_backend.visit_utils import visit_room_open


class ConversationListView(generics.GenericAPIView):
    permission_classes = [IsDoctorOrPatient]
    serializer_class = ConversationSerializer

    def get_queryset(self):
        user = self.request.user
        owner = {'doctor': user.doctor} if user.role == 'doctor' else {'patient': user.patient}
        last_visible_message = Max('messages__sent_at', filter=Q(messages__appointment__isnull=True))
        return (Conversation.objects
                .filter(**owner)
                .select_related('doctor__user', 'patient__user')
                .annotate(last_message_at=last_visible_message)
                .order_by(F('last_message_at').desc(nulls_last=True)))

    def get(self, request):
        return Response(self.get_serializer(self.get_queryset(), many=True).data)

    def post(self, request):
        if request.user.role == 'patient':
            doctor = get_object_or_404(Doctor, id=request.data.get('doctor'))
            patient = request.user.patient
        else:
            patient = get_object_or_404(Patient, id=request.data.get('patient'))
            doctor = request.user.doctor

        has_appointment = Appointment.objects.filter(doctor=doctor, patient=patient).exists()
        if not has_appointment:
            return Response({'detail': 'Brak wizyt między pacjentem a lekarzem.'}, status=status.HTTP_403_FORBIDDEN)

        conversation, created = Conversation.objects.get_or_create(doctor=doctor, patient=patient)
        return Response(self.get_serializer(conversation).data,
                        status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class ConversationMessagesView(generics.GenericAPIView):
    queryset = Conversation.objects.select_related('doctor', 'patient')
    serializer_class = MessageSerializer
    permission_classes = [IsAuthenticated, IsConversationParticipant]

    def get(self, request, pk):
        conversation = self.get_object()
        messages = conversation.messages.filter(appointment__isnull=True).select_related('sender')
        return Response(self.get_serializer(messages, many=True).data)

    def post(self, request, pk):
        conversation = self.get_object()

        file = request.FILES.get('file')
        problem = validate_upload(file)
        if problem:
            return Response({'detail': problem}, status=status.HTTP_400_BAD_REQUEST)

        message = Message.objects.create(conversation=conversation, sender=request.user, file=file)
        broadcast_message(f'chat_{conversation.pk}', message, request.user)
        return Response(status=status.HTTP_201_CREATED)


class AppointmentMessagesView(generics.GenericAPIView):
    queryset = Appointment.objects.select_related('doctor', 'patient')
    serializer_class = MessageSerializer
    permission_classes = [IsAuthenticated, IsAppointmentParticipant]

    def get(self, request, pk):
        appointment = self.get_object()
        messages = appointment.messages.select_related('sender')
        return Response(self.get_serializer(messages, many=True).data)

    def post(self, request, pk):
        appointment = self.get_object()
        if not visit_room_open(appointment):
            return Response({'detail': 'Czat tej wizyty jest zamknięty.'}, status=status.HTTP_400_BAD_REQUEST)

        file = request.FILES.get('file')
        problem = validate_upload(file)
        if problem:
            return Response({'detail': problem}, status=status.HTTP_400_BAD_REQUEST)

        conversation, _ = Conversation.objects.get_or_create( doctor=appointment.doctor, patient=appointment.patient)
        message = Message.objects.create(conversation=conversation, appointment=appointment, sender=request.user, file=file)

        broadcast_message(f'appointment_chat_{appointment.pk}', message, request.user)
        return Response(status=status.HTTP_201_CREATED)


class MessageFileView(generics.GenericAPIView):
    queryset = Message.objects.select_related('conversation')
    permission_classes = [IsAuthenticated, IsConversationParticipant]

    def get(self, request, pk):
        message = self.get_object()
        if not message.file:
            return Response({'detail': 'Brak pliku.'}, status=status.HTTP_404_NOT_FOUND)
        return FileResponse(message.file.open('rb'), filename=os.path.basename(message.file.name))