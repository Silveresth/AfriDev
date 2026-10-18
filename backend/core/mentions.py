"""@mentions dans un texte (commentaires, réponses, posts) : @pseudo, 3 à 30 caractères.

Une adresse e-mail (« a@b.com ») ou un chemin (« /u/@x ») n'est pas une mention.
"""

import re

MENTION_RE = re.compile(r"(?<![\w@/.])@([A-Za-z0-9_]{3,30})\b")
MAX_MENTIONS = 10


def extract_usernames(text: str) -> list[str]:
    """Pseudos mentionnés, en minuscules, sans doublon, dans l'ordre (10 au plus)."""
    seen: dict[str, None] = {}
    for match in MENTION_RE.finditer(text or ""):
        seen.setdefault(match.group(1).lower(), None)
        if len(seen) >= MAX_MENTIONS:
            break
    return list(seen)
