"""Vues minces : valident l'entrée, puis appellent services / selectors."""

from drf_spectacular.utils import extend_schema
from rest_framework.response import Response
from rest_framework.views import APIView

from .. import services
from .serializers import ReactionInputSerializer, ReactionSummarySerializer


class ReactionView(APIView):
    """POST /api/reactions/<question|snippet|project>/<id>/ : vote ↑/↓ (0 = retrait)."""

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
