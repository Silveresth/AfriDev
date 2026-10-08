"""Consumer WebSocket (Channels) : notifications en direct.

Connexion : ws(s)://<hôte>/ws/notifications/?token=<jeton d'accès>
Messages reçus : {"event": "notification", "id", "kind", "title", "body", "data", ...}
"""

from channels.generic.websocket import AsyncJsonWebsocketConsumer

from .channels import user_group


class NotificationsConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        user = self.scope["user"]
        if not user.is_authenticated:
            await self.close(code=4401)
            return
        self.group = user_group(user.id)
        await self.channel_layer.group_add(self.group, self.channel_name)
        await self.accept()

    async def disconnect(self, code):
        if hasattr(self, "group"):
            await self.channel_layer.group_discard(self.group, self.channel_name)

    async def notification_event(self, event):
        await self.send_json(event["payload"])
