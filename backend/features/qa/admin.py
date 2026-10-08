from django.contrib import admin

from .models import Answer, Question


class AnswerInline(admin.TabularInline):
    model = Answer
    extra = 0
    fields = ("author", "body", "is_accepted", "score")


@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "author",
        "is_resolved",
        "answer_count",
        "ai_answer_status",
        "created_at",
    )
    list_filter = ("is_resolved", "ai_answer_status")
    search_fields = ("title", "body", "author__username")
    inlines = [AnswerInline]
