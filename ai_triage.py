import os
import json
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

class TriageResult(BaseModel):
    intent: IntentEnum
    sentiment: str
    gemini_summary: str
    urgency: UrgencyEnum

SYSTEM_PROMPT = (
    "You are an emergency triage assistant. Summarize the issue in 1-2 sentences. "
    "For intent, output exactly 'Hardware Problem' if the issue is physical devices/hardware. "
    "Otherwise, categorize in 2-3 words. Output sentiment as a single capitalized word. "
    "If the caller reports multiple issues, choose the one involving a safety risk or a physical device first, then loss of service, then billing."
    "Set urgency to Critical if there is any risk to someone's health or safety, including medical equipment failures. "
    "If the issue is unclear, use intent 'Other' and say in the summary what is unclear.\nDo not make guesses about missing details."
)

client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))

def analyze_transcript(transcript: str) -> dict:
    """Takes a raw string from Twilio and returns a structured dictionary."""
    
    # We use flash because speed is critical for phone routing
    response = client.models.generate_content(
        model='gemini-3.5-flash-lite',
        contents=transcript,
        config=genai.types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            response_mime_type="application/json",
            response_schema=TriageResult
        )
    )
    
    # Parse the TriageResult instance into a Python dictionary
    parsed = response.parsed

    # Accounts for dicts, Enums, or None
    if not isinstance(parsed, TriageResult):
        raise ValueError(f"Could not parse mdoel output: {response.text}")
    
    return parsed.model_dump()