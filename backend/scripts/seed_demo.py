"""Données de démonstration pour développer le web et le mobile en local.

Usage (mode léger, sans Docker) :
    set DJANGO_LITE=1
    python manage.py migrate
    python manage.py shell -c "import scripts.seed_demo as s; s.run()"

Comptes créés (mot de passe : Demo-AfriDev-2026) : amina, kofi, fatou ;
équipe du back-office : afridev_admin (administratrice) et moussa (modérateur).
Aussi : hubs, offres d'emploi, événements, endossements, collections et karma.
Passe par les services des features, comme le ferait l'API.
"""

from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone

from features.accounts import services as accounts
from features.bookmarks import selectors as bookmark_selectors
from features.bookmarks import services as bookmarks
from features.discussions import services as discussions
from features.feed import selectors as feed_selectors
from features.feed import services as feed
from features.hubs import selectors as hub_selectors
from features.hubs import services as hubs
from features.jobs_events import selectors as jobs_selectors
from features.jobs_events import services as jobs_events
from features.moderation import selectors as moderation_selectors
from features.moderation import services as moderation
from features.profiles import selectors as profile_selectors
from features.profiles import services as profiles
from features.projects import services as projects
from features.qa import selectors as qa_selectors
from features.qa import services as qa
from features.snippets import selectors as snippet_selectors
from features.snippets import services as snippets

PASSWORD = "Demo-AfriDev-2026"

PEOPLE = [
    ("amina", "Amina Diallo", "Dakar, Sénégal", ["python", "django", "react", "postgresql"]),
    ("kofi", "Kofi Mensah", "Lomé, Togo", ["python", "fastapi", "redis", "docker"]),
    ("fatou", "Fatou Ndiaye", "Abidjan, Côte d'Ivoire", ["flutter", "dart", "firebase"]),
]

WEBHOOK = """from fastapi import FastAPI, Request
import redis.asyncio as redis

app = FastAPI()
r = redis.Redis(host="127.0.0.1", port=6379)

@app.post("/webhooks/wave")
async def wave_webhook(request: Request):
    payload = await request.json()
    # Verrou d'idempotence : Wave peut renvoyer le même événement plusieurs fois.
    if not await r.set(f"wave:{payload['id']}", 1, nx=True, ex=86400):
        return {"status": "deja_traite"}
    return {"status": "ok"}
"""


def _user(username, display_name, location, stack):
    user = get_user_model().objects.filter(username=username).first()
    if user is None:
        user = accounts.register_user(
            username=username,
            email=f"{username}@example.com",
            password=PASSWORD,
            display_name=display_name,
        )
    profile = profile_selectors.get_profile_for_user(user_id=user.id)
    profiles.update_profile(
        profile=profile,
        location=location,
        stack=stack,
        open_to_work=username != "kofi",
        bio=f"Développeur·se basé·e à {location.split(',')[0]}, "
        "passionné·e par l'open source africain.",
    )
    return user


def _team():
    """Équipe du back-office : une administratrice et un modérateur."""
    team = []
    for username, display_name, superuser in (
        ("afridev_admin", "Admin AfriDev", True),
        ("moussa", "Moussa Traoré", False),
    ):
        user = get_user_model().objects.filter(username=username).first()
        if user is None:
            user = accounts.register_user(
                username=username,
                email=f"{username}@example.com",
                password=PASSWORD,
                display_name=display_name,
            )
        user.is_staff = True
        user.is_superuser = superuser
        user.save(update_fields=["is_staff", "is_superuser"])
        team.append(user)
    return team


def _reports(amina, kofi, fatou):
    """Quelques signalements à traiter, pour essayer la file de modération."""
    if moderation_selectors.list_reports().exists():
        return
    spam = feed.create_post(
        author=fatou,
        body="🔥 Gagnez 50 000 FCFA par jour depuis chez vous ! Envoyez 2 000 FCFA "
        "par Flooz pour recevoir le guide.",
    )
    moderation.report_content(
        reporter=amina, target_type="post", target_id=spam.id, reason="scam", details="Arnaque."
    )
    moderation.report_content(reporter=kofi, target_type="post", target_id=spam.id, reason="spam")
    rude = discussions.create_comment(
        author=kofi,
        post_id=feed_selectors.list_feed(author_id=kofi.id).last().id,
        body="Franchement, une question pareille, c'est niveau débutant…",
    )
    # Contenu signalé par l'analyse automatique (confiance trop basse pour un masquage direct).
    moderation.flag_from_screening(
        target_type="comment",
        target_id=rude.id,
        verdict={
            "violates": True,
            "category": "abuse",
            "confidence": 0.71,
            "explanation": "Ton condescendant envers un autre membre.",
        },
    )


