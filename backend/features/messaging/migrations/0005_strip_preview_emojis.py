"""Aperçus déjà enregistrés : on retire les emojis (« 📷 Photo » → « Photo »)."""

from django.db import migrations

OLD_TO_NEW = {
    "🚫 Message supprimé": "Message supprimé",
    "📷 Photo": "Photo",
    "🎬 Vidéo": "Vidéo",
    "🎤 Message vocal": "Message vocal",
}


def strip_emojis(apps, schema_editor):
    Conversation = apps.get_model("messaging", "Conversation")
    for old, new in OLD_TO_NEW.items():
        Conversation.objects.filter(last_message_preview=old).update(last_message_preview=new)


class Migration(migrations.Migration):
    dependencies = [("messaging", "0004_message_risk_note")]

    operations = [migrations.RunPython(strip_emojis, migrations.RunPython.noop)]
