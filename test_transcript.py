import json
import uuid
from dotenv import load_dotenv

# Load the project's environment variables
load_dotenv("/Users/alaina/Repos/Relay/.env")

from main_processor import process_incoming_call

transcript = (
    "Hello? I just got a text saying my bank account is locked "
    "and I need to click a link right now or I'll lose my money. "
    "I don't know what to do—should I click it?"
)

result = process_incoming_call(
    call_id=f"transcript-demo-{uuid.uuid4().hex[:8]}",
    caller_phone="+12025550100",
    transcript=transcript,
    caregiver_phone="+12025550101",
    confidence=None,
    passphrase_verified=True,
    senior_name="Demo caller",
)

print("\nSuccessfully processed transcript!")
print(json.dumps(result, indent=2, default=str))