# Fil façon Reddit : (auteur, communauté + tags, titre, corps, votes ↑ par…, votes ↓ par…).
POSTS = [
    (
        "amina",
        ["django", "orange-money"],
        "Retour d'expérience : 6 mois d'Orange Money en production avec Django",
        "Ce qui a marché : file Celery pour les callbacks, idempotence sur l'ID de transaction, "
        "et un tableau de réconciliation quotidien.\n\nCe qui a coûté cher : les timeouts de "
        "l'API en heure de pointe. Prévoyez des relances avec backoff.",
        ["kofi", "fatou"],
        [],
    ),
    (
        "fatou",
        ["flutter", "offline-first"],
        "Mon appli Flutter tient 3 jours sans réseau : voici l'architecture",
        "SQLite local + une table d'outbox. Chaque écriture part dans l'outbox, un worker la "
        "vide dès que le réseau revient. Les conflits se règlent au timestamp serveur.",
        ["amina"],
        [],
    ),
    (
        "kofi",
        ["ussd", "python"],
        "Quelqu'un a déjà monté un menu USSD avec Africa's Talking ?",
        "Je cherche un exemple propre de gestion de session (les réponses arrivent en "
        "texte concaténé `1*2*3`). Vous stockez l'état où ?",
        [],
        ["amina"],
    ),
]


def _reddit_feed(people):
    """Posts titrés et votés ; complète aussi les titres des posts de démo plus anciens."""
    olds = {
        "Astuce du jour : rendez vos webhooks Wave": "Rendez vos webhooks Wave idempotents "
        "(une ligne de Redis)",
    }
    for post in feed_selectors.list_feed():
        for start, title in olds.items():
            if not post.title and post.body.startswith(start):
                feed.update_post(post=post, user=post.author, title=title)
    for author, tags, title, body, ups, downs in POSTS:
        if feed_selectors.list_feed().filter(title=title).exists():
            continue
        post = feed.create_post(author=people[author], title=title, body=body, tags=tags)
        for username in ups:
            feed.set_vote(post=post, user=people[username], value=1)
        for username in downs:
            feed.set_vote(post=post, user=people[username], value=-1)


# Hubs : (créateur, slug, nom, icône, pays, description, tags dont les contenus y sont rangés).
HUBS = [
    (
        "amina",
        "python-afrique",
        "Python Afrique",
        "🐍",
        "",
        "Django, FastAPI, data : les pythonistes du continent.",
        ["python", "django", "fastapi", "wave", "redis"],
    ),
    (
        "kofi",
        "mobile-money",
        "Mobile Money Builders",
        "💸",
        "",
        "Intégrer Wave, Orange Money, MTN MoMo et consorts sans doubles crédits.",
        ["orange-money", "mobile-money", "webhooks", "ussd"],
    ),
    (
        "fatou",
        "flutter-ci",
        "Flutter Côte d'Ivoire",
        "📱",
        "Côte d'Ivoire",
        "Apps Flutter offline-first, de Cocody à Yopougon.",
        ["flutter", "offline-first", "dart"],
    ),
]
RULES = [
    "Soyez bienveillants : tout le monde a débuté un jour.",
    "Pas de secrets dans le code partagé (clés d'API, mots de passe).",
    "Pas d'autopromotion sans contenu utile.",
]


def _hubs(people):
    """Hubs, adhésions, et rattachement des contenus de démo selon leurs tags."""
    created = {}
    for creator, slug, name, icon, country, description, _tags in HUBS:
        hub = hub_selectors.get_hub_by_slug(slug=slug) or hubs.create_hub(
            creator=people[creator],
            name=name,
            slug=slug,
            icon=icon,
            target_country=country,
            description=description,
            rules=RULES,
        )
        created[slug] = hub
        for user in people.values():
            hubs.join_hub(hub=hub, user=user)
    created["python-afrique"].is_verified = True
    created["python-afrique"].save(update_fields=["is_verified"])

    def hub_for(tags):
        for _creator, slug, *_rest, hub_tags in HUBS:
            if set(tags or []) & set(hub_tags):
                return created[slug].id
        return None

    for post in feed_selectors.list_feed().filter(hub_id__isnull=True):
        if hub := hub_for(post.tags):
            feed.update_post(post=post, user=post.author, hub_id=hub)
    for question in qa_selectors.list_questions().filter(hub_id__isnull=True):
        if hub := hub_for(question.tags):
            question.hub_id = hub
            question.save(update_fields=["hub_id"])
    for snippet in snippet_selectors.list_public_snippets().filter(hub_id__isnull=True):
        if hub := hub_for(snippet.tags):
            snippets.update_snippet(snippet=snippet, user=snippet.owner, hub_id=hub)


