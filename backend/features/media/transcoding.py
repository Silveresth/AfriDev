"""Transcodage : WebP/AVIF + ThumbHash (image), HLS adaptatif 240p-720p (vidéo), Opus (voix).

Les images passent par Pillow. Vidéo et audio exigent ffmpeg/ffprobe ; sans eux,
l'original est servi tel quel (dev) et un avertissement est journalisé.
"""

import io
import json
import logging
import shutil
import subprocess
import tempfile
from dataclasses import dataclass, field
from pathlib import Path

from django.conf import settings
from PIL import Image, ImageOps

from integrations import storage

from .thumbhash import image_to_thumbhash_b64

logger = logging.getLogger(__name__)

IMAGE_SIZES = {"small": 480, "large": 1280}
# (hauteur, débit vidéo) : du réseau 2G/3G au Wi-Fi.
HLS_LADDER = [(240, "300k"), (360, "600k"), (480, "1000k"), (720, "2000k")]
OPUS_BITRATE = "24k"  # voix mono : ~10x plus léger que le MP3


class TranscodingError(Exception):
    pass


@dataclass
class TranscodeResult:
    variants: dict = field(default_factory=dict)
    width: int | None = None
    height: int | None = None
    duration_seconds: float | None = None
    thumbhash: str = ""


def _ffmpeg() -> str | None:
    return shutil.which(settings.FFMPEG_BINARY)


def _ffprobe() -> str | None:
    ffmpeg = _ffmpeg()
    if not ffmpeg:
        return None
    candidate = Path(ffmpeg).with_name(Path(ffmpeg).name.replace("ffmpeg", "ffprobe"))
    return str(candidate) if candidate.exists() else shutil.which("ffprobe")


def _run(args: list[str]) -> None:
    result = subprocess.run(args, capture_output=True, text=True, timeout=600)
    if result.returncode != 0:
        raise TranscodingError(result.stderr[-2000:])


def _probe(path: Path) -> dict:
    ffprobe = _ffprobe()
    if not ffprobe:
        return {}
    result = subprocess.run(
        [
            ffprobe,
            "-v",
            "error",
            "-print_format",
            "json",
            "-show_streams",
            "-show_format",
            str(path),
        ],
        capture_output=True,
        text=True,
        timeout=60,
    )
    if result.returncode != 0:
        return {}
    data = json.loads(result.stdout or "{}")
    video = next((s for s in data.get("streams", []) if s.get("codec_type") == "video"), {})
    return {
        "width": video.get("width"),
        "height": video.get("height"),
        "duration": float(data.get("format", {}).get("duration") or 0) or None,
    }


def _upload_dir(local_dir: Path, prefix: str) -> None:
    for file in local_dir.rglob("*"):
        if file.is_file():
            storage.save_file(f"{prefix}/{file.relative_to(local_dir).as_posix()}", file)


# ── Image ──


def transcode_image(original_path: str, base: str) -> TranscodeResult:
    with storage.local_copy(original_path) as source:
        with Image.open(source) as opened:
            image = ImageOps.exif_transpose(opened)
            image.load()
    result = TranscodeResult(width=image.width, height=image.height)
    result.thumbhash = image_to_thumbhash_b64(image)

    mode = "RGBA" if image.mode in ("RGBA", "LA", "P") else "RGB"
    image = image.convert(mode)
    for name, max_side in IMAGE_SIZES.items():
        variant = image.copy()
        variant.thumbnail((max_side, max_side))
        buffer = _encode(variant, "WEBP", quality=78, method=4)
        result.variants[name] = storage.save(f"{base}/{name}.webp", buffer)

    large = image.copy()
    large.thumbnail((IMAGE_SIZES["large"], IMAGE_SIZES["large"]))
    try:
        result.variants["avif"] = storage.save(
            f"{base}/large.avif", _encode(large, "AVIF", quality=55)
        )
    except (KeyError, OSError, ValueError):
        logger.info("AVIF indisponible dans cette version de Pillow, WebP seulement.")
    return result


