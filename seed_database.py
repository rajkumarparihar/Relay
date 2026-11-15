from db import build_call_record, write_active_calls

# Define the exact mock data from the schema
mock_data = {
    "call_id_123456789": build_call_record(
        {
            "intent": "Hardware Problem",
            "sentiment": "Frustrated",
            "urgency": "High",
            "gemini_summary": (
                "Mom's internet box is blinking red and she cannot connect "
                "to the Wi-Fi."
            ),
        },
        caller_phone="+12025550100",
        caregiver_phone="+12025550101",
        confidence=0.94,
        chert_link="https://app.trychert.com/agent/xyz123",
        status="awaiting_caregiver",
        senior_name="Demo caller",
    ),
}

# Target the 'active_calls' node and pushes the data
write_active_calls(mock_data)

print("Mock data successfully seeded to Firebase!")