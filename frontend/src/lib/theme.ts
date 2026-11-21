export const accents = [
  { id: "orange", name: "Burp orange", color: "#b45309", rgb: "180,83,9", second: "#356f9e" },
  { id: "blue", name: "Port blue", color: "#356f9e", rgb: "53,111,158", second: "#6f8fb5" },
  { id: "graphite", name: "Graphite", color: "#4b5563", rgb: "75,85,99", second: "#7b8794" },
  { id: "teal", name: "Signal teal", color: "#0d7f6e", rgb: "13,127,110", second: "#3f8f9c" },
] as const;

export type AccentId = (typeof accents)[number]["id"];

const ACCENT_KEY = "aegis-accent";
const THEME_KEY = "aegis-theme";

export type ThemeId = "light" | "dark";

export function applyTheme(theme: ThemeId) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    return;
  }
}

export function applyStoredTheme() {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(THEME_KEY);
  } catch {
    stored = null;
  }
  applyTheme(stored === "dark" ? "dark" : "light");
}

export function currentTheme(): ThemeId {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export function applyAccent(id: AccentId) {
  const selected = accents.find((entry) => entry.id === id) ?? accents[0];
  document.documentElement.style.setProperty("--accent", selected.color);
  document.documentElement.style.setProperty("--accent-rgb", selected.rgb);
  document.documentElement.style.setProperty("--accent-2", selected.second);
  try {
    localStorage.setItem(ACCENT_KEY, selected.id);
  } catch {
    return;
  }
}

export function applyStoredAccent() {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(ACCENT_KEY);
  } catch {
    stored = null;
  }
  const selected = accents.find((entry) => entry.id === stored) ?? accents[0];
  applyAccent(selected.id);
}
