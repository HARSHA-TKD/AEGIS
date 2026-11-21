import json
import sys
import time

import requests
import websocket

API = "http://127.0.0.1:8000"
FRONTEND = "http://localhost:5173"
CDP = "http://127.0.0.1:9222"
EMAIL = "operator@aegis.dev"
PASSWORD = "aegis-demo-2026"


class CdpClient:
    def __init__(self, url: str) -> None:
        self.socket = websocket.create_connection(url, timeout=30)
        self.counter = 0
        self.call("Page.enable")
        self.call("Runtime.enable")

    def call(self, method: str, params: dict | None = None) -> dict:
        self.counter += 1
        message_id = self.counter
        self.socket.send(json.dumps({"id": message_id, "method": method, "params": params or {}}))
        while True:
            payload = json.loads(self.socket.recv())
            if payload.get("id") == message_id:
                if "error" in payload:
                    raise RuntimeError(payload["error"])
                return payload.get("result", {})

    def evaluate(self, expression: str):
        result = self.call(
            "Runtime.evaluate",
            {"expression": expression, "awaitPromise": True, "returnByValue": True},
        )["result"]
        if "exceptionDetails" in result:
            raise RuntimeError(result["exceptionDetails"])
        return result.get("value")

    def navigate(self, path: str) -> None:
        self.call("Page.navigate", {"url": f"{FRONTEND}{path}"})
        time.sleep(2.5)


def token_and_repo() -> tuple[str, str]:
    response = requests.post(
        f"{API}/api/auth/login", json={"email": EMAIL, "password": PASSWORD}, timeout=20
    )
    response.raise_for_status()
    payload = response.json()
    headers = {"Authorization": f"Bearer {payload['accessToken']}"}
    repos = requests.get(f"{API}/api/repos", headers=headers, timeout=20)
    repos.raise_for_status()
    for repo in repos.json():
        scans = requests.get(
            f"{API}/api/scans?repositoryId={repo['id']}", headers=headers, timeout=20
        )
        if scans.ok and scans.json() and scans.json()[0]["status"] == "complete":
            return payload["accessToken"], repo["id"]
    return payload["accessToken"], repos.json()[0]["id"]


def target_url() -> str:
    targets = requests.get(f"{CDP}/json", timeout=10).json()
    page = next((item for item in targets if item.get("type") == "page"), None)
    if page is None:
        page = requests.put(f"{CDP}/json/new?{FRONTEND}/", timeout=10).json()
    return page["webSocketDebuggerUrl"]


def check(client: CdpClient, label: str, expression: str) -> bool:
    value = False
    for _ in range(10):
        value = client.evaluate(expression)
        if value is True:
            break
        time.sleep(0.5)
    print(f"{label}: {value}")
    return value is True


def check_refresh_state(client: CdpClient) -> bool:
    client.navigate("/health")
    client.call("Network.enable")
    client.call(
        "Network.emulateNetworkConditions",
        {"offline": False, "latency": 1000, "downloadThroughput": 300000, "uploadThroughput": 300000},
    )
    try:
        value = client.evaluate(
            """(async () => {
              const button = Array.from(document.querySelectorAll('button')).find(
                (item) => /Re-check|Checking/.test(item.textContent || '')
              );
              if (!button) return false;
              button.click();
              await new Promise((resolve) => setTimeout(resolve, 150));
              const active = button.textContent.includes('Checking...')
                && button.getAttribute('aria-busy') === 'true'
                && button.disabled
                && Boolean(button.querySelector('.spin'));
              await new Promise((resolve) => setTimeout(resolve, 3000));
              const settled = button.textContent.includes('Re-check')
                && button.getAttribute('aria-busy') === null
                && !button.disabled;
              return active && settled;
            })()"""
        )
        print(f"re-check loading: {value}")
        return value is True
    finally:
        client.call(
            "Network.emulateNetworkConditions",
            {"offline": False, "latency": 0, "downloadThroughput": -1, "uploadThroughput": -1},
        )


def main() -> int:
    token, repo_id = token_and_repo()
    client = CdpClient(target_url())
    client.navigate("/login")
    login_script = f"""
    (async () => {{
      const response = await fetch("{API}/api/auth/login", {{
        method: "POST",
        headers: {{ "Content-Type": "application/json" }},
        body: JSON.stringify({{ email: "{EMAIL}", password: "{PASSWORD}" }}),
      }});
      const payload = await response.json();
      localStorage.setItem("aegis-token", payload.accessToken);
      localStorage.setItem("aegis-operator", JSON.stringify(payload.user));
      return Boolean(payload.accessToken);
    }})()
    """
    if client.evaluate(login_script) is not True:
        print("login: false")
        return 1

    checks = [
        ("/", "dashboard", "document.body.innerText.includes('security posture')"),
        ("/reports", "reports", "document.body.innerText.includes('Risk trend') && document.body.innerText.includes('Scheduled reports')"),
        ("/intelligence", "intelligence", "document.body.innerText.toLowerCase().includes('saved filters')"),
        (f"/projects/{repo_id}", "project security", "document.body.innerText.toLowerCase().includes('repository protections')"),
        ("/health", "health", "document.body.innerText.toLowerCase().includes('live checks')"),
        ("/audit", "audit", "document.body.innerText.toLowerCase().includes('audit log')"),
    ]
    failures = 0
    for path, label, expression in checks:
        client.navigate(path)
        if not check(client, label, expression):
            failures += 1
        overflow = client.evaluate(
            "document.documentElement.scrollWidth <= window.innerWidth + 2"
        )
        if overflow is not True:
            print(f"{label} overflow: false")
            failures += 1
    if not check_refresh_state(client):
        failures += 1
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
