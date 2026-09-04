"""
ASGI config for TelMed_backend project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/6.0/howto/deployment/asgi/
"""

import os

from channels.security.websocket import AllowedHostsOriginValidator
from channels.sessions import CookieMiddleware
#zmiany do web socketów/rtc
from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'TelMed_backend.settings')
django_asgi_app = get_asgi_application()

from channels.routing import ProtocolTypeRouter, URLRouter
from TelMed.connection.routing import websocket_urlpatterns
from TelMed.connection.middleware import JWTAuthMiddleware

application = ProtocolTypeRouter({
    'http': django_asgi_app,
    'websocket': AllowedHostsOriginValidator(
        CookieMiddleware(JWTAuthMiddleware(URLRouter(websocket_urlpatterns)))
    ),
})
