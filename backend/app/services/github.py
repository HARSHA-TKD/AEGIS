"""GitHub repository ingestion used by the server-side scanner."""

from __future__ import annotations

import base64
import logging
import os
import time
from collections import Counter
from dataclasses import dataclass
from typing import Any

import httpx

from app.core.config import settings

API_BASE = "https://api.github.com"
logger = logging.getLogger(__name__)

# Extensions worth scanning and the language label they map to.
EXTENSION_LANGUAGES: dict[str, str] = {
    ".js": "JavaScript",
    ".jsx": "JavaScript",
    ".mjs": "JavaScript",
    ".cjs": "JavaScript",
    ".ts": "TypeScript",
    ".tsx": "TypeScript",
    ".py": "Python",
    ".go": "Go",
    ".java": "Java",
    ".kt": "Kotlin",
    ".kts": "Kotlin",
    ".rb": "Ruby",
    ".php": "PHP",
    ".rs": "Rust",
    ".cs": "C#",
    ".c": "C",
    ".h": "C",
    ".cpp": "C++",
    ".hpp": "C++",
    ".swift": "Swift",
    ".scala": "Scala",
    ".sh": "Shell",
    ".sql": "SQL",
    ".tf": "HCL",
    ".hcl": "HCL",
    ".yaml": "YAML",
    ".yml": "YAML",
    ".html": "HTML",
    ".vue": "Vue",
    ".svelte": "Svelte",
}

SKIPPED_SEGMENTS = {
    "node_modules",
    "vendor",
    "dist",
    "build",
    "out",
    "coverage",
    ".git",
    ".next",
    ".venv",
    "venv",
    "__pycache__",
}

SKIPPED_FILES = {
    "package-lock.json",
    "pnpm-lock.yaml",
    "yarn.lock",
    "poetry.lock",
    "Cargo.lock",
    "go.sum",
}


class GitHubError(Exception):
    def __init__(self, message: str, status_code: int = 502) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


@dataclass
class SourceBundle:
    commit_sha: str | None
    files: list[tuple[str, str]]
    loc: int
    language: str


def parse_full_name(full_name: str) -> tuple[str, str]:
    parts = full_name.strip().strip("/").split("/")
    if len(parts) != 2 or not all(parts):
        raise GitHubError("Repository must be in owner/name form.", status_code=422)
    return parts[0], parts[1]


def _token_for(token: str | None) -> str | None:
    if token and token.strip():
        return token.strip()
    env_token = os.getenv("GITHUB_TOKEN") or settings.github_token
    if env_token and str(env_token).strip():
        return str(env_token).strip()
    return None


def _is_scannable(path: str) -> bool:
    segments = path.split("/")
    if any(segment in SKIPPED_SEGMENTS for segment in segments[:-1]):
        return False
    filename = segments[-1]
    if filename in SKIPPED_FILES:
        return False
    if filename.endswith((".min.js", ".map", ".lock")):
        return False
    dot = filename.rfind(".")
    if dot == -1:
        return False
    return filename[dot:].lower() in EXTENSION_LANGUAGES


def _infer_language(paths: list[str]) -> str:
    counts: Counter[str] = Counter()
    for path in paths:
        dot = path.rfind(".")
        language = EXTENSION_LANGUAGES.get(path[dot:].lower()) if dot != -1 else None
        if language:
            counts[language] += 1
    if not counts:
        return "Unknown"
    return counts.most_common(1)[0][0]


