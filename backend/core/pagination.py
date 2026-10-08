from rest_framework import pagination


class CursorPagination(pagination.CursorPagination):
    """Pagination par curseur : stable pendant le défilement et légère en données."""

    ordering = "-created_at"
    page_size = 20
    max_page_size = 50
    page_size_query_param = "page_size"
