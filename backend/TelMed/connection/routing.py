from django.urls import re_path

from . import consumers

websocket_urlpatterns = [
    re_path(r"ws/connection/(?P<appointment_id>\d+)/$", consumers.ConnectionConsumer.as_asgi()),
    re_path(r"ws/chat/(?P<conversation_id>\d+)/$", consumers.ChatConsumer.as_asgi()),
    re_path(r"ws/appointment-chat/(?P<appointment_id>\d+)/$", consumers.AppointmentChatConsumer.as_asgi()),
]