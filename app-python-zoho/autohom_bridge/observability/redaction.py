"""Redaction helpers for safe diagnostic output."""

import hashlib
import os
from urllib.parse import urlparse

SENSITIVE_KEYS = {
    "token",
    "authorization",
    "cookie",
    "cookies",
    "set-cookie",
    "password",
}


def hash_sensitive(value):
    text = str(value or "")
    return f"sha256:{hashlib.sha256(text.encode('utf-8')).hexdigest()[:16]}"


def safe_path_summary(path):
    normalized = os.path.abspath(str(path or "")) if path else ""
    filename = os.path.basename(normalized) if normalized else ""
    _, extension = os.path.splitext(filename)
    parent = os.path.dirname(normalized) if normalized else ""
    return {
      "filename": filename,
      "extension": extension,
      "pathHash": hash_sensitive(normalized) if normalized else "",
      "parentFolderHash": hash_sensitive(parent) if parent else "",
    }


def safe_url_summary(url):
    if not url:
        return {}
    parsed = urlparse(str(url))
    return {
      "host": parsed.netloc,
      "path": parsed.path,
      "urlHash": hash_sensitive(url),
    }


def redact_value(value):
    if isinstance(value, dict):
        return redact_dict(value)
    if isinstance(value, list):
        return [redact_value(item) for item in value[:50]]
    if isinstance(value, tuple):
        return [redact_value(item) for item in value[:50]]
    if isinstance(value, str):
        if value.lower().startswith(("http://", "https://")):
            return safe_url_summary(value)
        if ":\\" in value or value.startswith("/"):
            return safe_path_summary(value)
        if len(value) > 500:
            return f"{value[:250]}...[truncated:{len(value)}]"
    return value


def redact_dict(data):
    safe = {}
    for key, value in (data or {}).items():
        key_text = str(key)
        if key_text.lower() in SENSITIVE_KEYS:
            safe[key_text] = {"redacted": True, "hash": hash_sensitive(value)}
            continue
        safe[key_text] = redact_value(value)
    return safe
