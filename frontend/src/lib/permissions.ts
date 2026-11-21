const PERMISSIONS: Record<string, string[]> = {
  "audit:read": ["owner", "admin"],
  "settings:write": ["owner", "admin"],
  "repo:write": ["owner", "admin", "analyst"],
  "report:write": ["owner", "admin", "analyst"],
  "finding:write": ["owner", "admin", "analyst"],
  "assistant:action": ["owner", "admin", "analyst"],
  "health:read": ["owner", "admin", "analyst", "viewer"],
};

export function hasPermission(role: string | null | undefined, permission: string): boolean {
  return Boolean(role && PERMISSIONS[permission]?.includes(role));
}
