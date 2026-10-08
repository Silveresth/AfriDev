from features.snippets.security_guard import scan_for_secrets


def test_detects_aws_key():
    findings = scan_for_secrets('aws_key = "AKIAABCDEFGHIJKLMNOP"')
    assert any(f.rule_id == "aws-access-key" for f in findings)


def test_detects_private_key_on_correct_line():
    findings = scan_for_secrets("ok\n-----BEGIN RSA PRIVATE KEY-----\n")
    assert findings and findings[0].line == 2


def test_detects_django_secret_key_assignment():
    findings = scan_for_secrets('SECRET_KEY = "django-insecure-abcdef123456"')
    assert [f.rule_id for f in findings] == ["generic-secret-assignment"]


def test_detects_groq_key():
    groq_key = "gsk_" + "A1" * 26
    findings = scan_for_secrets(f"client = Groq(api_key=os.environ.get('X') or '{groq_key}')")
    assert "groq-api-key" in [f.rule_id for f in findings]


def test_clean_code_passes():
    assert scan_for_secrets("def add(a, b):\n    return a + b\n") == []
