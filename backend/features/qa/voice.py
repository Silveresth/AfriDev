"""Questions vocales : envoi du message vocal à integrations.transcription (Whisper)."""

from features.media import selectors as media_selectors
from integrations import transcription


class VoiceError(Exception):
    pass


def transcribe_question(*, media_id, language: str | None = None) -> str:
    original = media_selectors.read_original(asset_id=media_id)
    if original is None:
        raise VoiceError("Message vocal introuvable.")
    audio, filename = original
    try:
        text = transcription.transcribe(audio=audio, filename=filename, language=language)
    except transcription.TranscriptionError as exc:
        raise VoiceError(str(exc)) from exc
    if not text:
        raise VoiceError("Aucune parole détectée dans le message vocal.")
    return text
