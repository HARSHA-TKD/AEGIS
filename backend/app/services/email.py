"""Minimal transactional email delivery.

When SMTP is not configured the message is logged so local password reset
flows remain testable without a mail server.
"""

from __future__ import annotations

import logging
import smtplib
from email.message import EmailMessage

from app.core.config import settings

logger = logging.getLogger(__name__)


def send_password_reset(to: str, reset_url: str) -> None:
    if not settings.smtp_host or not settings.smtp_from:
        logger.info("Password reset link for %s: %s", to, reset_url)
        return

    message = EmailMessage()
    message["Subject"] = "Reset your Aegis password"
    message["From"] = settings.smtp_from
    message["To"] = to
    message.set_content(
        "Use the link below to choose a new Aegis password. "
        f"The link expires in {settings.password_reset_expire_minutes} minutes.\n\n{reset_url}"
    )

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as client:
        if settings.smtp_starttls:
            client.starttls()
        if settings.smtp_username and settings.smtp_password:
            client.login(settings.smtp_username, settings.smtp_password)
        client.send_message(message)
