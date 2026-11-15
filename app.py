import json
import logging
import math
import os
import unicodedata

from dotenv import load_dotenv
from flask import Flask, abort, current_app, make_response, request, url_for
from twilio.request_validator import RequestValidator
from twilio.rest import Client
from twilio.twiml.voice_response import VoiceResponse
from werkzeug.middleware.proxy_fix import ProxyFix

from main_processor import process_incoming_call

load_dotenv()

logger = logging.getLogger(__name__)
app = Flask(__name__)
app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)

MAX_PASSPHRASE_RETRIES = 2
DEMO_CALLERS = {
    "+12025550100": {
        "passphrase": "fake test passphrase",
        "caregiver_phone": "+12025550101",
        "senior_name": "Test-only caller",
    },
}
_skip_validation_warning_logged = False


def _skip_twilio_validation_enabled():
    return os.environ.get("RELAY_SKIP_TWILIO_VALIDATION") == "1"


def _warn_if_validation_is_disabled():
    global _skip_validation_warning_logged
    if _skip_twilio_validation_enabled() and not _skip_validation_warning_logged:
        logger.critical(
            "SECURITY WARNING: Twilio signature validation is disabled. "
            "Never enable this outside local testing."
        )
        _skip_validation_warning_logged = True


_warn_if_validation_is_disabled()


def _twiml_response(response):
    return make_response(str(response), 200, {"Content-Type": "text/xml"})


def _say_and_hang_up(message):
    response = VoiceResponse()
    response.say(message)
    response.hangup()
    return _twiml_response(response)


def _validate_twilio_request():
    auth_token = os.environ.get("TWILIO_AUTH_TOKEN")
    signature = request.headers.get("X-Twilio-Signature", "")
    return bool(
        auth_token
        and signature
        and RequestValidator(auth_token).validate(request.url, request.form, signature)
    )


@app.before_request
def require_valid_twilio_signature():
    _warn_if_validation_is_disabled()
    if _skip_twilio_validation_enabled():
        return
    if not _validate_twilio_request():
        abort(403)


def _get_caller_config(caller_phone):
    configured_callers = os.environ.get("RELAY_CALLERS_JSON")
    if not configured_callers:
        callers = {}
    else:
        try:
            callers = json.loads(configured_callers)
        except json.JSONDecodeError as error:
            raise ValueError("RELAY_CALLERS_JSON must contain a JSON object") from error
        if not isinstance(callers, dict):
            raise ValueError("RELAY_CALLERS_JSON must contain a JSON object")

    if current_app.testing:
        callers = {**DEMO_CALLERS, **callers}

    config = callers.get(caller_phone)
    if config is None and os.environ.get("RELAY_DEMO_MODE") == "1":
        config = {
            "passphrase": os.environ.get("RELAY_DEMO_PASSPHRASE"),
            "caregiver_phone": os.environ.get("RELAY_DEMO_CAREGIVER_PHONE"),
            "senior_name": os.environ.get("RELAY_DEMO_SENIOR_NAME"),
        }
    if not isinstance(config, dict):
        return None

    passphrase = config.get("passphrase")
    caregiver_phone = config.get("caregiver_phone")
    senior_name = config.get("senior_name")
    if not isinstance(passphrase, str) or not passphrase.strip():
        return None
    if not isinstance(caregiver_phone, str) or not caregiver_phone.strip():
        return None
    if not isinstance(senior_name, str) or not senior_name.strip():
        return None
    return {
        "passphrase": passphrase,
        "caregiver_phone": caregiver_phone,
        "senior_name": senior_name,
    }


def _attempt_number():
    try:
        return max(0, int(request.values.get("attempt", "0")))
    except ValueError:
        return 0


def _retry_or_end(response, attempt):
    if attempt >= MAX_PASSPHRASE_RETRIES:
        response.say("I'm sorry, we couldn't verify your passphrase. Goodbye.")
        response.hangup()
    else:
        response.redirect(
            url_for("incoming_call", attempt=attempt + 1),
            method="POST",
        )
    return _twiml_response(response)


def _normalize_passphrase(value):
    normalized = unicodedata.normalize("NFKC", value).casefold()
    without_punctuation = "".join(
        character
        for character in normalized
        if not unicodedata.category(character).startswith("P")
    )
    return " ".join(without_punctuation.split())


