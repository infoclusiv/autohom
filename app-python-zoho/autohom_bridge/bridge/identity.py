"""Pure helpers for extension identity handling."""


def validate_extension_identity(payload, expected_extension_id, expected_extension_type):
    actual_id = str(payload.get("extensionId") or "").strip()
    actual_type = str(payload.get("extensionType") or "").strip()
    if not actual_id:
        return False, "extensionId missing in handshake."
    if actual_id != expected_extension_id:
        return False, f"Unexpected extensionId: {actual_id}"
    if not actual_type:
        return False, "extensionType missing in handshake."
    if actual_type != expected_extension_type:
        return False, f"Unexpected extensionType: {actual_type}"
    return True, ""


def build_connection_meta(payload, expected_extension_id, expected_extension_type, connection_id):
    data = dict(payload or {})
    runtime_id = str(data.get("runtimeInstanceId") or data.get("instanceId") or "default").strip() or "default"
    client_id = str(data.get("clientId") or data.get("extensionClientId") or expected_extension_id).strip()
    version = str(data.get("version") or "").strip()
    return {
        "connection_id": str(connection_id or ""),
        "extension_type": expected_extension_type,
        "runtime_instance_id": runtime_id,
        "instance_id": runtime_id,
        "extension_id": expected_extension_id,
        "client_id": client_id or expected_extension_id,
        "version": version,
    }


def same_runtime_identity(left, right):
    lc = str((left or {}).get("client_id") or "").strip()
    rc = str((right or {}).get("client_id") or "").strip()
    lr = str((left or {}).get("runtime_instance_id") or "").strip()
    rr = str((right or {}).get("runtime_instance_id") or "").strip()
    return bool(lc and rc and lr and rr and lc == rc and lr == rr)
