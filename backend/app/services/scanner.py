"""Static analysis rules ported from the original frontend scanner.

Each rule runs once per file (the first match wins), mirroring the behaviour
of ``src/lib/scanner.ts`` so results stay consistent across the UI and API.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Iterable

SEVERITY_WEIGHT = {"critical": 5, "high": 4, "medium": 3, "low": 2, "info": 1}
SEVERITY_POINTS = {"critical": 30, "high": 17, "medium": 8, "low": 3, "info": 1}


@dataclass(frozen=True)
class Rule:
    id: str
    title: str
    severity: str
    category: str
    cwe: str
    description: str
    impact: str
    fix: str
    tags: tuple[str, ...]
    confidence: int
    patterns: tuple[str, ...]
    flags: int = 0

    def match(self, code: str) -> re.Match[str] | None:
        for pattern in self.patterns:
            found = re.search(pattern, code, self.flags)
            if found:
                return found
        return None


@dataclass
class FindingResult:
    rule_id: str
    title: str
    severity: str
    category: str
    cwe: str
    file_path: str
    line: int
    snippet: str
    description: str
    impact: str
    fix: str
    confidence: int
    tags: list[str] = field(default_factory=list)

    def as_dict(self) -> dict:
        return {
            "rule_id": self.rule_id,
            "title": self.title,
            "severity": self.severity,
            "category": self.category,
            "cwe": self.cwe,
            "file_path": self.file_path,
            "line": self.line,
            "snippet": self.snippet,
            "description": self.description,
            "impact": self.impact,
            "fix": self.fix,
            "confidence": self.confidence,
            "tags": list(self.tags),
        }


RULES: tuple[Rule, ...] = (
    Rule(
        id="rce-eval",
        title="Dynamic code execution via eval()",
        severity="critical",
        category="Injection",
        cwe="CWE-95",
        description=(
            "User-controllable data reaches eval(), allowing arbitrary JavaScript to run "
            "inside the application context."
        ),
        impact=(
            "Full remote code execution in the Node process. An attacker can read secrets, "
            "pivot to internal services, or establish persistence."
        ),
        fix=(
            "Remove eval(). Parse data with JSON.parse or use an allow-listed "
            "command/template dispatcher instead."
        ),
        tags=("rce", "javascript", "taint"),
        confidence=96,
        patterns=(r"\beval\s*\(",),
    ),
    Rule(
        id="cmd-exec",
        title="OS command injection through exec()",
        severity="critical",
        category="Injection",
        cwe="CWE-78",
        description=(
            "A shell command is assembled from request-controlled input and passed to exec(), "
            "which invokes a system shell."
        ),
        impact=(
            "Remote command execution as the application user. Chained shell metacharacters "
            "can exfiltrate data or open a reverse shell."
        ),
        fix=(
            "Use execFile/spawn with an argument array and validate the host against a strict "
            "allow-list. Never interpolate input into a shell string."
        ),
        tags=("rce", "shell", "node"),
        confidence=94,
        patterns=(
            r"""\b(?:exec|execSync)\s*\(\s*[`"'][^`"']*(?:\+|\$\{)""",
            r"\bexec\s*\(\s*[a-zA-Z_$]",
        ),
    ),
    Rule(
        id="cmd-shell-true",
        title="Shell execution enabled (shell=True)",
        severity="critical",
        category="Injection",
        cwe="CWE-78",
        description=(
            "A subprocess is spawned with shell interpretation enabled, so metacharacters in "
            "any tainted argument are executed."
        ),
        impact=(
            "Command injection when arguments include user input. Could lead to complete host "
            "compromise."
        ),
        fix=(
            "Pass a list of arguments and keep shell=False. Validate every argument with an "
            "allow-list."
        ),
        tags=("rce", "shell", "python"),
        confidence=90,
        patterns=(r"subprocess\.[a-z]+\([^)]*shell\s*=\s*True",),
        flags=re.IGNORECASE,
    ),
    Rule(
        id="sqli-concat",
        title="SQL injection via string concatenation",
        severity="critical",
        category="Injection",
        cwe="CWE-89",
        description=(
            "A SQL statement is built by concatenating request input. The value is interpreted "
            "as SQL syntax instead of data."
        ),
        impact=(
            "Authentication bypass, bulk data exfiltration, and in some configurations "
            "arbitrary file read or write."
        ),
        fix=(
            "Use parameterised queries or an ORM binding layer. Never concatenate untrusted "
            "values into SQL text."
        ),
        tags=("sqli", "database", "taint"),
        confidence=93,
        patterns=(r"(?:SELECT|INSERT|UPDATE|DELETE)[^;\n]*(?:\+\s*[a-zA-Z_$]|\$\{[^}]+\})",),
        flags=re.IGNORECASE,
    ),
    Rule(
        id="xss-innerhtml",
        title="DOM XSS via innerHTML sink",
        severity="high",
        category="Cross-Site Scripting",
        cwe="CWE-79",
        description=(
            "Request data is written directly into innerHTML. Markup supplied by an attacker is "
            "parsed and executed by the browser."
        ),
        impact=(
            "Session token theft, credential phishing, CSRF bypass, and malicious actions "
            "performed as the victim."
        ),
        fix=(
            "Assign untrusted values with textContent, or sanitise with a vetted library such "
            "as DOMPurify before rendering."
        ),
        tags=("xss", "browser", "dom"),
        confidence=92,
        patterns=(r"\.innerHTML\s*=\s*[^;]*",),
    ),
    Rule(
        id="xss-dangerous",
        title="Unsanitised markup in dangerouslySetInnerHTML",
        severity="high",
        category="Cross-Site Scripting",
        cwe="CWE-79",
        description=(
            "Raw HTML is injected into the React tree, bypassing the escaping guarantees of JSX."
        ),
        impact=(
            "Stored or reflected XSS depending on the source of the HTML. Can compromise every "
            "user who views the page."
        ),
        fix=(
            "Render structured data as JSX. If raw HTML is unavoidable, sanitise it with "
            "DOMPurify first."
        ),
        tags=("xss", "react", "dom"),
        confidence=89,
        patterns=(r"dangerouslySetInnerHTML",),
    ),
    Rule(
        id="hardcoded-secret",
        title="Hard-coded credential in source",
        severity="high",
        category="Secrets",
        cwe="CWE-798",
        description=(
            "A long-lived secret is committed directly in source code. Anyone with repository "
            "access can retrieve and reuse it."
        ),
        impact=(
            "Unauthorised API access, data access, and cloud resource abuse. Rotation is "
            "required once exposed."
        ),
        fix=(
            "Revoke the exposed key, load credentials from a secret manager or environment "
            "variable, and add a pre-commit secret scanner."
        ),
        tags=("secrets", "credentials", "supply-chain"),
        confidence=97,
        patterns=(r"""(?:password|secret|api[_-]?key|token)\s*[:=]\s*["'][^"'\s]{8,}["']""",),
        flags=re.IGNORECASE,
    ),
    Rule(
        id="weak-hash",
        title="Weak cryptographic hash (MD5 / SHA-1)",
        severity="medium",
        category="Cryptography",
        cwe="CWE-328",
        description=(
            "MD5 or SHA-1 is used to protect data. Both algorithms have practical collision "
            "attacks and are unsuitable for security use."
        ),
        impact=(
            "Forged signatures, password cracking, and integrity bypass. Attackers can produce "
            "colliding artefacts."
        ),
        fix=(
            "Use SHA-256 or BLAKE3 for integrity, and Argon2id or bcrypt for password storage."
        ),
        tags=("crypto", "hashing"),
        confidence=88,
        patterns=(r"""createHash\s*\(\s*["'](?:md5|sha1)["']|hashlib\.(?:md5|sha1)\s*\(""",),
        flags=re.IGNORECASE,
    ),
    Rule(
        id="insecure-random",
        title="Insecure randomness for a security token",
        severity="medium",
        category="Cryptography",
        cwe="CWE-338",
        description=(
            "Math.random() is not cryptographically secure. Its output can be predicted after "
            "observing a small number of values."
        ),
        impact=(
            "Session or reset tokens can be guessed, allowing account takeover and "
            "authorisation bypass."
        ),
        fix=(
            "Use crypto.randomUUID() or crypto.getRandomValues() for anything "
            "security-sensitive."
        ),
        tags=("crypto", "randomness", "tokens"),
        confidence=85,
        patterns=(r"Math\.random\s*\(",),
    ),
    Rule(
        id="tls-verify-off",
        title="TLS certificate verification disabled",
        severity="high",
        category="Transport",
        cwe="CWE-295",
        description=(
            "Certificate validation is explicitly turned off, so the client accepts any "
            "certificate presented by the server."
        ),
        impact="Trivial man-in-the-middle interception of credentials, tokens, and response data.",
        fix=(
            "Remove the insecure flag and trust the system CA store. Pin a CA bundle in "
            "constrained environments."
        ),
        tags=("tls", "mitm", "network"),
        confidence=94,
        patterns=(
            r"verify\s*=\s*False|rejectUnauthorized\s*:\s*false|InsecureSkipVerify\s*:\s*true",
        ),
        flags=re.IGNORECASE,
    ),
    Rule(
        id="unsafe-deser",
        title="Unsafe deserialisation via pickle.loads()",
        severity="critical",
        category="Deserialisation",
        cwe="CWE-502",
        description=(
            "pickle can execute arbitrary code while reconstructing an object. Loading "
            "untrusted bytes is equivalent to running untrusted code."
        ),
        impact=(
            "Arbitrary code execution on the server with the privileges of the application "
            "process."
        ),
        fix=(
            "Use JSON or a schema-validated format for untrusted input. If pickle is mandatory, "
            "enforce HMAC signing and a trusted source."
        ),
        tags=("deserialisation", "rce", "python"),
        confidence=91,
        patterns=(r"pickle\.loads?\s*\(",),
    ),
    Rule(
        id="ssti",
        title="Server-side template injection",
        severity="high",
        category="Injection",
        cwe="CWE-1336",
        description=(
            "User input is rendered through render_template_string(), giving the template "
            "engine control over the payload."
        ),
        impact=(
            "Template expression execution that often escalates to remote code execution "
            "through language built-ins."
        ),
        fix=(
            "Render fixed templates and pass user content as context variables. Never build "
            "templates from request data."
        ),
        tags=("ssti", "template", "python"),
        confidence=87,
        patterns=(r"render_template_string\s*\(",),
    ),
    Rule(
        id="cors-wildcard",
        title="Permissive CORS origin policy",
        severity="low",
        category="Configuration",
        cwe="CWE-942",
        description=(
            "Access-Control-Allow-Origin is set to a wildcard alongside credentialed requests."
        ),
        impact=(
            "Malicious sites can read authenticated responses, weakening the same-origin "
            "boundary."
        ),
        fix=(
            "Reflect only allow-listed origins and set Vary: Origin. Avoid wildcard origins on "
            "authenticated endpoints."
        ),
        tags=("cors", "browser", "config"),
        confidence=78,
        patterns=(r"""access-control-allow-origin["']?\s*[:,]\s*["']\*""",),
        flags=re.IGNORECASE,
    ),
    Rule(
        id="cleartext-http",
        title="Cleartext HTTP transport",
        severity="low",
        category="Transport",
        cwe="CWE-319",
        description=(
            "A request is made over plain HTTP. Traffic can be read or modified by any hop on "
            "the network path."
        ),
        impact="Credential and data exposure on untrusted networks; response tampering.",
        fix=(
            "Use HTTPS for every external request and enable HSTS on services you operate."
        ),
        tags=("http", "network"),
        confidence=82,
        patterns=(r"""(?:fetch|axios|http\.get)\s*\(\s*["'`]http://""",),
        flags=re.IGNORECASE,
    ),
    Rule(
        id="debug-true",
        title="Debug mode enabled in production code",
        severity="medium",
        category="Configuration",
        cwe="CWE-489",
        description=(
            "A debug flag is hard-coded on, which can expose stack traces, configuration, and "
            "interactive consoles."
        ),
        impact="Information disclosure that accelerates further attacks against the service.",
        fix="Drive debug behaviour from the environment and default it to false in production.",
        tags=("config", "disclosure"),
        confidence=76,
        patterns=(r"\bDEBUG\s*=\s*True|\bdebug\s*:\s*true",),
        flags=re.IGNORECASE,
    ),
)

