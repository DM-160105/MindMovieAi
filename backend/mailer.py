"""
SMTP Email Service.

Sends OTP verification emails via Gmail SMTP (TLS).
Falls back to console logging when credentials are missing.
"""

import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")


def send_otp_email(to_email: str, otp_code: str) -> None:
    """Send an OTP verification email to *to_email*."""
    if not SMTP_USER or not SMTP_PASSWORD:
        print(f"[Mailer] SMTP not configured — mock OTP {otp_code} → {to_email}")
        return

    msg = MIMEMultipart()
    msg["From"] = SMTP_USER
    msg["To"] = to_email
    msg["Subject"] = "Mind Movie AI – Your Verification Code"

    body = (
        f"Welcome to Mind Movie AI!\n\n"
        f"Your OTP confirmation code is: {otp_code}\n\n"
        f"This code will expire in 10 minutes.\n\n"
        f"Enjoy exploring movies!"
    )
    msg.attach(MIMEText(body, "plain"))

    try:
        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT, timeout=10)
        server.starttls()
        server.login(SMTP_USER, SMTP_PASSWORD)
        server.sendmail(SMTP_USER, to_email, msg.as_string())
        server.quit()
        print(f"[Mailer] OTP sent to {to_email}")
    except Exception as exc:
        print(f"[Mailer] Failed to send email to {to_email}: {exc}")
