import os
import google.genai as genai
from pydantic import BaseModel
from enum import Enum

class IntentEnum(str, Enum):
    HARDWARE = "Hardware Problem"
    NETWORK = "Network Connection Issue"
    ACCOUNT = "Account Access Issue"
    BILLING = "Billing Question"
    OUTAGE = "Service Disruption"
    OTHER = "Other"

class UrgencyEnum(str, Enum):
    CRITICAL = "Critical"
    HIGH = "High"
    MEDIUM = "Medium"
    LOW = "Low"

class SentimentEnum(str, Enum):
    CALM = "Calm"
    NEUTRAL = "Neutral"
    FRUSTRATED = "Frustrated"
    ANXIOUS = "Anxious"
    DISTRESSED = "Distressed"

class TriageResult(BaseModel):
    intent: IntentEnum
    sentiment: SentimentEnum
    gemini_summary: str
    urgency: UrgencyEnum

SYSTEM_PROMPT = (
    "You are an emergency triage assistant. Summarize the issue in 1-2 sentences. "
    "Use 'Hardware Problem' only when the caller describes a physical device malfunction (won't power on, alarms, flashing lights, broken parts). If the caller only reports lost or unstable connectivity, use 'Network Connection Issue' even if they mention a modem or router. "
    "If the caller reports multiple issues, choose the one involving a safety risk or a physical device first, then loss of service, then billing. "
    "Set urgency to Critical if there is any risk to someone's health or safety, including medical equipment failures. "
    "If the issue is unclear, use intent 'Other' and say in the summary what is unclear.\nDo not make guesses about missing details. "
    "Always write the summary in English."
)

client: genai.Client | None = None

def analyze_transcript(transcript: str) -> dict:
    """Takes a raw string from Twilio and returns a structured dictionary."""

    global client
    active_client = client
    if active_client is None:
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY must be set")
        active_client = genai.Client(api_key=api_key)
        client = active_client

    # We use flash because speed is critical for phone routing
    response = active_client.models.generate_content(
        model='gemini-3.5-flash-lite',
        contents=transcript,
        config=genai.types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            response_mime_type="application/json",
            response_schema=TriageResult,
            temperature=0,
        )
    )
    
    # Parse the TriageResult instance into a Python dictionary
    parsed = response.parsed

    # Accounts for dicts, Enums, or None
    if not isinstance(parsed, TriageResult):
        raise ValueError(f"Could not parse model output: {response.text}")
    
    return parsed.model_dump(mode="json")