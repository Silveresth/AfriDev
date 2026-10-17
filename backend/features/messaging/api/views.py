"""Vues minces : valident l'entrée, puis appellent services / selectors."""

from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from rest_framework.views import APIView

from core.pagination import CursorPagination
from core.schema import CURSOR_PARAMETERS, paginated
from features.profiles import selectors as profile_selectors

from .. import selectors, services
from .serializers import (
    ConversationSerializer,
    MessageInputSerializer,
    MessageSerializer,
    OpenConversationSerializer,
    UnreadMessagesSerializer,
    present_conversations,
    present_messages,
)


def _present(conversations, user):
    conversations = list(conversations)
    cards = profile_selectors.author_cards(user_ids={c.other_id(user.id) for c in conversations})
    unread = selectors.unread_counts(conversations=conversations, user_id=user.id)
    return present_conversations(conversations, user_id=user.id, cards=cards, unread=unread)


def _conversation(request, conversation_id):
    conversation = selectors.get_conversation(
        conversation_id=conversation_id, user_id=request.user.id
    )
    if conversation is None:
        raise NotFound("Conversation introuvable.")
    return conversation


class ConversationListView(APIView):
    @extend_schema(
        operation_id="messages_conversations_list",
        parameters=CURSOR_PARAMETERS,
        responses=paginated(ConversationSerializer),
    )
    def get(self, request):
        paginator = CursorPagination()
        paginator.ordering = "-last_message_at"
        page = paginator.paginate_queryset(
            selectors.list_conversations(user_id=request.user.id), request
        )
        return paginator.get_paginated_response(_present(page, request.user))

    @extend_schema(
        operation_id="messages_conversations_open",
        request=OpenConversationSerializer,
        responses=ConversationSerializer,
        description="Ouvre (ou retrouve) la conversation avec ce membre.",
    )
    def post(self, request):
        data = OpenConversationSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        profile = profile_selectors.get_profile_by_username(
            username=data.validated_data["username"]
        )
        if profile is None:
            raise NotFound("Membre introuvable.")
        conversation = services.open_conversation(user=request.user, other_user_id=profile.user_id)
        return Response(_present([conversation], request.user)[0])


class ConversationDetailView(APIView):
    @extend_schema(operation_id="messages_conversations_get", responses=ConversationSerializer)
    def get(self, request, conversation_id):
        return Response(_present([_conversation(request, conversation_id)], request.user)[0])


class MessageListView(APIView):
    @extend_schema(
        operation_id="messages_list",
        parameters=CURSOR_PARAMETERS,
        responses=paginated(MessageSerializer),
        description="Messages du plus récent au plus ancien.",
    )
    def get(self, request, conversation_id):
        conversation = _conversation(request, conversation_id)
        paginator = CursorPagination()
        page = paginator.paginate_queryset(
            selectors.list_messages(conversation_id=conversation.id), request
        )
        return paginator.get_paginated_response(
            MessageSerializer(present_messages(page), many=True).data
        )

    @extend_schema(
        operation_id="messages_send",
        request=MessageInputSerializer,
        responses={201: MessageSerializer},
    )
    def post(self, request, conversation_id):
        data = MessageInputSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        message = services.send_message(
            conversation=_conversation(request, conversation_id),
            sender=request.user,
            body=data.validated_data["body"],
            media_id=data.validated_data.get("media_id"),
        )
        return Response(
            MessageSerializer(present_messages([message])[0]).data, status=status.HTTP_201_CREATED
        )


class MarkReadView(APIView):
    @extend_schema(
        operation_id="messages_mark_read", request=None, responses=ConversationSerializer
    )
    def post(self, request, conversation_id):
        conversation = services.mark_read(
            conversation=_conversation(request, conversation_id), user=request.user
        )
        return Response(_present([conversation], request.user)[0])


class UnreadMessagesView(APIView):
    @extend_schema(operation_id="messages_unread", responses=UnreadMessagesSerializer)
    def get(self, request):
        return Response({"unread": selectors.unread_conversation_count(user_id=request.user.id)})
