import logging

from ai_triage import IntentEnum, analyze_transcript
from db import build_call_record, write_call_record

logger = logging.getLogger(__name__)
DEMO_CHERT_LINK = "https://app.trychert.com/agent/hacklanta-demo"


def process_incoming_call(
    call_id: str,
    caller_phone: str,
    transcript: str,
    caregiver_phone: str = "+15559876543",
    confidence: float | None = None,
    passphrase_verified: bool = False,
) -> dict:
    fallback_triage = {
        "intent": "Other",
        "sentiment": "Neutral",
        "gemini_summary": "AI triage was unavailable; the transcript could not be classified.",
        "urgency": "Medium",
    }

    try:
        triage_data = analyze_transcript(transcript)
    except Exception:
        logger.exception("AI triage failed for call %s; using fallback data", call_id)
        triage_data = fallback_triage

    is_hardware = triage_data["intent"] == IntentEnum.HARDWARE.value
    chert_link = DEMO_CHERT_LINK if is_hardware else None
    status = "awaiting_caregiver" if passphrase_verified else "authenticating"

    payload = build_call_record(
        triage_data, caller_phone, caregiver_phone,
        confidence=confidence, chert_link=chert_link, status=status,
    )
    try:
            write_call_record(call_id, payload) 
    except Exception:
            logger.exception("Could not save call %s", call_id)
            raise
    return payload