def _jobs_and_events(people):
    if not jobs_selectors.list_jobs(active=None).exists():
        jobs_events.create_job(
            author=people["kofi"],
            title="Développeur·se backend Django (paiements)",
            company="AfriPay",
            location="Lomé",
            country="Togo",
            contract_type="cdi",
            description="Vous construisez l'API qui relie Wave, Orange Money et T-Money. "
            "Celery, PostgreSQL, beaucoup d'idempotence.",
            apply_url="mailto:jobs@afripay.example",
            stack=["python", "django", "postgresql", "celery"],
            salary_range="900 000 – 1 300 000 FCFA / mois",
        )
        jobs_events.create_job(
            author=people["fatou"],
            title="Mission Flutter offline-first (3 mois)",
            company="KwikKassa",
            is_remote=True,
            country="Côte d'Ivoire",
            contract_type="freelance",
            description="Synchronisation SQLite ↔ API pour notre application de caisse.",
            apply_url="https://kwikkassa.example/missions/flutter",
            stack=["flutter", "dart", "sqlite"],
            salary_range="120 000 FCFA / jour",
        )
        jobs_events.create_job(
            author=people["amina"],
            title="Stage data / Python",
            company="Dakar Data Lab",
            location="Dakar",
            country="Sénégal",
            contract_type="stage",
            description="Six mois pour industrialiser nos tableaux de bord de mobile money.",
            apply_url="https://dakardatalab.example/stage",
            stack=["python", "pandas", "sql"],
        )
    if not jobs_selectors.list_events(upcoming=None).exists():
        soon = timezone.now().replace(hour=17, minute=0, second=0, microsecond=0)
        jobs_events.create_event(
            author=people["amina"],
            title="Meetup Python Dakar #12",
            kind="meetup",
            starts_at=soon + timedelta(days=5),
            ends_at=soon + timedelta(days=5, hours=3),
            location="Jokkolabs, Dakar",
            country="Sénégal",
            organizer="Python Sénégal",
            registration_url="https://example.com/meetup-python-dakar",
            description="FastAPI en production et retours d'expérience mobile money.",
            tags=["python", "fastapi"],
        )
        jobs_events.create_event(
            author=people["kofi"],
            title="Hackathon Mobile Money 48 h",
            kind="hackathon",
            starts_at=soon + timedelta(days=12),
            ends_at=soon + timedelta(days=14),
            location="Université de Lomé",
            country="Togo",
            organizer="AfriDev Exchange",
            registration_url="https://example.com/hackathon-momo",
            tags=["fintech", "mobile-money"],
        )
        jobs_events.create_event(
            author=people["fatou"],
            title="Webinar : Flutter hors ligne en pratique",
            kind="webinar",
            starts_at=soon + timedelta(days=2),
            is_online=True,
            organizer="GDG Abidjan",
            registration_url="https://example.com/webinar-flutter",
            tags=["flutter", "offline-first"],
        )


def _pro_profiles(people):
    amina, kofi, fatou = people["amina"], people["kofi"], people["fatou"]
    profiles.update_profile(
        profile=profile_selectors.get_profile_for_user(user_id=amina.id),
        work_preferences=["freelance", "mentorat"],
        daily_rate="150 000 FCFA / jour",
        availability_note="Disponible pour des missions courtes à partir de novembre.",
        github_username="django",
    )
    for endorser, endorsee, skill in (
        (kofi, amina, "django"),
        (fatou, amina, "django"),
        (kofi, amina, "postgresql"),
        (amina, kofi, "fastapi"),
        (amina, fatou, "flutter"),
        (kofi, fatou, "flutter"),
    ):
        profiles.endorse(
            endorsee=profile_selectors.get_profile_for_user(user_id=endorsee.id),
            endorser=endorser,
            skill=skill,
        )
    own_post = feed_selectors.list_feed(author_id=amina.id).exclude(title="").first()
    if own_post:
        profiles.set_pinned(
            profile=profile_selectors.get_profile_for_user(user_id=amina.id),
            items=[{"target_type": "post", "target_id": own_post.id}],
        )
    if not bookmark_selectors.list_collections(owner_id=amina.id).exists():
        collection = bookmarks.create_collection(
            owner=amina, name="Mes snippets Django", description="À relire avant la mise en prod."
        )
        for snippet in snippet_selectors.list_public_snippets().exclude(owner_id=amina.id):
            bookmarks.add_item(
                collection=collection, user=amina, target_type="snippet", target_id=snippet.id
            )
        bookmarks.create_collection(owner=amina, name="Trucs & astuces SQL")
    for user in people.values():
        profiles.recompute_reputation(user_id=user.id)


