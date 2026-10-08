"""Consumer WebSocket (Channels) : commentaires en direct d'un post.

Connexion : ws(s)://<hôte>/ws/discussions/<post_id>/?token=<jeton d'accès>
Messages reçus : {"event": "comment.created", "comment": {...}} ou
                 {"event": "comment.deleted", "comment_id": "..."}
L'écriture passe par l'API HTTP (ou la synchro hors ligne), jamais par le socket.
"""

from channels.generic.websocket import AsyncJsonWebsocketConsumer

from .services import thread_group


class CommentsConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        if not self.scope["user"].is_authenticated:
            await self.close(code=4401)
            return
        self.group = thread_group(self.scope["url_route"]["kwargs"]["post_id"])
        await self.channel_layer.group_add(self.group, self.channel_name)
        await self.accept()

    async def disconnect(self, code):
        if hasattr(self, "group"):
            await self.channel_layer.group_discard(self.group, self.channel_name)

    async def comment_event(self, event):
        await self.send_json(event["payload"])
