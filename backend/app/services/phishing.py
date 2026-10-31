from __future__ import annotations

import re
from dataclasses import dataclass
from urllib.parse import urlparse


SUSPICIOUS_TLDS = {"xyz", "top", "click", "gq", "ml", "cf", "tk", "buzz", "work", "rest", "fit"}
SHORTENERS = {"bit.ly", "tinyurl.com", "t.co", "goo.gl", "rb.gy", "ow.ly", "is.gd", "buff.ly"}
BRANDS = {"paypal", "microsoft", "google", "apple", "amazon", "netflix", "facebook", "instagram", "bank", "chase", "wellsfargo", "dropbox", "adobe", "docusign"}


@dataclass
class PhishingResult:
    score: int
    verdict: str
    risk_level: str
    findings: list[dict]
    recommendations: list[str]


def analyze_email_or_url(text: str, url: str | None = None) -> PhishingResult:
    findings = []
    score = 0

    content = (text or "").lower()
    target_url = url or ""

    urls = re.findall(r"https?://[^\s<>\"]+", text or "") + ([target_url] if target_url else [])
    for u in urls:
        try:
            parsed = urlparse(u)
            host = parsed.netloc.lower()
            if any(s in host for s in SHORTENERS):
                findings.append({"type": "url", "severity": "high", "detail": f"URL uses shortening service: {host}"})
                score += 25
            tld = host.split(".")[-1]
            if tld in SUSPICIOUS_TLDS:
                findings.append({"type": "url", "severity": "medium", "detail": f"Suspicious TLD: .{tld}"})
                score += 10
            for b in BRANDS:
                if b in host and not host.endswith(f"{b}.com") and f"{b}." in host:
                    findings.append({"type": "url", "severity": "high", "detail": f"Possible brand impersonation: {host}"})
                    score += 20
            if "@" in host:
                findings.append({"type": "url", "severity": "high", "detail": "URL contains @ (credential obfuscation)"})
                score += 15
            if re.match(r"^\d+\.\d+\.\d+\.\d+$", host.split(":")[0]):
                findings.append({"type": "url", "severity": "high", "detail": "URL uses raw IP address"})
                score += 18
        except Exception:
            pass

    if re.search(r"(urgent|immediate|suspend|verify|password|login|update.*account|click.*now|wire.*transfer|gift.*card)", content):
        findings.append({"type": "text", "severity": "medium", "detail": "Urgency/credential harvesting language detected"})
        score += 12
    if re.search(r"(bank|paypal|microsoft|apple|amazon|irs|dhl|fedex).* (verify|suspend|locked)", content):
        findings.append({"type": "text", "severity": "high", "detail": "Brand + action request (common phishing pattern)"})
        score += 15
    if re.search(r"([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})", content) and urls:
        findings.append({"type": "text", "severity": "low", "detail": "Sender-like email + external link present"})
        score += 5
    if re.search(r"(attachment|\.exe|\.zip|\.html).*click", content):
        findings.append({"type": "attachment", "severity": "high", "detail": "Suspicious attachment reference"})
        score += 16

    score = min(100, score)
    if score >= 70:
        verdict, risk_level = "Likely Phishing", "critical"
    elif score >= 45:
        verdict, risk_level = "Suspicious", "high"
    elif score >= 25:
        verdict, risk_level = "Caution Advised", "medium"
    else:
        verdict, risk_level = "Low Risk", "low"

    recommendations = []
    if score >= 25:
        recommendations.append("Do not click links or download attachments from this message")
        recommendations.append("Verify directly via official website/app (never via the message)")
    if score >= 45:
        recommendations.append("Report as phishing to your email provider/security team")
        recommendations.append("Check login activity if credentials were entered")
    if not findings:
        recommendations.append("No obvious phishing indicators found, but remain cautious")

    return PhishingResult(score=score, verdict=verdict, risk_level=risk_level, findings=findings, recommendations=recommendations)
