"""Encodeur ThumbHash (portage de l'implémentation de référence d'Evan Wallace, licence MIT).

Produit un aperçu flou de ~25 octets, décodé côté client (expo-image, thumbhash JS).
"""

import base64
import math


def _round(value: float) -> int:
    # Math.round de JavaScript (arrondi vers +inf sur les .5), pas l'arrondi bancaire de Python.
    return math.floor(value + 0.5)


def rgba_to_thumbhash(w: int, h: int, rgba: bytes) -> bytes:
    if w > 100 or h > 100:
        raise ValueError(f"{w}x{h} ne tient pas dans 100x100")

    avg_r = avg_g = avg_b = avg_a = 0.0
    for i in range(w * h):
        j = i * 4
        alpha = rgba[j + 3] / 255
        avg_r += alpha / 255 * rgba[j]
        avg_g += alpha / 255 * rgba[j + 1]
        avg_b += alpha / 255 * rgba[j + 2]
        avg_a += alpha
    if avg_a:
        avg_r /= avg_a
        avg_g /= avg_a
        avg_b /= avg_a

    has_alpha = avg_a < w * h
    l_limit = 5 if has_alpha else 7
    lx = max(1, _round(l_limit * w / max(w, h)))
    ly = max(1, _round(l_limit * h / max(w, h)))

    lum, p_chan, q_chan, a_chan = [], [], [], []
    for i in range(w * h):
        j = i * 4
        alpha = rgba[j + 3] / 255
        r = avg_r * (1 - alpha) + alpha / 255 * rgba[j]
        g = avg_g * (1 - alpha) + alpha / 255 * rgba[j + 1]
        b = avg_b * (1 - alpha) + alpha / 255 * rgba[j + 2]
        lum.append((r + g + b) / 3)
        p_chan.append((r + g) / 2 - b)
        q_chan.append(r - g)
        a_chan.append(alpha)

    def encode_channel(channel, nx, ny):
        dc, ac, scale = 0.0, [], 0.0
        for cy in range(ny):
            cx = 0
            while cx * ny < nx * (ny - cy):
                fx = [math.cos(math.pi / w * cx * (x + 0.5)) for x in range(w)]
                f = 0.0
                for y in range(h):
                    fy = math.cos(math.pi / h * cy * (y + 0.5))
                    row = y * w
                    for x in range(w):
                        f += channel[x + row] * fx[x] * fy
                f /= w * h
                if cx or cy:
                    ac.append(f)
                    scale = max(scale, abs(f))
                else:
                    dc = f
                cx += 1
        if scale:
            ac = [0.5 + 0.5 / scale * value for value in ac]
        return dc, ac, scale

    l_dc, l_ac, l_scale = encode_channel(lum, max(3, lx), max(3, ly))
    p_dc, p_ac, p_scale = encode_channel(p_chan, 3, 3)
    q_dc, q_ac, q_scale = encode_channel(q_chan, 3, 3)
    a_dc, a_ac, a_scale = encode_channel(a_chan, 5, 5) if has_alpha else (0.0, [], 0.0)

    is_landscape = w > h
    header24 = (
        _round(63 * l_dc)
        | (_round(31.5 + 31.5 * p_dc) << 6)
        | (_round(31.5 + 31.5 * q_dc) << 12)
        | (_round(31 * l_scale) << 18)
        | (int(has_alpha) << 23)
    )
    header16 = (
        (ly if is_landscape else lx)
        | (_round(63 * p_scale) << 3)
        | (_round(63 * q_scale) << 9)
        | (int(is_landscape) << 15)
    )
    hash_bytes = [
        header24 & 255,
        (header24 >> 8) & 255,
        header24 >> 16,
        header16 & 255,
        header16 >> 8,
    ]
    ac_start = 6 if has_alpha else 5
    if has_alpha:
        hash_bytes.append(_round(15 * a_dc) | (_round(15 * a_scale) << 4))

    ac_index = 0
    for ac in [l_ac, p_ac, q_ac, a_ac] if has_alpha else [l_ac, p_ac, q_ac]:
        for value in ac:
            position = ac_start + (ac_index >> 1)
            while len(hash_bytes) <= position:
                hash_bytes.append(0)
            hash_bytes[position] |= _round(15 * value) << ((ac_index & 1) << 2)
            ac_index += 1
    return bytes(hash_bytes)


def image_to_thumbhash_b64(image) -> str:
    """`image` : image Pillow, réduite ici à 100x100 maximum."""
    thumb = image.convert("RGBA")
    thumb.thumbnail((100, 100))
    raw = rgba_to_thumbhash(thumb.width, thumb.height, thumb.tobytes())
    return base64.b64encode(raw).decode("ascii")
