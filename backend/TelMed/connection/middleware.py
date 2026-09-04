from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.tokens import AccessToken


@database_sync_to_async
def get_user(user_id):
    from TelMed.users.models import User
    try:
        return User.objects.get(id=user_id)
    except User.DoesNotExist:
        return AnonymousUser()


class JWTAuthMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        token = scope.get('cookies', {}).get('access_token')
        if not token:
            scope['user'] = AnonymousUser()
            return await self.app(scope, receive, send)

        try:
            user_id = AccessToken(token)['user_id']
        except (InvalidToken, TokenError):
            scope['user'] = AnonymousUser()
        else:
            scope['user'] = await get_user(user_id)

        return await self.app(scope, receive, send)