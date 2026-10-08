"""Point d'entrée ASGI : HTTP + WebSocket (Channels)."""

import os

from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.dev")
django_asgi_app = get_asgi_application()

from channels.routing import ProtocolTypeRouter, URLRouter  # noqa: E402

from core.ws_auth import JWTAuthMiddleware  # noqa: E402
from features.discussions.routing import websocket_urlpatterns as discussions_ws  # noqa: E402
from features.notifications.routing import websocket_urlpatterns as notifications_ws  # noqa: E402

application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        # Le web et le mobile n'ont pas de cookie de session : le JWT passe en ?token=.
        # Sans cookie, pas de détournement inter-sites possible : inutile de filtrer l'Origin,
        # ce qui bloquerait le site web servi depuis un autre domaine que l'API.
        "websocket": JWTAuthMiddleware(URLRouter(discussions_ws + notifications_ws)),
    }
)
