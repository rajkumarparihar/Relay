import firebase_admin
from firebase_admin import credentials
from firebase_admin import db
import os
from dotenv import load_dotenv

load_dotenv()
cred = credentials.Certificate(os.environ['FIREBASE_KEY_PATH'])
firebase_admin.initialize_app(cred, {
    'databaseURL': os.getenv('FIREBASE_DB_URL')
})

# Defines the exact mock data from the schema
mock_data = {
    "call_id_123456789": {
        "metadata": {
            "caller_phone": "+15551234567",
            "caregiver_phone": "+15559876543",
            "timestamp": 1731563820,
            "status": "awaiting_caregiver" 
        },
        "ai_triage": {
            "intent": "Hardware Problem",
            "sentiment": "Frustrated",
            "gemini_summary": "Mom's internet box is blinking red and she cannot connect to the Wi-Fi."
        },
        "visual_diagnostic": {
            "requires_visual": True,
            "chert_link": "https://app.trychert.com/agent/xyz123",
            "chert_status": "pending"
        }
    }
}

# Targets the 'active_calls' node and pushes the data
ref = db.reference('active_calls')
ref.set(mock_data)

print("Mock data successfully seeded to Firebase!")