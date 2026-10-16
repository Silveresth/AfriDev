import pytest

pytestmark = pytest.mark.django_db(transaction=True)


def test_answers_by_author(api_client, auth_client, client_for, user, other_user):
    kofi = client_for(other_user)
    questions = [
        kofi.post(
            "/api/qa/questions/",
            {"title": f"Comment déployer le service {n} ?", "body": "…", "tags": ["devops"]},
            format="json",
        ).data
        for n in range(2)
    ]
    answers = [
        auth_client.post(
            f"/api/qa/questions/{q['id']}/answers/", {"body": "Avec Docker."}, format="json"
        ).data
        for q in questions
    ]
    kofi.post(f"/api/qa/answers/{answers[0]['id']}/accept/")

    rows = api_client.get(f"/api/qa/answers/?author={user.id}").data["results"]
    assert [row["id"] for row in rows] == [answers[1]["id"], answers[0]["id"]]
    assert rows[1]["question_title"] == questions[0]["title"]
    assert rows[1]["is_accepted"] is True

    accepted = api_client.get(f"/api/qa/answers/?author={user.id}&accepted=true").data
    assert [row["id"] for row in accepted["results"]] == [answers[0]["id"]]

    assert api_client.get("/api/qa/answers/?author=nope").status_code == 400