RULES_BY_ID = {rule.id: rule for rule in RULES}


def _line_at(code: str, index: int) -> int:
    return code.count("\n", 0, index) + 1


def analyze_code(code: str, file_path: str = "snippet") -> list[FindingResult]:
    findings: list[FindingResult] = []
    if not code:
        return findings

    lines = code.splitlines()
    for rule in RULES:
        match = rule.match(code)
        if not match:
            continue
        line = _line_at(code, match.start())
        snippet = lines[line - 1].strip()[:160] if line - 1 < len(lines) else match.group(0)[:160]
        findings.append(
            FindingResult(
                rule_id=rule.id,
                title=rule.title,
                severity=rule.severity,
                category=rule.category,
                cwe=rule.cwe,
                file_path=file_path,
                line=line,
                snippet=snippet,
                description=rule.description,
                impact=rule.impact,
                fix=rule.fix,
                confidence=rule.confidence,
                tags=list(rule.tags),
            )
        )

    findings.sort(key=lambda item: SEVERITY_WEIGHT.get(item.severity, 0), reverse=True)
    return findings


def analyze_files(files: Iterable[tuple[str, str]]) -> list[FindingResult]:
    results: list[FindingResult] = []
    for path, content in files:
        results.extend(analyze_code(content, path))
    results.sort(key=lambda item: SEVERITY_WEIGHT.get(item.severity, 0), reverse=True)
    return results


