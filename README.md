# Relay
## Inspiration

As enterprise services shift entirely to automated chatbots and Interactive Voice Response (IVR) systems, customer support assumes every caller has a baseline level of technical literacy. We realized this creates a massive digital divide for elderly individuals. When a senior forgets a 16-digit account number or struggles with two factor authentication, standard call centers offer no graceful exit. The robotic IVR loops become a trap.

If a tech-savvy family member tries to intervene, strict privacy policies force them into a frustrating, synchronous three-way phone call just to pass live verbal consent checks. We built "Relay" to act as the "Ctrl+Alt+Delete" for these unhelpful systems. By bridging the gap between enterprise telecommunications and family support, we wanted to prove that accessibility does not mean forcing vulnerable users to learn complex tech, it means building tech that adapts to them.

## What it does

Relay is a B2B telecom proxy system that instantly delegates complex technical troubleshooting from elderly callers to pre-authorized family members via a secure SMS out-of-band handoff.

When a registered senior dials support, Relay bypasses the frustrating IVR menu. Instead, it asks them to state their problem. The system processes their speech, automatically generates a triage summary, and sends an authorization link to their trusted caregiver's phone.

If the senior is struggling with a physical device (like a blinking internet router), Relay can instantly dispatch an AI FaceTime agent to look at the hardware through the senior's camera. The caregiver opens their mobile dashboard, reads the AI briefing, reviews the visual hardware diagnostics, and resolves the issue on their own time without ever sitting on hold.

## How we built it

To build a highly responsive, real-time prototype in 24 hours, Team Ctrl+Alt+RAJ utilized a multi-modal, AI-driven stack, perfectly integrating three Emory Hacks sponsor technologies:

Telecom Routing (The Engine): We used Twilio Voice & SMS APIs to intercept incoming calls, process voice passphrases via TwiML, and dispatch the out-of-band text messages. A Python (Flask) server handles the webhook routing, exposed to the public internet via Ngrok.

AI Triage (Google Gemini API): We integrated the Gemini 1.5 Flash API to act as our NLP supercomputer. It ingests the raw Twilio speech-to-text transcripts and extracts the caller's underlying intent (e.g., "Billing Issue") and emotional sentiment (e.g., "Frustrated"), translating a rambling phone call into a concise, 1-sentence briefing for the caregiver.

Visual Diagnostics (Chert × EmoryHacks): We integrated the Chert FaceTime AI. If Gemini detects a hardware issue, Relay texts the senior a FaceTime link. The Chert AI visually inspects the blinking lights on the device and syncs that diagnostic data to the backend.

State Management & Frontend UI: We used Firebase Realtime Database to instantly sync the backend call state, Gemini summaries, and Chert visual data to our frontend without page refreshes. The Caregiver Dashboard was built with React and Tailwind CSS for a polished, mobile-first enterprise UI.

Production Deployment (GoDaddy Registry): To ensure our caregiver SMS links looked trustworthy and professional, we deployed the React frontend to a custom domain secured through the GoDaddy Registry.

## Challenges we ran into

Building a telecom pipeline in 24 hours is notoriously difficult. Our backend lead (Raj) initially struggled with Twilio webhook latency and routing dropped calls through the Ngrok tunnel. We had to heavily optimize our Flask routes to respond with TwiML before Twilio timed out.

Our AI integration lead (Alaina) faced challenges wrangling the generative AI outputs. Initially, the Gemini API returned conversational text, which crashed our frontend state. We overcame this by heavily engineering the system prompt to force Gemini to return a strict, minified JSON object containing only the intent, sentiment, and summary strings, which we could instantly write to Firebase.

Finally, our frontend lead (J'adore) had to ensure the React dashboard perfectly synced with the Firebase state in real-time, requiring complex useEffect hooks to handle the state transitions from "Authenticating" to "Awaiting Caregiver" to displaying the dynamic Chert FaceTime link.

## Accomplishments that we're proud of

We are incredibly proud of successfully engineering an Out-of-Band Authentication flow. Telecom platforms face heavy Caller ID spoofing attacks. By hard-routing the secure authentication link via SMS to the pre-registered caregiver's physical device, we built a natural defense mechanism against social engineering. Even if a fraudster spoofs an elderly user's phone number, they hit a dead end, and the actual caregiver is alerted to the suspicious account activity.

We are also proud of perfectly weaving the Google Gemini and Chert AI sponsor APIs into a cohesive, deeply empathetic product that solves a massive, real-world accessibility problem.

## What we learned

1. How to build stateful telecommunications apps using Twilio webhooks and TwiML.

2. How to write structured prompts for LLMs (Gemini) to guarantee machine-readable JSON outputs for seamless backend integration.

3. How to use Firebase Realtime Database to push live state updates to a React frontend.

## What's next for Relay

Our primary go-to-market strategy is a B2B enterprise rollout to drastically reduce Average Handle Time (AHT) for utility companies, banks, and ISPs.

Technically, we plan to upgrade our voice passphrase system to true deep-learning acoustic biometrics for seamless identity verification. We also want to build direct API integrations into Zendesk and Salesforce so that when a caregiver clicks "Approve" on their GoDaddy-hosted dashboard, it instantly updates the enterprise call center's CRM. Finally, we envision expanding the dashboard into a unified "Family Hub" to manage a parent's telecom, banking, and medical portals all in one place.

## Running the Flask voice webhook

Install the Python dependencies with `pip install -r requirements.txt`, configure
`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`,
`GEMINI_API_KEY`, `FIREBASE_KEY_PATH`, and `FIREBASE_DB_URL`, then start the
service with `python app.py`. Twilio should send voice webhooks to
`/incoming-call`. Requests are validated with `TWILIO_AUTH_TOKEN`.

Configure caller-specific passphrases and caregiver details with
`RELAY_CALLERS_JSON`, a JSON object keyed by the caller's E.164 phone number.
Each value must contain `passphrase`, `caregiver_phone`, and `senior_name`.
`RELAY_DEMO_MODE` is off unless set to `1`; when enabled, unknown callers use
`RELAY_DEMO_PASSPHRASE`, `RELAY_DEMO_CAREGIVER_PHONE`, and
`RELAY_DEMO_SENIOR_NAME`. Do not enable this outside a controlled demo.

For local testing only, `RELAY_SKIP_TWILIO_VALIDATION=1` disables Twilio
signature checks and emits a critical security warning. It is off by default
and must not be enabled in a deployed environment. The app applies Werkzeug
`ProxyFix` for one trusted forwarded host and protocol, so configure the reverse
proxy accordingly.

Passphrases are never written to Firebase, and phone numbers are not included
in Firebase call metadata. Run the Flask test-client suite with
`python -m unittest test_app`.