def _pro_features(people):
    _hubs(people)
    _jobs_and_events(people)
    _pro_profiles(people)


@transaction.atomic
def run():
    amina, kofi, fatou = (_user(*person) for person in PEOPLE)
    people = {"amina": amina, "kofi": kofi, "fatou": fatou}
    _team()
    if feed_selectors.list_feed(author_id=kofi.id).exists():
        _reports(amina, kofi, fatou)
        _reddit_feed(people)
        _pro_features(people)
        print("Données de démonstration déjà présentes (équipe, signalements et fil à jour).")
        return

    post = feed.create_post(
        author=kofi,
        title="Rendez vos webhooks Wave idempotents (une ligne de Redis)",
        body="Astuce du jour : rendez vos webhooks Wave idempotents.\n\n```python\n"
        'await r.set(f"wave:{event_id}", 1, nx=True, ex=86400)\n```\n'
        "Un `SET NX` avec expiration suffit à ignorer les doublons.",
        tags=["wave", "fastapi", "redis"],
    )
    discussions.create_comment(
        author=amina, post_id=post.id, body="Merci, ça m'a évité des doubles crédits !"
    )
    poll = feed.create_post(
        author=fatou,
        kind="poll",
        title="Quel framework pour une API mobile money ?",
        poll_options=["Django", "Laravel", "FastAPI"],
    )
    feed.vote_poll(post=poll, user=amina, option=0)
    feed.vote_poll(post=poll, user=kofi, option=2)
    feed.set_like(post=post, user=fatou, liked=True)

    question = qa.create_question(
        author=amina,
        title="Comment gérer les doublons des webhooks Orange Money ?",
        body="Mon endpoint reçoit parfois deux fois le même paiement quand le réseau 3G coupe.\n"
        "Comment éviter de créditer deux fois le client ?",
        tags=["orange-money", "webhooks", "django"],
    )
    answer = qa.create_answer(
        author=kofi,
        question=question,
        body="Stockez l'identifiant de transaction avec une contrainte d'unicité, "
        "ou un verrou Redis `SET NX` avant de créditer.",
    )
    qa.accept_answer(answer=answer, user=amina)
    qa.create_question(
        author=fatou,
        title="Flutter : synchroniser une base SQLite locale hors ligne ?",
        body="Quelle stratégie pour envoyer les écritures faites sans réseau "
        "quand la connexion revient ?",
        tags=["flutter", "offline-first"],
    )

    snippets.create_snippet(
        owner=kofi,
        title="Webhook Wave idempotent (FastAPI + Redis)",
        language="python",
        content=WEBHOOK,
        tags=["wave", "fastapi", "redis"],
        is_public=True,
    )
    snippets.create_snippet(
        owner=amina,
        title="Sauvegarde PostgreSQL compressée",
        language="bash",
        content='#!/usr/bin/env bash\npg_dump -Fc "$DATABASE_URL" > "backup_$(date +%F).dump"\n',
        tags=["postgresql", "backup"],
    )

    projects.create_project(
        owner=kofi,
        name="AfriPay SDK",
        description="SDK unifié pour Wave, Orange Money, Moov et T-Money, "
        "avec file d'attente hors ligne.",
        tags=["python", "fastapi", "mobile-money"],
    )
    projects.create_project(
        owner=fatou,
        name="KwikKassa POS",
        description="Point de vente hors ligne pour boutiques, avec réconciliation automatique.",
        tags=["flutter", "sqlite", "offline-first"],
    )
    _reports(amina, kofi, fatou)
    _reddit_feed(people)
    _pro_features(people)
    print("Données de démonstration créées. Mot de passe des comptes :", PASSWORD)
