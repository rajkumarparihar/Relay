import os
from time import time

import firebase_admin
from dotenv import load_dotenv
from firebase_admin import credentials
from firebase_admin import db as firebase_db

load_dotenv()

SENIOR_NAMES = {
    "+15551234567": "Arthur Pendelton (Dad)",
}


def build_call_record(triage: dict, caller_phone: str, caregiver_phone: str,
                      confidence: float | None, chert_link: str | None,
                      status: str = "authenticating") -> dict:
    record = {
        "metadata": {
            "caller_phone": caller_phone,
            "caregiver_phone": caregiver_phone,
            "senior_name": SENIOR_NAMES.get(caller_phone, "Unknown"),
            "company": "Comcast Support",
            "timestamp": int(time()),
            "status": status,
        },
        "ai_triage": {
            "intent": str(getattr(triage["intent"], "value", triage["intent"])),
            "sentiment": str(getattr(triage["sentiment"], "value", triage["sentiment"])),
            "urgency": str(getattr(triage["urgency"], "value", triage["urgency"])),
            "gemini_summary": triage["gemini_summary"],
        },
        "visual_diagnostic": {
            "requires_visual": bool(chert_link),
            "chert_link": chert_link or "",
            "chert_status": "pending" if chert_link else "not_required",
        },
    }
    if confidence is not None:
        record["ai_triage"]["confidence"] = confidence
    return record


def _get_firebase_app():
    try:
        return firebase_admin.get_app()
    except ValueError:
        key_path = os.environ.get("FIREBASE_KEY_PATH")
        database_url = os.environ.get("FIREBASE_DB_URL")
        if not key_path:
            raise ValueError("FIREBASE_KEY_PATH must be set")
        if not database_url:
            raise ValueError("FIREBASE_DB_URL must be set")

        credential = credentials.Certificate(key_path)
        return firebase_admin.initialize_app(
            credential,
            {"databaseURL": database_url},
        )


def write_call_record(call_id: str, record: dict) -> None:
    app = _get_firebase_app()
    base = f"active_calls/{call_id}"
    updates = { # Write each metadata field by path so fields Raj added are kept
        "ai_triage": record["ai_triage"],
        "visual_diagnostic": record["visual_diagnostic"],
    }
    for key, value in record["metadata"].items():
        updates[f"metadata/{key}"] = value
    firebase_db.reference(base, app=app).update(updates)


def write_active_calls(records: dict) -> None:
    app = _get_firebase_app()
    firebase_db.reference("active_calls", app=app).update(records)

def update_status(call_id: str, status: str) -> None:
    app = _get_firebase_app()
    firebase_db.reference(f"active_calls/{call_id}/metadata", app=app).update({"status": status})