ROLES = ("owner", "admin", "analyst", "viewer")

PERMISSIONS = {
    "audit:read": ("owner", "admin"),
    "settings:write": ("owner", "admin"),
    "repo:write": ("owner", "admin", "analyst"),
    "report:write": ("owner", "admin", "analyst"),
    "finding:write": ("owner", "admin", "analyst"),
    "assistant:action": ("owner", "admin", "analyst"),
    "health:read": ("owner", "admin", "analyst", "viewer"),
}


def has_permission(role: str | None, permission: str) -> bool:
    return role in PERMISSIONS.get(permission, ())
