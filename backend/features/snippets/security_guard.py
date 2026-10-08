"""Security Guard, deux étages.

1. Règles locales inspirées de gitleaks (source unique : packages/validation/.../rules.json),
   déjà exécutées sur l'appareil ; on les rejoue ici car le client n'est jamais digne de confiance.
2. Analyse IA plus fine, asynchrone (tasks.ai_analyze_snippet).
"""

import json
import re
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from django.conf import settings


@dataclass(frozen=True)
class SecretFinding:
    rule_id: str
    description: str
    line: int


@lru_cache(maxsize=1)
def _rules():
    data = json.loads(Path(settings.SECURITY_GUARD_RULES_PATH).read_text(encoding="utf-8"))
    compiled = []
    for rule in data["rules"]:
        flags = re.IGNORECASE if "i" in rule.get("flags", "") else 0
        compiled.append((rule["id"], rule["description"], re.compile(rule["pattern"], flags)))
    return compiled


def scan_for_secrets(text: str) -> list[SecretFinding]:
    findings = []
    for line_number, line in enumerate(text.splitlines(), start=1):
        for rule_id, description, regex in _rules():
            if regex.search(line):
                findings.append(SecretFinding(rule_id, description, line_number))
    return findings
