from rest_framework.permissions import SAFE_METHODS, BasePermission


class IsOwnerOrReadOnly(BasePermission):
    """Lecture pour tous, écriture réservée au propriétaire (attribut `owner` ou `author`)."""

    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True
        owner_id = getattr(obj, "owner_id", None) or getattr(obj, "author_id", None)
        return owner_id == request.user.id


class ReadOnlyOrAuthenticated(BasePermission):
    """Lecture publique (pages SEO, profil du QR code), écriture pour les connectés."""

    def has_permission(self, request, view):
        return request.method in SAFE_METHODS or bool(
            request.user and request.user.is_authenticated
        )
