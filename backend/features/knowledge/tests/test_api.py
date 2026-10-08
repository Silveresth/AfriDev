import uuid

import pytest

from features.knowledge import indexer

pytestmark = pytest.mark.django_db(transaction=True)


def test_search_endpoint_text_and_semantic(api_client):
    indexer.index_document(
        source_type="snippet",
        source_id=uuid.uuid4(),
        title="Paiement T-Money",
        text="Intégration de T-Money en PHP",
    )
    text = api_client.get("/api/knowledge/search/", {"q": "T-Money"})
    assert text.status_code == 200 and text.data[0]["title"] == "Paiement T-Money"

    semantic = api_client.get(
        "/api/knowledge/search/", {"q": "paiement tmoney php", "mode": "semantic"}
    )
    assert semantic.data[0]["source_type"] == "snippet"
