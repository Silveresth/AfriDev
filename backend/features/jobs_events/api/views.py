"""Vues minces : valident l'entrée, puis appellent services / selectors."""

from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from rest_framework.views import APIView

from core.pagination import CursorPagination
from core.permissions import ReadOnlyOrAuthenticated
from core.schema import CURSOR_PARAMETERS, paginated

from .. import selectors, services
from .serializers import (
    EventInputSerializer,
    EventOutputSerializer,
    EventUpdateSerializer,
    FacetsSerializer,
    JobInputSerializer,
    JobOutputSerializer,
    JobUpdateSerializer,
    present_events,
    present_jobs,
)


def _flag(value: str | None) -> bool | None:
    return None if value in (None, "") else value.lower() in ("1", "true")


def _job(job_id):
    job = selectors.get_job(job_id=job_id)
    if job is None:
        raise NotFound("Offre introuvable.")
    return job


def _event(event_id):
    event = selectors.get_event(event_id=event_id)
    if event is None:
        raise NotFound("Événement introuvable.")
    return event


class JobListCreateView(APIView):
    permission_classes = [ReadOnlyOrAuthenticated]

    @extend_schema(
        parameters=[
            *CURSOR_PARAMETERS,
            OpenApiParameter("country", str, required=False),
            OpenApiParameter("tech", str, required=False, description="Technologie demandée"),
            OpenApiParameter("remote", bool, required=False),
            OpenApiParameter("contract", str, required=False),
            OpenApiParameter("q", str, required=False),
            OpenApiParameter("author", str, required=False, description="UUID de l'auteur"),
        ],
        responses=paginated(JobOutputSerializer),
        operation_id="jobs_list",
    )
    def get(self, request):
        params = request.query_params
        jobs = selectors.list_jobs(
            country=params.get("country"),
            tech=params.get("tech"),
            remote=_flag(params.get("remote")),
            contract=params.get("contract"),
            query=params.get("q"),
            author_id=params.get("author"),
            # L'auteur voit aussi ses offres pourvues.
            active=None if params.get("author") else True,
        )
        paginator = CursorPagination()
        page = paginator.paginate_queryset(jobs, request)
        return paginator.get_paginated_response(present_jobs(page))

    @extend_schema(request=JobInputSerializer, responses={201: JobOutputSerializer})
    def post(self, request):
        data = JobInputSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        job = services.create_job(author=request.user, **data.validated_data)
        return Response(present_jobs([job])[0], status=status.HTTP_201_CREATED)


class JobDetailView(APIView):
    permission_classes = [ReadOnlyOrAuthenticated]

    @extend_schema(responses=JobOutputSerializer)
    def get(self, request, job_id):
        return Response(present_jobs([_job(job_id)])[0])

    @extend_schema(request=JobUpdateSerializer, responses=JobOutputSerializer)
    def patch(self, request, job_id):
        data = JobUpdateSerializer(data=request.data, partial=True)
        data.is_valid(raise_exception=True)
        job = services.update_job(job=_job(job_id), user=request.user, **data.validated_data)
        return Response(present_jobs([job])[0])

    @extend_schema(responses={204: None})
    def delete(self, request, job_id):
        services.delete_job(job=_job(job_id), user=request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)


class JobFacetsView(APIView):
    permission_classes = [ReadOnlyOrAuthenticated]

    @extend_schema(responses=FacetsSerializer, operation_id="jobs_facets")
    def get(self, request):
        return Response(selectors.job_facets())


class EventListCreateView(APIView):
    permission_classes = [ReadOnlyOrAuthenticated]

    @extend_schema(
        parameters=[
            *CURSOR_PARAMETERS,
            OpenApiParameter("country", str, required=False),
            OpenApiParameter("kind", str, required=False),
            OpenApiParameter("online", bool, required=False),
            OpenApiParameter("tech", str, required=False),
            OpenApiParameter("q", str, required=False),
            OpenApiParameter("past", bool, required=False, description="Événements passés"),
        ],
        responses=paginated(EventOutputSerializer),
        operation_id="events_list",
    )
    def get(self, request):
        params = request.query_params
        past = _flag(params.get("past")) is True
        events = selectors.list_events(
            country=params.get("country"),
            kind=params.get("kind"),
            online=_flag(params.get("online")),
            tech=params.get("tech"),
            query=params.get("q"),
            upcoming=not past,
        )
        paginator = CursorPagination()
        # Les prochains d'abord ; les passés du plus récent au plus ancien.
        paginator.ordering = "-starts_at" if past else "starts_at"
        page = paginator.paginate_queryset(events, request)
        return paginator.get_paginated_response(present_events(page))

    @extend_schema(request=EventInputSerializer, responses={201: EventOutputSerializer})
    def post(self, request):
        data = EventInputSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        event = services.create_event(author=request.user, **data.validated_data)
        return Response(present_events([event])[0], status=status.HTTP_201_CREATED)


class EventDetailView(APIView):
    permission_classes = [ReadOnlyOrAuthenticated]

    @extend_schema(responses=EventOutputSerializer)
    def get(self, request, event_id):
        return Response(present_events([_event(event_id)])[0])

    @extend_schema(request=EventUpdateSerializer, responses=EventOutputSerializer)
    def patch(self, request, event_id):
        data = EventUpdateSerializer(data=request.data, partial=True)
        data.is_valid(raise_exception=True)
        event = services.update_event(
            event=_event(event_id), user=request.user, **data.validated_data
        )
        return Response(present_events([event])[0])

    @extend_schema(responses={204: None})
    def delete(self, request, event_id):
        services.delete_event(event=_event(event_id), user=request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)


class EventFacetsView(APIView):
    permission_classes = [ReadOnlyOrAuthenticated]

    @extend_schema(responses=FacetsSerializer, operation_id="events_facets")
    def get(self, request):
        return Response(selectors.event_facets())