def _encode(image: Image.Image, fmt: str, **options) -> bytes:
    buffer = io.BytesIO()
    image.save(buffer, format=fmt, **options)
    return buffer.getvalue()


# ── Vidéo ──


def transcode_video(original_path: str, base: str) -> TranscodeResult:
    ffmpeg = _ffmpeg()
    if not ffmpeg:
        logger.warning("ffmpeg absent : vidéo %s servie sans HLS.", original_path)
        return TranscodeResult()

    with storage.local_copy(original_path) as source, tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp)
        info = _probe(source)
        source_height = info.get("height") or 720
        ladder = [rung for rung in HLS_LADDER if rung[0] <= max(source_height, 240)]

        master = ["#EXTM3U", "#EXT-X-VERSION:3"]
        for height, bitrate in ladder:
            rendition = out / f"{height}p"
            rendition.mkdir()
            _run(
                [
                    ffmpeg,
                    "-y",
                    "-i",
                    str(source),
                    "-vf",
                    f"scale=-2:{height}",
                    "-c:v",
                    "libx264",
                    "-preset",
                    "veryfast",
                    "-profile:v",
                    "main",
                    "-b:v",
                    bitrate,
                    "-maxrate",
                    bitrate,
                    "-bufsize",
                    bitrate,
                    "-g",
                    "48",
                    "-sc_threshold",
                    "0",
                    "-c:a",
                    "aac",
                    "-b:a",
                    "64k",
                    "-ac",
                    "1",
                    "-hls_time",
                    "4",
                    "-hls_playlist_type",
                    "vod",
                    "-hls_segment_filename",
                    str(rendition / "seg_%03d.ts"),
                    str(rendition / "index.m3u8"),
                ]
            )
            bandwidth = int(bitrate.rstrip("k")) * 1000 + 64000
            width = int(round((info.get("width") or 16) * height / source_height / 2) * 2)
            master.append(f"#EXT-X-STREAM-INF:BANDWIDTH={bandwidth},RESOLUTION={width}x{height}")
            master.append(f"{height}p/index.m3u8")
        (out / "master.m3u8").write_text("\n".join(master) + "\n", encoding="utf-8")

        poster = out / "poster.jpg"
        _run([ffmpeg, "-y", "-ss", "0.5", "-i", str(source), "-frames:v", "1", str(poster)])
        with Image.open(poster) as image:
            thumbhash = image_to_thumbhash_b64(image)
            image.thumbnail((720, 720))
            poster_webp = _encode(image.convert("RGB"), "WEBP", quality=75)
        poster.unlink()

        _upload_dir(out, f"{base}/hls")
    return TranscodeResult(
        variants={
            "hls": f"{base}/hls/master.m3u8",
            "poster": storage.save(f"{base}/poster.webp", poster_webp),
        },
        width=info.get("width"),
        height=info.get("height"),
        duration_seconds=info.get("duration"),
        thumbhash=thumbhash,
    )


# ── Audio ──


def transcode_audio(original_path: str, base: str) -> TranscodeResult:
    ffmpeg = _ffmpeg()
    if not ffmpeg:
        logger.warning("ffmpeg absent : audio %s servi sans conversion Opus.", original_path)
        return TranscodeResult()

    with storage.local_copy(original_path) as source, tempfile.TemporaryDirectory() as tmp:
        target = Path(tmp) / "voice.ogg"
        _run(
            [
                ffmpeg,
                "-y",
                "-i",
                str(source),
                "-vn",
                "-ac",
                "1",
                "-c:a",
                "libopus",
                "-b:a",
                OPUS_BITRATE,
                "-application",
                "voip",
                str(target),
            ]
        )
        info = _probe(target)
        path = storage.save_file(f"{base}/voice.ogg", target)
    return TranscodeResult(variants={"opus": path}, duration_seconds=info.get("duration"))


TRANSCODERS = {"image": transcode_image, "video": transcode_video, "audio": transcode_audio}
