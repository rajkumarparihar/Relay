from time import time
import firebase_admin
from firebase_admin import credentials

cred = credentials.Certificate("firebase-adminsdk.json")
firebase_admin.initialize_app(cred)

SENIOR_NAMES = {
    "+15551234567": "Arthur Pendelton (Dad)",
    "+15559876543": "Jane Doe (Caregiver)",
}

def build_call_record(triage: dict, caller_phone: str, caregiver_phone: str,
                      confidence: float | None, chert_link: str | None) -> dict:
    return {
        "metadata": {
            "caller_phone": caller_phone,
            "caregiver_phone": caregiver_phone,
            "senior_name": SENIOR_NAMES.get(caller_phone, "Unknown"),
            "company": "Comcast Support",
            "timestamp": int(time()),
            "status": "awaiting_caregiver",
        },
        "ai_triage": {
            "intent": str(getattr(triage["intent"], "value", triage["intent"])),
            "sentiment": str(getattr(triage["sentiment"], "value", triage["sentiment"])),
            "gemini_summary": triage["gemini_summary"],
            "confidence": confidence,
        },
        "visual_diagnostic": {
            "requires_visual": chert_link is not None,
            "chert_link": chert_link,
            "chert_status": "pending" if chert_link else None,
        },
    }