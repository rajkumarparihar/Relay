from db import build_call_record, write_call_record, update_status

triage = {"intent": "Other", "sentiment": "Neutral", "urgency": "Low",
          "gemini_summary": "Test call"}
record = build_call_record(
    triage,
    "+12025550100",
    "+12025550101",
    None,
    None,
    senior_name="Demo caller",
)

write_call_record("test_call_001", record)
update_status("test_call_001", "awaiting_caregiver")