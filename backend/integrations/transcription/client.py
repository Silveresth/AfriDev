"""Transcription vocale : Whisper hébergé par Groq (whisper-large-v3-turbo par défaut)."""

from django.conf import settings

from integrations.llm import LLMError, groq_client


class TranscriptionError(Exception):
    pass


def transcribe(*, audio: bytes, filename: str, language: str | None = None) -> str:
    """Renvoie le texte transcrit. `language` (« fr », « en »…) améliore la précision."""
    from groq import GroqError

    kwargs = {"language": language} if language else {}
    try:
        result = groq_client().audio.transcriptions.create(
            file=(filename, audio),
            model=settings.GROQ_TRANSCRIPTION_MODEL,
            response_format="json",
            **kwargs,
        )
    except (GroqError, LLMError) as exc:
        raise TranscriptionError(str(exc)) from exc
    return (getattr(result, "text", "") or "").strip()