def risk_score(findings: Iterable[FindingResult | dict]) -> int:
    total = 0.0
    for finding in findings:
        severity = finding.severity if isinstance(finding, FindingResult) else finding["severity"]
        confidence = (
            finding.confidence if isinstance(finding, FindingResult) else finding["confidence"]
        )
        total += SEVERITY_POINTS.get(severity, 0) * (confidence / 100)
    return min(99, round(total))


def grade_for(score: int) -> dict[str, str]:
    if score >= 85:
        return {"grade": "F", "label": "Critical exposure", "tone": "critical"}
    if score >= 65:
        return {"grade": "D", "label": "High exposure", "tone": "high"}
    if score >= 45:
        return {"grade": "C", "label": "Elevated risk", "tone": "medium"}
    if score >= 20:
        return {"grade": "B", "label": "Moderate risk", "tone": "low"}
    return {"grade": "A", "label": "Hardened", "tone": "low"}


SAMPLE_CODE = """import express from "express";
import { exec } from "child_process";
import crypto from "crypto";

const app = express();
const STRIPE_KEY = "sk_test_demo_replaced";
const db = require("./db");

app.get("/user", (req, res) => {
  const query = "SELECT * FROM users WHERE id = " + req.query.id;

  db.query(query, (err, rows) => {
    document.getElementById("profile").innerHTML = rows[0].bio;
    res.send(rows[0]);
  });
});

app.get("/ping", (req, res) => {
  exec("ping -c 1 " + req.query.host, (err, stdout) => {
    res.send(stdout);
  });
});

app.post("/token", (req, res) => {
  const resetToken = Math.random().toString(36).slice(2);
  const digest = crypto.createHash("md5").update(resetToken).digest("hex");
  res.json({ resetToken, digest });
});
"""
