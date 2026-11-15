import json
import os
import unittest
from unittest.mock import Mock, patch

from twilio.request_validator import RequestValidator

import app as relay_app
import main_processor
import db
from db import build_call_record


CALLER_PHONE = "+12025550100"
CAREGIVER_PHONE = "+12025550101"
CALL_ID = "CA1234567890abcdef1234567890abcdef"
AUTH_TOKEN = "test-auth-token"


class RelayVoiceWebhookTests(unittest.TestCase):
    def setUp(self):
        self.environment = patch.dict(
            os.environ,
            {
                "TWILIO_AUTH_TOKEN": AUTH_TOKEN,
                "TWILIO_ACCOUNT_SID": "test-account-sid",
                "TWILIO_PHONE_NUMBER": "+12025550102",
                "RELAY_DEMO_MODE": "0",
                "RELAY_SKIP_TWILIO_VALIDATION": "0",
                "RELAY_CALLERS_JSON": json.dumps(
                    {
                        CALLER_PHONE: {
                            "passphrase": "silver moon",
                            "caregiver_phone": CAREGIVER_PHONE,
                            "senior_name": "Test Senior",
                        }
                    }
                ),
            },
        )
        self.environment.start()
        self.addCleanup(self.environment.stop)
        relay_app.app.config["TESTING"] = True
        relay_app._skip_validation_warning_logged = False
        self.client = relay_app.app.test_client()

    def test_record_omits_phone_numbers_and_defaults_missing_name(self):
        record = build_call_record(
            triage={
                "intent": "Other",
                "sentiment": "Neutral",
                "urgency": "Low",
                "gemini_summary": "Test issue",
            },
            caller_phone=CALLER_PHONE,
            caregiver_phone=CAREGIVER_PHONE,
            confidence=None,
            chert_link=None,
        )

        self.assertEqual(record["metadata"]["senior_name"], "Unknown caller")
        self.assertNotIn("caller_phone", record["metadata"])
        self.assertNotIn("caregiver_phone", record["metadata"])

    @patch("db.firebase_db.reference")
    @patch("db._get_firebase_app")
    def test_write_clears_legacy_phone_metadata(self, get_firebase_app, reference):
        record_ref = Mock()
        reference.return_value = record_ref

        db.write_call_record("test-call", {"metadata": {}, "ai_triage": {}, "visual_diagnostic": {}})

        updates = record_ref.update.call_args.args[0]
        self.assertIsNone(updates["metadata/caller_phone"])
        self.assertIsNone(updates["metadata/caregiver_phone"])
        reference.assert_called_once_with("active_calls/test-call", app=get_firebase_app.return_value)

    def signed_post(self, path, data):
        url = f"http://localhost{path}"
        signature = RequestValidator(AUTH_TOKEN).compute_signature(url, data)
        return self.client.post(
            path,
            data=data,
            headers={"X-Twilio-Signature": signature},
        )

    def test_incoming_call_gathers_passphrase_with_hints(self):
        response = self.signed_post(
            "/incoming-call",
            {"CallSid": CALL_ID, "From": CALLER_PHONE},
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn(b"<Gather", response.data)
        self.assertIn(b'hints="silver moon"', response.data)
        self.assertIn(b"actiononemptyresult", response.data.lower())

    @patch("app.Client")
    @patch("app.process_incoming_call")
    def test_wrong_passphrase_retries_and_ends_after_two_retries(
        self,
        process_incoming_call,
        twilio_client,
    ):
        first_retry = self.signed_post(
            "/verify-passphrase?attempt=0",
            {"CallSid": CALL_ID, "From": CALLER_PHONE, "SpeechResult": "not it"},
        )
        self.assertIn(b"/incoming-call?attempt=1", first_retry.data)

        second_retry = self.signed_post(
            "/verify-passphrase?attempt=1",
            {"CallSid": CALL_ID, "From": CALLER_PHONE, "SpeechResult": "still wrong"},
        )
        self.assertIn(b"/incoming-call?attempt=2", second_retry.data)

        ended = self.signed_post(
            "/verify-passphrase?attempt=2",
            {"CallSid": CALL_ID, "From": CALLER_PHONE, "SpeechResult": "wrong again"},
        )
        self.assertIn(b"<Hangup", ended.data)
        self.assertNotIn(b"/process-audio", ended.data)
        process_incoming_call.assert_not_called()
        twilio_client.assert_not_called()

    @patch("app.Client")
    @patch("app.process_incoming_call")
    def test_empty_passphrase_result_redirects_or_ends_at_retry_limit(
        self,
        process_incoming_call,
        twilio_client,
    ):
        retry = self.signed_post(
            "/verify-passphrase?attempt=0",
            {"CallSid": CALL_ID, "From": CALLER_PHONE},
        )
        self.assertIn(b"/incoming-call?attempt=1", retry.data)

        ended = self.signed_post(
            "/verify-passphrase?attempt=2",
            {"CallSid": CALL_ID, "From": CALLER_PHONE},
        )
        self.assertIn(b"<Hangup", ended.data)
        process_incoming_call.assert_not_called()
        twilio_client.assert_not_called()

    def test_normalized_passphrase_advances_to_issue_gather(self):
        response = self.signed_post(
            "/verify-passphrase?attempt=0",
            {
                "CallSid": CALL_ID,
                "From": CALLER_PHONE,
                "SpeechResult": "SILVER, moon!",
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn(b'action="/process-audio"', response.data)
        self.assertIn(b"describe the issue", response.data)

    @patch("app.Client")
    @patch("main_processor.write_call_record")
    @patch("main_processor.analyze_transcript")
    def test_process_audio_writes_record_then_sends_caregiver_sms(
        self,
        analyze_transcript,
        write_call_record,
        twilio_client,
    ):
        analyze_transcript.return_value = {
            "intent": "Other",
            "sentiment": "Neutral",
            "urgency": "Low",
            "gemini_summary": "Caller needs help.",
        }

        response = self.signed_post(
            "/process-audio",
            {
                "CallSid": CALL_ID,
                "From": CALLER_PHONE,
                "SpeechResult": "My internet stopped working.",
                "Confidence": "0.91",
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn(b"Your caregiver has been notified", response.data)
        analyze_transcript.assert_called_once_with("My internet stopped working.")
        write_call_record.assert_called_once()
        saved_record = write_call_record.call_args.args[1]
        self.assertEqual(saved_record["metadata"]["status"], "awaiting_caregiver")
        self.assertEqual(saved_record["metadata"]["senior_name"], "Test Senior")
        self.assertNotIn("caller_phone", saved_record["metadata"])
        self.assertNotIn("caregiver_phone", saved_record["metadata"])
        self.assertNotIn("passphrase", json.dumps(saved_record).lower())
        twilio_client.return_value.messages.create.assert_called_once()
        sms = twilio_client.return_value.messages.create.call_args.kwargs
        self.assertEqual(sms["to"], CAREGIVER_PHONE)
        self.assertEqual(sms["from_"], "+12025550102")
        self.assertIn(f"https://youcanrelayon.us/call/{CALL_ID}", sms["body"])

    @patch("app.Client")
    @patch("main_processor.write_call_record", side_effect=RuntimeError("database unavailable"))
    @patch("main_processor.analyze_transcript")
    def test_firebase_failure_hangs_up_without_sending_sms(
        self,
        analyze_transcript,
        write_call_record,
        twilio_client,
    ):
        analyze_transcript.return_value = {
            "intent": "Other",
            "sentiment": "Neutral",
            "urgency": "Low",
            "gemini_summary": "Caller needs help.",
        }
        with self.assertLogs(relay_app.logger, level="ERROR"):
            with self.assertLogs(main_processor.logger, level="ERROR"):
                response = self.signed_post(
                    "/process-audio",
                    {
                        "CallSid": CALL_ID,
                        "From": CALLER_PHONE,
                        "SpeechResult": "My internet stopped working.",
                    },
                )

        self.assertEqual(response.status_code, 200)
        self.assertIn(b"couldn't process your request", response.data)
        self.assertIn(b"<Hangup", response.data)
        write_call_record.assert_called_once()
        twilio_client.assert_not_called()

    @patch("app.Client")
    @patch("main_processor.write_call_record")
    @patch("main_processor.analyze_transcript")
    def test_sms_failure_returns_apology_after_successful_processing(
        self,
        analyze_transcript,
        write_call_record,
        twilio_client,
    ):
        analyze_transcript.return_value = {
            "intent": "Other",
            "sentiment": "Neutral",
            "urgency": "Low",
            "gemini_summary": "Caller needs help.",
        }
        twilio_client.return_value.messages.create.side_effect = RuntimeError(
            "SMS unavailable"
        )

        with self.assertLogs(relay_app.logger, level="ERROR"):
            response = self.signed_post(
                "/process-audio",
                {
                    "CallSid": CALL_ID,
                    "From": CALLER_PHONE,
                    "SpeechResult": "My internet stopped working.",
                },
            )

        self.assertEqual(response.status_code, 200)
        self.assertIn(b"couldn't notify your caregiver", response.data)
        self.assertIn(b"<Hangup", response.data)
        write_call_record.assert_called_once()
        twilio_client.return_value.messages.create.assert_called_once()

    @patch("app.Client")
    @patch("main_processor.write_call_record")
    @patch("main_processor.analyze_transcript", side_effect=TimeoutError("Gemini timeout"))
    def test_gemini_timeout_uses_processor_fallback(
        self,
        analyze_transcript,
        write_call_record,
        twilio_client,
    ):
        with self.assertLogs(main_processor.logger, level="ERROR"):
            response = self.signed_post(
                "/process-audio",
                {
                    "CallSid": CALL_ID,
                    "From": CALLER_PHONE,
                    "SpeechResult": "My internet stopped working.",
                },
            )

        self.assertEqual(response.status_code, 200)
        self.assertIn(b"Your caregiver has been notified", response.data)
        saved_record = write_call_record.call_args.args[1]
        self.assertEqual(saved_record["ai_triage"]["intent"], "Other")
        self.assertEqual(saved_record["ai_triage"]["urgency"], "Medium")
        analyze_transcript.assert_called_once()
        twilio_client.return_value.messages.create.assert_called_once()

    def test_unknown_caller_is_rejected_when_demo_mode_is_off(self):
        unknown_caller = "+12025550199"
        response = self.signed_post(
            "/incoming-call",
            {"CallSid": CALL_ID, "From": unknown_caller},
        )

        self.assertIn(b"couldn't find an authorized account", response.data)
        self.assertIn(b"<Hangup", response.data)
        self.assertNotIn(b"<Gather", response.data)

    def test_unknown_caller_uses_demo_values_when_demo_mode_is_on(self):
        unknown_caller = "+12025550199"
        with patch.dict(
            os.environ,
            {
                "RELAY_DEMO_MODE": "1",
                "RELAY_DEMO_PASSPHRASE": "fake test phrase",
                "RELAY_DEMO_CAREGIVER_PHONE": "+12025550103",
                "RELAY_DEMO_SENIOR_NAME": "Demo Test Senior",
            },
        ):
            response = self.signed_post(
                "/incoming-call",
                {"CallSid": CALL_ID, "From": unknown_caller},
            )

        self.assertIn(b"<Gather", response.data)
        self.assertIn(b'hints="fake test phrase"', response.data)

    def test_invalid_twilio_signature_is_rejected(self):
        response = self.client.post(
            "/incoming-call",
            data={"CallSid": CALL_ID, "From": CALLER_PHONE},
            headers={"X-Twilio-Signature": "invalid"},
        )

        self.assertEqual(response.status_code, 403)

    def test_signature_validation_uses_forwarded_https_host(self):
        data = {"CallSid": CALL_ID, "From": CALLER_PHONE}
        public_url = "https://relay.example.test/incoming-call"
        signature = RequestValidator(AUTH_TOKEN).compute_signature(public_url, data)
        response = self.client.post(
            "/incoming-call",
            data=data,
            headers={
                "X-Forwarded-Proto": "https",
                "X-Forwarded-Host": "relay.example.test",
                "X-Twilio-Signature": signature,
            },
        )

        self.assertEqual(response.status_code, 200)

    def test_validation_can_be_skipped_for_local_testing(self):
        with patch.dict(os.environ, {"RELAY_SKIP_TWILIO_VALIDATION": "1"}):
            with self.assertLogs(relay_app.logger, level="CRITICAL"):
                response = self.client.post("/incoming-call", data={"From": CALLER_PHONE})

        self.assertEqual(response.status_code, 200)


if __name__ == "__main__":
    unittest.main()
