import re
from typing import Any, Dict, List, Tuple

# Prompt Injection Detection Signatures
PROMPT_INJECTION_PATTERNS = [
    (
        r"(?i)\bignore\s+(all\s+)?(previous|prior|system)\s+instructions\b",
        "Instruction Override: Attempt to ignore previous instructions",
    ),
    (
        r"(?i)\boverride\s+(system|developer|safety)\s+(prompt|policy|rules|guardrails)\b",
        "System Override: Attempt to supersede safety rules",
    ),
    (
        r"(?i)\b(reveal|print|show|leak|output)\s+(the\s+)?(system\s+prompt|secret|api[_\s-]?key|credentials|private\s+key)\b",
        "Secret Extraction: Attempt to reveal internal instructions or credentials",
    ),
    (
        r"(?i)\bdisregard\s+(all\s+)?(guidelines|rules|constraints|policies)\b",
        "Constraint Evasion: Attempt to disregard system constraints",
    ),
    (
        r"(?i)\bbypass\s+(security|authorization|guardrails|filters)\b",
        "Guardrail Bypass: Explicit instruction to circumvent controls",
    ),
    (
        r"(?i)\b(exfiltrate|send|dump|upload)\s+(all\s+)?(data|records|database|customers)\s+to\b",
        "Data Exfiltration: Mass extraction instruction detected",
    ),
]

# Sensitive Data Detection Signatures
CREDIT_CARD_REGEX = re.compile(r"\b(?:\d{4}[-\s]?){3}\d{4}\b")
EMAIL_REGEX = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b")
PHONE_REGEX = re.compile(r"\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b")
SSN_REGEX = re.compile(r"\b\d{3}-\d{2}-\d{4}\b")
API_KEY_REGEX = re.compile(
    r"\b(sk-[a-zA-Z0-9]{20,}|ghp_[a-zA-Z0-9]{36}|AIza[0-9A-Za-z-_]{35}|Bearer\s+[a-zA-Z0-9-._~+/]+=*)\b"
)

# Unapproved External Destinations
UNAPPROVED_DESTINATION_REGEX = re.compile(
    r"(?i)\b(webhook\.site|pastebin\.com|ngrok\.io|requestbin\.net|transfer-untrusted\.io|[a-z0-9-]+\.ru|[a-z0-9-]+\.onion)\b"
)


class ContentScanResult:
    def __init__(self):
        self.injection_detected = False
        self.sensitive_data_detected = False
        self.unapproved_destination_detected = False
        self.injection_reasons: List[str] = []
        self.sensitive_findings: List[str] = []
        self.redacted_text: str = ""


def stringify_params(params: Any) -> str:
    """Recursively converts dict/list/primitives into a single searchable text string."""
    if isinstance(params, dict):
        return " ".join(f"{k}: {stringify_params(v)}" for k, v in params.items())
    elif isinstance(params, list):
        return " ".join(stringify_params(x) for x in params)
    else:
        return str(params or "")


def scan_content(payload_str: str) -> ContentScanResult:
    """
    Performs deterministic inspection on request payload for prompt injection,
    sensitive data leakage, and unapproved external endpoints.
    """
    result = ContentScanResult()

    # 1. Prompt Injection Checks
    for pattern, desc in PROMPT_INJECTION_PATTERNS:
        if re.search(pattern, payload_str):
            result.injection_detected = True
            result.injection_reasons.append(desc)

    # 2. Sensitive Data Checks
    if CREDIT_CARD_REGEX.search(payload_str):
        result.sensitive_data_detected = True
        result.sensitive_findings.append("Credit Card Number Pattern")

    if SSN_REGEX.search(payload_str):
        result.sensitive_data_detected = True
        result.sensitive_findings.append("Social Security Number Pattern")

    if API_KEY_REGEX.search(payload_str):
        result.sensitive_data_detected = True
        result.sensitive_findings.append("Credential or API Key Pattern")

    if PHONE_REGEX.search(payload_str):
        result.sensitive_findings.append("Telephone Number Pattern")

    # 3. Destination Check
    if UNAPPROVED_DESTINATION_REGEX.search(payload_str):
        result.unapproved_destination_detected = True
        result.sensitive_findings.append("Unapproved External Transfer Destination")

    return result


def redact_sensitive_data(text: str) -> str:
    """Redacts sensitive credentials, cards, and SSNs from text."""
    redacted = CREDIT_CARD_REGEX.sub("****-****-****-XXXX", text)
    redacted = SSN_REGEX.sub("***-**-XXXX", redacted)
    redacted = API_KEY_REGEX.sub("[REDACTED_API_KEY]", redacted)
    return redacted