class GitHubClient:
    def __init__(self, token: str | None = None, timeout: float = 20.0, max_retries: int = 3) -> None:
        headers = {
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "aegis-scanner",
        }
        token = _token_for(token)
        if token:
            headers["Authorization"] = f"Bearer {token}"
        self._client = httpx.Client(base_url=API_BASE, headers=headers, timeout=timeout)
        self._max_retries = max_retries
        self._token_present = bool(token)

    def __enter__(self) -> "GitHubClient":
        return self

    def __exit__(self, *_: object) -> None:
        self.close()

    def close(self) -> None:
        self._client.close()

    def _rate_limit_info(self, response: httpx.Response) -> dict[str, str]:
        info = {}
        for key in ("X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset"):
            if response.headers.get(key):
                info[key] = response.headers.get(key)
        return info

    def _get(self, path: str, **kwargs: object) -> httpx.Response:
        retries = 0
        while retries <= self._max_retries:
            try:
                response = self._client.get(path, **kwargs)
            except httpx.HTTPError as exc:
                retries += 1
                if retries > self._max_retries:
                    raise GitHubError(f"Unable to reach GitHub: {exc}") from exc
                time.sleep(0.5 * retries)
                continue

            if response.status_code == 404:
                raise GitHubError("Repository, branch or path not found on GitHub.", 404)
            if response.status_code == 429:
                reset = response.headers.get("X-RateLimit-Reset")
                retries += 1
                if retries > self._max_retries:
                    raise GitHubError(
                        "GitHub API rate limit exceeded (429). Add a valid GITHUB_TOKEN to raise limits.",
                        429,
                    )
                sleep_for = 2 * retries
                if reset and reset.isdigit():
                    try:
                        wait = max(1, int(reset) - int(time.time()) + 1)
                        sleep_for = min(wait, 60)
                    except Exception:
                        pass
                time.sleep(sleep_for)
                continue
            if response.status_code == 403:
                remaining = response.headers.get("X-RateLimit-Remaining")
                if remaining == "0":
                    reset = response.headers.get("X-RateLimit-Reset")
                    msg = "GitHub API rate limit reached. Add a valid GITHUB_TOKEN to increase rate limits."
                    if reset and reset.isdigit():
                        try:
                            msg = f"GitHub API rate limit reached (resets ~{int(reset) - int(time.time())}s). Add a valid GITHUB_TOKEN to increase rate limits."
                        except Exception:
                            pass
                    raise GitHubError(msg, 429)
                raise GitHubError(
                    "GitHub rejected the request. Check repository permissions or add a valid GITHUB_TOKEN.",
                    403,
                )
            if response.status_code >= 400:
                raise GitHubError(
                    f"GitHub returned {response.status_code}: {response.text[:200]}",
                    response.status_code,
                )
            return response
        raise GitHubError("GitHub request failed after retries.", 503)

    def get_repository(self, full_name: str) -> dict:
        return self._get(f"/repos/{full_name}").json()

    def get_branch(self, full_name: str, branch: str) -> dict:
        return self._get(f"/repos/{full_name}/branches/{branch}").json()

    def get_tree(self, full_name: str, ref: str) -> dict:
        return self._get(
            f"/repos/{full_name}/git/trees/{ref}", params={"recursive": "1"}
        ).json()

    def fetch_file(self, full_name: str, path: str, ref: str) -> str | None:
        response = self._get(
            f"/repos/{full_name}/contents/{path}",
            params={"ref": ref},
            headers={"Accept": "application/vnd.github.raw+json"},
        )
        if len(response.content) > settings.scan_max_file_bytes:
            return None
        try:
            text = response.content.decode("utf-8")
        except UnicodeDecodeError:
            return None
        if "\x00" in text:
            return None
        return text

    def collect_source(self, full_name: str, branch: str | None = None) -> SourceBundle:
        repository = self.get_repository(full_name)
        ref = branch or repository.get("default_branch") or "main"

        commit_sha: str | None = None
        try:
            commit_sha = self.get_branch(full_name, ref).get("commit", {}).get("sha")
        except GitHubError:
            commit_sha = None

        tree = self.get_tree(full_name, ref)
        blobs = [
            entry
            for entry in tree.get("tree", [])
            if entry.get("type") == "blob" and _is_scannable(entry.get("path", ""))
        ]
        blobs.sort(key=lambda entry: entry.get("size", 0))

        selected: list[str] = []
        budget = settings.scan_max_file_bytes * 8
        used = 0
        for entry in blobs:
            size = int(entry.get("size", 0))
            if used + size > budget or len(selected) >= settings.scan_max_files:
                break
            selected.append(entry["path"])
            used += size

        files: list[tuple[str, str]] = []
        for path in selected:
            content = self.fetch_file(full_name, path, ref)
            if content:
                files.append((path, content))

        loc = sum(content.count("\n") + 1 for _, content in files)
        language = _infer_language(selected) if selected else repository.get("language") or "Unknown"

        return SourceBundle(
            commit_sha=commit_sha,
            files=files,
            loc=loc,
            language=language,
        )

    def ping(self) -> dict[str, Any]:
        resp = self._get("/rate_limit")
        return resp.json()
