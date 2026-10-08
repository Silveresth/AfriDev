"""Embeddings (Voyage AI) stockés dans pgvector.

Sans VOYAGE_API_KEY (dev, tests), un embedding local par hachage des mots est utilisé :
moins pertinent, mais déterministe et sans réseau, pour que le RAG reste testable.
"""

import hashlib
import logging
import math
import re

import httpx
from django.conf import settings

logger = logging.getLogger(__name__)

EMBEDDING_DIM = 1024
VOYAGE_URL = "https://api.voyageai.com/v1/embeddings"
_BATCH = 64
_WORD = re.compile(r"[\w#+.-]+", re.UNICODE)


class EmbeddingError(Exception):
    pass


def _normalize(vector: list[float]) -> list[float]:
    norm = math.sqrt(sum(v * v for v in vector)) or 1.0
    return [v / norm for v in vector]


def _local_embedding(text: str) -> list[float]:
    vector = [0.0] * EMBEDDING_DIM
    for word in _WORD.findall(text.lower()):
        digest = hashlib.blake2b(word.encode("utf-8"), digest_size=8).digest()
        index = int.from_bytes(digest[:4], "little") % EMBEDDING_DIM
        sign = 1.0 if digest[4] & 1 else -1.0
        vector[index] += sign
    return _normalize(vector)


def embed(texts: list[str], *, input_type: str = "document") -> list[list[float]]:
    """`input_type` : « document » pour l'indexation, « query » pour une recherche."""
    if not texts:
        return []
    if not settings.VOYAGE_API_KEY:
        return [_local_embedding(text) for text in texts]

    vectors: list[list[float]] = []
    with httpx.Client(timeout=30) as client:
        for start in range(0, len(texts), _BATCH):
            batch = texts[start : start + _BATCH]
            try:
                response = client.post(
                    VOYAGE_URL,
                    headers={"Authorization": f"Bearer {settings.VOYAGE_API_KEY}"},
                    json={
                        "input": batch,
                        "model": settings.VOYAGE_MODEL,
                        "input_type": input_type,
                        "output_dimension": EMBEDDING_DIM,
                    },
                )
                response.raise_for_status()
            except httpx.HTTPError as exc:
                raise EmbeddingError(str(exc)) from exc
            data = sorted(response.json()["data"], key=lambda item: item["index"])
            vectors.extend(item["embedding"] for item in data)
    return vectors


def embed_one(text: str, *, input_type: str = "query") -> list[float]:
    return embed([text], input_type=input_type)[0]


def cosine_similarity(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b, strict=False))
    norm = math.sqrt(sum(x * x for x in a)) * math.sqrt(sum(y * y for y in b))
    return dot / norm if norm else 0.0
