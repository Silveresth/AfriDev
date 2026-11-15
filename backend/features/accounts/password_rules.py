"""Règles de composition du mot de passe, identiques à celles affichées par le site et l'appli :
8 caractères (MinimumLengthValidator), un chiffre, une majuscule ou un symbole."""

import re

from django.core.exceptions import ValidationError


class CompositionValidator:
    def validate(self, password: str, user=None) -> None:
        errors = []
        if not re.search(r"\d", password or ""):
            errors.append(ValidationError("Ajoutez au moins un chiffre.", code="password_no_digit"))
        if not re.search(r"[A-Z]|[^A-Za-z0-9]", password or ""):
            errors.append(
                ValidationError(
                    "Ajoutez au moins une majuscule ou un symbole.",
                    code="password_no_upper_or_symbol",
                )
            )
        if errors:
            raise ValidationError(errors)

    def get_help_text(self) -> str:
        return "Au moins un chiffre et une majuscule ou un symbole."
