"""Vues minces : valident l'entrée, puis appellent services / selectors."""

from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.exceptions import NotFound
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from core.pagination import CursorPagination
from core.schema import CURSOR_PARAMETERS, paginated
from integrations import push

from .. import selectors, services
from .serializers import (
    DeviceInputSerializer,
    DeviceTokenSerializer,
    NotificationSerializer,
    PreferencesSerializer,
    PreferencesUpdateSerializer,
    UnreadCountSerializer,
    WebPushConfigSerializer,
    WebPushSubscribeSerializer,
    WebPushUnsubscribeSerializer,
    present_preferences,
)


class NotificationListView(APIView):
    @extend_schema(
        parameters=[
            *CURSOR_PARAMETERS,
            OpenApiParameter("unread", bool, required=False),
            OpenApiParameter(
                "kind", str, required=False, description="Un seul type (ex. new_member)."
            ),
        ],
        responses=paginated(NotificationSerializer),
    )
    def get(self, request):
        unread = request.query_params.get("unread", "").lower() in ("1", "true")
        paginator = CursorPagination()
        page = paginator.paginate_queryset(
            selectors.list_notifications(
                user=request.user,
                unread_only=unread,
                kind=request.query_params.get("kind") or None,
            ),
            request,
        )
        return paginator.get_paginated_response(NotificationSerializer(page, many=True).data)

    @extend_schema(operation_id="notifications_clear", request=None, responses={204: None})
    def delete(self, request):
        """Efface toutes les notifications du membre."""
        services.clear_all(user=request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)


def _get_or_404(request, notification_id):
    notification = selectors.get_notification(user=request.user, notification_id=notification_id)
    if notification is None:
        raise NotFound("Notification introuvable.")
    return notification


class NotificationDetailView(APIView):
    @extend_schema(operation_id="notifications_destroy", request=None, responses={204: None})
    def delete(self, request, notification_id):
        services.delete_notification(notification=_get_or_404(request, notification_id))
        return Response(status=status.HTTP_204_NO_CONTENT)


class UnreadCountView(APIView):
    @extend_schema(responses=UnreadCountSerializer)
    def get(self, request):
        return Response({"unread": selectors.unread_count(user=request.user)})


class MarkReadView(APIView):
    @extend_schema(request=None, responses=NotificationSerializer)
    def post(self, request, notification_id):
        notification = _get_or_404(request, notification_id)
        return Response(NotificationSerializer(services.mark_read(notification=notification)).data)


class MarkAllReadView(APIView):
    @extend_schema(request=None, responses=UnreadCountSerializer)
    def post(self, request):
        services.mark_all_read(user=request.user)
        return Response({"unread": 0})


class DeviceView(APIView):
    @extend_schema(request=DeviceInputSerializer, responses={204: None})
    def post(self, request):
        data = DeviceInputSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        services.register_device(user=request.user, **data.validated_data)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @extend_schema(request=DeviceInputSerializer, responses={204: None})
    def delete(self, request):
        data = DeviceInputSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        services.unregister_device(user=request.user, token=data.validated_data["token"])
        return Response(status=status.HTTP_204_NO_CONTENT)


class DeviceUnregisterView(APIView):
    """Désinscrit un appareil mobile à la déconnexion. Sans session : la requête part même si
    les jetons de connexion sont déjà effacés ou expirés, et connaître le jeton Expo ne permet
    que de couper les notifications de cet appareil."""

    permission_classes = [AllowAny]
    # Jeton de session ignoré : expiré, il ferait échouer la requête (401) en pleine déconnexion.
    authentication_classes = []

    @extend_schema(request=DeviceTokenSerializer, responses={204: None})
    def post(self, request):
        data = DeviceTokenSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        services.forget_device(token=data.validated_data["token"])
        return Response(status=status.HTTP_204_NO_CONTENT)


class WebPushView(APIView):
    """Notifications push du navigateur (Web Push / VAPID)."""

    @extend_schema(operation_id="notifications_webpush_config", responses=WebPushConfigSerializer)
    def get(self, request):
        return Response({"public_key": push.webpush_public_key()})

    @extend_schema(
        operation_id="notifications_webpush_subscribe",
        request=WebPushSubscribeSerializer,
        responses={204: None},
    )
    def post(self, request):
        data = WebPushSubscribeSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        services.subscribe_webpush(
            user=request.user,
            endpoint=data.validated_data["endpoint"],
            p256dh=data.validated_data["keys"]["p256dh"],
            auth=data.validated_data["keys"]["auth"],
            user_agent=request.headers.get("User-Agent", ""),
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


class WebPushUnsubscribeView(APIView):
    """POST plutôt que DELETE : le corps (endpoint) reste décrit dans le schéma OpenAPI."""

    @extend_schema(
        operation_id="notifications_webpush_unsubscribe",
        request=WebPushUnsubscribeSerializer,
        responses={204: None},
    )
    def post(self, request):
        data = WebPushUnsubscribeSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        services.unsubscribe_webpush(user=request.user, endpoint=data.validated_data["endpoint"])
        return Response(status=status.HTTP_204_NO_CONTENT)


class PreferencesView(APIView):
    """Réglages > Notifications : types reçus, push et e-mail."""

    @extend_schema(responses=PreferencesSerializer)
    def get(self, request):
        return Response(present_preferences(selectors.get_preferences(user=request.user)))

    @extend_schema(request=PreferencesUpdateSerializer, responses=PreferencesSerializer)
    def patch(self, request):
        data = PreferencesUpdateSerializer(data=request.data, partial=True)
        data.is_valid(raise_exception=True)
        preference = services.update_preferences(user=request.user, **data.validated_data)
        return Response(present_preferences(preference))
