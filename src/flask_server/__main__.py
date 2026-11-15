from flask import Flask
from twilio.twiml.voice_response import VoiceResponse

app = Flask(__name__)

@app.route("/incoming-call", methods=['GET', 'POST'])
def incoming_call():
    """Respond to incoming phone calls."""
    resp = VoiceResponse()
    resp.say("Welcome to Relay. The system is currently authenticating.", voice='Polly.Amy')
    return str(resp)

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=8081)