@app.post("/incoming-call")
def incoming_call():
    logger.info(
        "Incoming caller number received from Twilio: %s",
        request.form.get("From", "")
    )
    attempt = _attempt_number()
    try:
        caller_config = _get_caller_config(request.form.get("From", ""))
    except ValueError:
        logger.exception("Caller configuration is invalid")
        return _say_and_hang_up("I'm sorry, we can't process your call right now. Goodbye.")

    if caller_config is None:
        return _say_and_hang_up(
            "I'm sorry, we couldn't find an authorized account for this number. Goodbye."
        )

    if attempt > MAX_PASSPHRASE_RETRIES:
        return _say_and_hang_up(
            "I'm sorry, we couldn't verify your passphrase. Goodbye."
        )

    response = VoiceResponse()
    response.say("Welcome to Relay.")
    gather = response.gather(
        input="speech",
        action=url_for("verify_passphrase", attempt=attempt),
        action_on_empty_result=True,
        speech_timeout="auto",
        hints=caller_config["passphrase"],
        method="POST",
    )
    gather.say("Please say your passphrase.")
    return _twiml_response(response)


@app.post("/verify-passphrase")
def verify_passphrase():
    attempt = _attempt_number()
    try:
        caller_config = _get_caller_config(request.form.get("From", ""))
    except ValueError:
        logger.exception("Caller configuration is invalid")
        return _say_and_hang_up("I'm sorry, we can't process your call right now. Goodbye.")

    if caller_config is None:
        return _say_and_hang_up(
            "I'm sorry, we couldn't find an authorized account for this number. Goodbye."
        )

    speech_result = request.form.get("SpeechResult", "")
    if not speech_result.strip():
        return _retry_or_end(VoiceResponse(), attempt)

    if _normalize_passphrase(speech_result) != _normalize_passphrase(
        caller_config["passphrase"]
    ):
        response = VoiceResponse()
        response.say("That passphrase didn't match.")
        return _retry_or_end(response, attempt)

    response = VoiceResponse()
    response.say("Thank you. Please briefly describe the issue you're calling about.")
    gather = response.gather(
        input="speech",
        action=url_for("process_audio"),
        action_on_empty_result=True,
        speech_timeout="auto",
        method="POST",
    )
    gather.say("Please describe the issue now.")
    return _twiml_response(response)


def _send_caregiver_sms(caregiver_phone, call_id):
    account_sid = os.environ.get("TWILIO_ACCOUNT_SID")
    auth_token = os.environ.get("TWILIO_AUTH_TOKEN")
    twilio_phone_number = os.environ.get("TWILIO_PHONE_NUMBER")
    if not account_sid or not auth_token or not twilio_phone_number:
        raise ValueError("Twilio SMS configuration is incomplete")

    client = Client(account_sid, auth_token)
    client.messages.create(
        to=caregiver_phone,
        from_=twilio_phone_number,
        body=f"Relay needs your help with a call. Review it here: "
        f"https://youcanrelayon.us/call/{call_id}",
    )


@app.post("/process-audio")
def process_audio():
    call_id = request.form.get("CallSid", "").strip()
    caller_phone = request.form.get("From", "").strip()
    transcript = request.form.get("SpeechResult", "").strip()
    if not call_id or not caller_phone or not transcript:
        return _say_and_hang_up(
            "I'm sorry, we didn't receive enough information to process your call. Goodbye."
        )

    try:
        caller_config = _get_caller_config(caller_phone)
        if caller_config is None:
            raise ValueError("Caller configuration is unavailable")

        confidence_value = request.form.get("Confidence")
        confidence = None
        if confidence_value:
            try:
                parsed_confidence = float(confidence_value)
                if math.isfinite(parsed_confidence) and 0 <= parsed_confidence <= 1:
                    confidence = parsed_confidence
            except ValueError:
                logger.warning("Twilio provided an invalid confidence score")

        process_incoming_call(
            call_id=call_id,
            caller_phone=caller_phone,
            caregiver_phone=caller_config["caregiver_phone"],
            senior_name=caller_config["senior_name"],
            transcript=transcript,
            confidence=confidence,
            passphrase_verified=True,
        )
    except Exception:
        logger.exception("Could not process call %s", call_id)
        return _say_and_hang_up(
            "I'm sorry, we couldn't process your request right now. Goodbye."
        )

    try:
        _send_caregiver_sms(caller_config["caregiver_phone"], call_id)
    except Exception:
        logger.exception("Could not notify caregiver for call %s", call_id)
        return _say_and_hang_up(
            "I'm sorry, we couldn't notify your caregiver right now. Goodbye."
        )

    response = VoiceResponse()
    response.say("Your caregiver has been notified. Goodbye.")
    response.hangup()
    return _twiml_response(response)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "8081")))
