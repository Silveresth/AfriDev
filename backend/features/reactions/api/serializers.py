from rest_framework import serializers


class ReactionInputSerializer(serializers.Serializer):
    value = serializers.ChoiceField(choices=[-1, 0, 1], help_text="1 = ↑, -1 = ↓, 0 = retrait.")


class ReactionSummarySerializer(serializers.Serializer):
    score = serializers.IntegerField()
    up = serializers.IntegerField()
    down = serializers.IntegerField()
    viewer_vote = serializers.IntegerField(help_text="Vote du visiteur : -1, 0 ou 1.")
