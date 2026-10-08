"""Fixtures partagées par les tests de toutes les features."""

import json

import pytest
from django.core.cache import cache
from rest_framework.test import APIClient

from integrations.llm.client import Completion


@pytest.fixture(autouse=True)
def _isolated_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture(autouse=True)
def _media_root(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path / "media"


class FakeLLM:
    """Remplace l'appel réseau à Groq. `when(motif, réponse)` : la première règle dont le motif
    apparaît dans le prompt système ou utilisateur fournit la réponse."""

    def __init__(self):
        self.rules: list[tuple[str, str]] = []
        self.calls: list[dict] = []

    def when(self, needle: str, response) -> "FakeLLM":
        text = response if isinstance(response, str) else json.dumps(response)
        self.rules.append((needle, text))
        return self

    def __call__(self, *, model, system, prompt, max_tokens, temperature, json_mode):
        self.calls.append({"model": model, "system": system, "prompt": prompt, "json": json_mode})
        for needle, text in self.rules:
            if needle in system or needle in prompt:
                return Completion(text=text, model=model, input_tokens=12, output_tokens=8)
        default = "{}" if json_mode else "Réponse générée."
        return Completion(text=default, model=model, input_tokens=12, output_tokens=8)


@pytest.fixture
def fake_llm(monkeypatch):
    fake = FakeLLM()
    monkeypatch.setattr("integrations.llm.client._create", fake)
    return fake


@pytest.fixture
def make_user(db):
    from features.accounts import services

    counter = {"n": 0}

    def _make(username: str | None = None, **extra):
        counter["n"] += 1
        username = username or f"dev{counter['n']}"
        user = services.register_user(
            username=username,
            email=f"{username}@example.com",
            password="Sup3r-secret-pass",
            display_name=extra.pop("display_name", username.title()),
        )
        for field, value in extra.items():
            setattr(user, field, value)
        if extra:
            user.save()
        return user

    return _make


@pytest.fixture
def user(make_user):
    return make_user("amina")


@pytest.fixture
def other_user(make_user):
    return make_user("kofi")


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def client_for():
    def _client(user):
        client = APIClient()
        client.force_authenticate(user=user)
        return client

    return _client


@pytest.fixture
def auth_client(client_for, user):
    return client_for(user)
