from channels.generic.websocket import AsyncJsonWebsocketConsumer

from .exceptions import ClientError, CLOSE_POLICY_VIOLATION
from .utils import (chat_event, create_appointment_message, create_conversation_message, get_appointment_permission,
                    get_conversation_permission)

MAX_MESSAGE_LENGTH = 500
SIGNAL_TYPES = {"join", "offer", "answer", "ice", "ended"}


class ConnectionConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.appointment_id = self.scope["url_route"]["kwargs"]["appointment_id"]
        self.room_group_name = f"connection_{self.appointment_id}"

        if self.scope["user"].is_anonymous:
            await self.close(code=CLOSE_POLICY_VIOLATION)
            return

        try:
            await get_appointment_permission(self.appointment_id, self.scope["user"])
        except ClientError:
            await self.close(code=CLOSE_POLICY_VIOLATION)
            return

        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

    async def receive_json(self, content):
        try:
            await self.send_signal(content)
        except ClientError as error:
            await self.send_json({"error": error.code})

    async def disconnect(self, code):
        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    async def send_signal(self, content):
        kind = content.get("type")
        if kind not in SIGNAL_TYPES:
            raise ClientError("SIGNAL_TYPE_INVALID")
        if kind in ("offer", "answer"):
            sdp = content.get("sdp")
            if not (isinstance(sdp, dict) and sdp.get("type") == kind
                    and isinstance(sdp.get("sdp"), str)):
                raise ClientError("SIGNAL_SDP_INVALID")
        if kind == "ice":
            candidate = content.get("candidate")
            if not (isinstance(candidate, dict) and isinstance(candidate.get("candidate"), str)):
                raise ClientError("SIGNAL_CANDIDATE_INVALID")
        if kind == "ended" and self.scope["user"].role != "doctor":
            raise ClientError("SIGNAL_NOT_ALLOWED")

        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "signal.message",
                "data": content,
                "sender_channel": self.channel_name,
            }
        )

    async def signal_message(self, event):
        if event.get("sender_channel") != self.channel_name:
            await self.send_json(event["data"])


class BaseChatConsumer(AsyncJsonWebsocketConsumer):
    group_prefix = None
    url_kwarg = None

    async def check_permission(self, room_id, user):
        raise NotImplementedError

    async def save_message(self, room_id, user, text):
        raise NotImplementedError

    async def connect(self):
        self.room_id = self.scope["url_route"]["kwargs"][self.url_kwarg]
        self.room_group_name = f"{self.group_prefix}_{self.room_id}"

        if self.scope["user"].is_anonymous:
            await self.close(code=CLOSE_POLICY_VIOLATION)
            return

        try:
            await self.check_permission(self.room_id, self.scope["user"])
        except ClientError:
            await self.close(code=CLOSE_POLICY_VIOLATION)
            return

        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

    async def receive_json(self, content):
        try:
            await self.send_room(content)
        except ClientError as e:
            await self.send_json({"error": e.code})

    async def disconnect(self, code):
        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    async def send_room(self, content):
        text = content.get("message")
        if not isinstance(text, str):
            raise ClientError("MESSAGE_INVALID")
        text = text.strip()
        if not text:
            raise ClientError("MESSAGE_EMPTY")
        if len(text) > MAX_MESSAGE_LENGTH:
            raise ClientError("MESSAGE_TOO_LONG")

        user = self.scope["user"]
        message = await self.save_message(self.room_id, user, text)
        await self.channel_layer.group_send(self.room_group_name, chat_event(message, user))

    async def chat_message(self, event):
        await self.send_json(
            {
                "id": event["id"],
                "sender": event["sender"],
                "sender_name": event["sender_name"],
                "sender_role": event["sender_role"],
                "message": event["message"],
                "file": event["file"],
                "file_name": event["file_name"],
                "created_at": event["created_at"],
            },
        )


class ChatConsumer(BaseChatConsumer):
    group_prefix = "chat"
    url_kwarg = "conversation_id"

    async def check_permission(self, room_id, user):
        return await get_conversation_permission(room_id, user)

    async def save_message(self, room_id, user, text):
        return await create_conversation_message(room_id, user, text)


class AppointmentChatConsumer(BaseChatConsumer):
    group_prefix = "appointment_chat"
    url_kwarg = "appointment_id"

    async def check_permission(self, room_id, user):
        return await get_appointment_permission(room_id, user)

    async def save_message(self, room_id, user, text):
        return await create_appointment_message(room_id, user, text)