"""Filtre local, instantané et sans IA : insultes et injures haineuses sans ambiguïté.

Complète l'analyse IA (qui juge le contexte) : il agit tout de suite, même quand le service
d'IA est indisponible, et résiste aux déguisements courants (c0nnard, f*ck, connnnard, accents).
La liste ne contient que des termes qui sont des insultes quel que soit le contexte ; les mots
ambigus (« nul », « débile » à propos d'un code, « retard » qui veut aussi dire délai) restent
à l'appréciation de l'IA.
"""

import re
import unicodedata

# Injures visant une personne (catégorie « abuse »).
INSULTS = [
    # français
    "connard",
    "connasse",
    "salope",
    "salaud",
    "encule",
    "enculer",
    "enculee",
    "nique ta mere",
    "niquer ta mere",
    "ntm",
    "fils de pute",
    "fdp",
    "ta gueule",
    "ferme ta gueule",
    "fermez vos gueules",
    "pute",
    "petasse",
    "trou du cul",
    "va te faire foutre",
    "va te faire enculer",
    "sous merde",
    "grosse merde",
    # anglais
    "fuck you",
    "fuck off",
    "fck you",
    "fk you",
    "fuk you",
    "fck off",
    "motherfucker",
    "fucker",
    "bitch",
    "asshole",
    "cunt",
    "dickhead",
    "son of a bitch",
    "piece of shit",
    "go to hell",
    "stfu",
    "kys",
    "kill yourself",
]
# Injures haineuses (racisme, homophobie) : toujours masquées. Exclus volontairement, car
# courants dans les langues de la plateforme : « negro » (noir, en portugais), « pede »
# (demande, en portugais), « tapette », « macaque » (sens ordinaires en français).
SLURS = [
    "negre",
    "bougnoule",
    "nigger",
    "nigga",
    "faggot",
    "sale noir",
    "sale arabe",
    "sale juif",
    "sale negre",
]

LEET = str.maketrans(
    {"0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s", "!": "i"}
)


def normalize(text: str) -> str:
    """Minuscules, sans accents, chiffres « leet » remis en lettres, lettres répétées réduites,
    séparateurs glissés dans un mot retirés (f*ck, c.o.n.n.a.r.d)."""
    text = unicodedata.normalize("NFKD", text.lower())
    text = "".join(c for c in text if not unicodedata.combining(c)).translate(LEET)
    text = re.sub(r"(?<=\w)[*._\-](?=\w)", "", text)  # f*ck, c.o.n
    # Répétitions de 3 lettres et plus ramenées à 2 (connnnard -> connard). Jamais à 1 :
    # « nigger » deviendrait « niger », et le Niger (le pays) serait bloqué.
    text = re.sub(r"([a-z])\1{2,}", r"\1\1", text)
    return re.sub(r"[^a-z]+", " ", text).strip()


def _pattern(terms: list[str]) -> re.Pattern:
    words = sorted({normalize(t) for t in terms}, key=len, reverse=True)
    return re.compile(r"\b(" + "|".join(re.escape(w) for w in words) + r")\b")


_INSULTS = _pattern(INSULTS)
_SLURS = _pattern(SLURS)


def check(text: str) -> dict | None:
    """Verdict au même format que l'IA si le texte contient une injure certaine, sinon None."""
    normalized = normalize(text or "")
    if not normalized:
        return None
    if _SLURS.search(normalized):
        return {
            "violates": True,
            "category": "hate",
            "confidence": 0.99,
            "explanation": "Injure haineuse (racisme, homophobie…) détectée automatiquement.",
        }
    if _INSULTS.search(normalized):
        return {
            "violates": True,
            "category": "insult",
            "confidence": 0.97,
            "explanation": "Insulte directe détectée automatiquement.",
        }
    return None
