"""Vues minces : valident l'entrée, puis appellent services / selectors."""

from drf_spectacular.utils import extend_schema
from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import ReadOnlyOrAuthenticated

from .. import selectors, services
from ..models import Reaction
from .serializers import ReactionInputSerializer, ReactionSummarySerializer


class ReactionView(APIView):
    """/api/reactions/<type>/<id>/ (question, snippet, projet, offre, commentaires) : score (GET)
    et vote (POST, 0 = retrait)."""

    permission_classes = [ReadOnlyOrAuthenticated]

    @extend_schema(responses=ReactionSummarySerializer, operation_id="reactions_summary")
    def get(self, request, target_type, target_id):
        if target_type not in Reaction.TargetType.values:
            raise NotFound("Type de contenu inconnu.")
        viewer_id = request.user.id if request.user.is_authenticated else None
        summary = selectors.summaries(
            target_type=target_type, target_ids=[target_id], viewer_id=viewer_id
        )[target_id]
        return Response(ReactionSummarySerializer(summary).data)

    @extend_schema(
        request=ReactionInputSerializer,
        responses=ReactionSummarySerializer,
        operation_id="reactions_vote",
    )
    def post(self, request, target_type, target_id):
        data = ReactionInputSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        summary = services.vote(
            user=request.user,
            target_type=target_type,
            target_id=target_id,
            value=data.validated_data["value"],
        )
        return Response(ReactionSummarySerializer(summary).data)
