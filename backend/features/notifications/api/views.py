"""Vues minces : valident l'entrée, puis appellent services / selectors."""

from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from rest_framework.views import APIView

from core.pagination import CursorPagination
from core.schema import CURSOR_PARAMETERS, paginated

from .. import selectors, services
from .serializers import (
    DeviceInputSerializer,
    NotificationSerializer,
    PreferencesSerializer,
    PreferencesUpdateSerializer,
    UnreadCountSerializer,
    present_preferences,
)


class NotificationListView(APIView):
    @extend_schema(
        parameters=[*CURSOR_PARAMETERS, OpenApiParameter("unread", bool, required=False)],
        responses=paginated(NotificationSerializer),
    )
    def get(self, request):
        unread = request.query_params.get("unread", "").lower() in ("1", "true")
        paginator = CursorPagination()
        page = paginator.paginate_queryset(
            selectors.list_notifications(user=request.user, unread_only=unread), request
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
