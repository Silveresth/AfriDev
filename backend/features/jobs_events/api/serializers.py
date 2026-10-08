from rest_framework import serializers

from core.serializers import AuthorSerializer
from features.profiles import selectors as profile_selectors

from ..models import JobOffer, TechEvent

TAGS = serializers.ListField(child=serializers.CharField(max_length=30), required=False)


class JobInputSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=120)
    company = serializers.CharField(max_length=100)
    location = serializers.CharField(max_length=100, required=False, allow_blank=True)
    country = serializers.CharField(max_length=60, required=False, allow_blank=True)
    is_remote = serializers.BooleanField(required=False, default=False)
    contract_type = serializers.ChoiceField(choices=JobOffer.Contract.choices)
    description = serializers.CharField(max_length=6000)
    apply_url = serializers.CharField(max_length=300)
    stack = serializers.ListField(
        child=serializers.CharField(max_length=30), required=False, max_length=12
    )
    salary_range = serializers.CharField(max_length=80, required=False, allow_blank=True)


class JobUpdateSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=120, required=False)
    company = serializers.CharField(max_length=100, required=False)
    location = serializers.CharField(max_length=100, required=False, allow_blank=True)
    country = serializers.CharField(max_length=60, required=False, allow_blank=True)
    is_remote = serializers.BooleanField(required=False)
    contract_type = serializers.ChoiceField(choices=JobOffer.Contract.choices, required=False)
    description = serializers.CharField(max_length=6000, required=False)
    apply_url = serializers.CharField(max_length=300, required=False)
    stack = serializers.ListField(
        child=serializers.CharField(max_length=30), required=False, max_length=12
    )
    salary_range = serializers.CharField(max_length=80, required=False, allow_blank=True)
    is_active = serializers.BooleanField(required=False)


class JobOutputSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    title = serializers.CharField()
    company = serializers.CharField()
    location = serializers.CharField()
    country = serializers.CharField()
    is_remote = serializers.BooleanField()
    contract_type = serializers.ChoiceField(choices=JobOffer.Contract.choices)
    description = serializers.CharField()
    apply_url = serializers.CharField()
    stack = serializers.ListField(child=serializers.CharField())
    salary_range = serializers.CharField()
    is_active = serializers.BooleanField()
    author = AuthorSerializer(allow_null=True)
    created_at = serializers.DateTimeField()
    updated_at = serializers.DateTimeField()


class EventInputSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=120)
    kind = serializers.ChoiceField(choices=TechEvent.Kind.choices)
    starts_at = serializers.DateTimeField()
    ends_at = serializers.DateTimeField(required=False, allow_null=True)
    location = serializers.CharField(max_length=150, required=False, allow_blank=True)
    country = serializers.CharField(max_length=60, required=False, allow_blank=True)
    is_online = serializers.BooleanField(required=False, default=False)
    organizer = serializers.CharField(max_length=100)
    registration_url = serializers.CharField(max_length=300, required=False, allow_blank=True)
    description = serializers.CharField(max_length=6000, required=False, allow_blank=True)
    tags = serializers.ListField(
        child=serializers.CharField(max_length=30), required=False, max_length=8
    )


class EventUpdateSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=120, required=False)
    kind = serializers.ChoiceField(choices=TechEvent.Kind.choices, required=False)
    starts_at = serializers.DateTimeField(required=False)
    ends_at = serializers.DateTimeField(required=False, allow_null=True)
    location = serializers.CharField(max_length=150, required=False, allow_blank=True)
    country = serializers.CharField(max_length=60, required=False, allow_blank=True)
    is_online = serializers.BooleanField(required=False)
    organizer = serializers.CharField(max_length=100, required=False)
    registration_url = serializers.CharField(max_length=300, required=False, allow_blank=True)
    description = serializers.CharField(max_length=6000, required=False, allow_blank=True)
    tags = serializers.ListField(
        child=serializers.CharField(max_length=30), required=False, max_length=8
    )


class EventOutputSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    title = serializers.CharField()
    kind = serializers.ChoiceField(choices=TechEvent.Kind.choices)
    starts_at = serializers.DateTimeField()
    ends_at = serializers.DateTimeField(allow_null=True)
    location = serializers.CharField()
    country = serializers.CharField()
    is_online = serializers.BooleanField()
    organizer = serializers.CharField()
    registration_url = serializers.CharField()
    description = serializers.CharField()
    tags = serializers.ListField(child=serializers.CharField())
    author = AuthorSerializer(allow_null=True)
    created_at = serializers.DateTimeField()


class FacetSerializer(serializers.Serializer):
    value = serializers.CharField()
    count = serializers.IntegerField()


class FacetsSerializer(serializers.Serializer):
    countries = FacetSerializer(many=True)
    technologies = FacetSerializer(many=True)


def _with_authors(rows, fields):
    rows = list(rows)
    authors = profile_selectors.author_cards(user_ids={row.author_id for row in rows})
    return [
        {**{name: getattr(row, name) for name in fields}, "author": authors.get(row.author_id)}
        for row in rows
    ]


JOB_OUTPUT_FIELDS = [name for name in JobOutputSerializer().fields if name != "author"]
EVENT_OUTPUT_FIELDS = [name for name in EventOutputSerializer().fields if name != "author"]


def present_jobs(jobs) -> list[dict]:
    return _with_authors(jobs, JOB_OUTPUT_FIELDS)


def present_events(events) -> list[dict]:
    return _with_authors(events, EVENT_OUTPUT_FIELDS)
