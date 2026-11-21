from __future__ import annotations

import json
from datetime import date
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import new_id
from app.models import Vulnerability

SEED_PATH = Path(__file__).resolve().parents[2] / "seed" / "frontend-data.json"


def sync_intel(db: Session) -> int:
    if not SEED_PATH.exists():
        return 0
    payload = json.loads(SEED_PATH.read_text(encoding="utf-8"))
    rows = payload.get("vulnerabilities", [])
    created = 0
    for row in rows:
        cve = str(row.get("cve", "")).strip().upper()
        if not cve:
            continue
        vulnerability = db.scalar(select(Vulnerability).where(Vulnerability.cve == cve))
        if vulnerability is None:
            vulnerability = Vulnerability(id=new_id(), cve=cve)
            db.add(vulnerability)
            created += 1
        published = row.get("published")
        vulnerability.title = str(row.get("title", cve))
        vulnerability.summary = str(row.get("summary", ""))
        vulnerability.severity = str(row.get("severity", "medium"))
        vulnerability.cvss = float(row.get("cvss", 0) or 0)
        vulnerability.epss = float(row.get("epss", 0) or 0)
        vulnerability.exploited = bool(row.get("exploited", False))
        vulnerability.published = date.fromisoformat(published) if published else None
        vulnerability.ecosystem = str(row.get("ecosystem", ""))
        vulnerability.package = str(row.get("package", ""))
        vulnerability.affected = str(row.get("affected", ""))
        vulnerability.fix_version = str(row.get("fixVersion", ""))
        vulnerability.tags = list(row.get("tags", []))
        vulnerability.cwe = str(row.get("cwe", ""))
    db.commit()
    return created
