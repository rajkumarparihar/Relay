// import { useState } from 'react'
// import heroImg from './assets/hero.png'
// import reactLogo from './assets/react.svg'
// import viteLogo from './assets/vite.svg'
// import './App.css'
import { useState, useEffect, useRef } from 'react';
import { ref, onChildAdded, onChildChanged, update } from 'firebase/database';
import { db } from './firebase';
import { 
  ShieldCheck, 
  PhoneForwarded, 
  CheckCircle2, 
  XCircle, 
  Lock, 
  BellRing, 
  Play, 
  RotateCcw,
  Sparkles,
  Video,
  Tag,
  Activity
} from 'lucide-react';

// 1. Helper to format epoch seconds from Alaina's backend
const formatEpochTime = (epochSeconds) => {
  if (!epochSeconds) return 'Just now';
  // Handle if already a string (like from mock data)
  if (typeof epochSeconds === 'string') return epochSeconds;
  const date = new Date(epochSeconds * 1000);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// 2. Helper to normalize a raw Firebase child snapshot into flat UI state
const mapFirebaseCallRecord = (callId, rawData) => {
  const metadata = rawData?.metadata || {};
  const triage = rawData?.ai_triage || {};
  const visual = rawData?.visual_diagnostic || {};

  // Handle phones whether Alaina sends a string or an object (e.g., { senior: "...", caregiver: "..." })
  let callerPhone = '';
  if (typeof metadata.phones === 'string') {
    callerPhone = metadata.phones;
  } else if (metadata.phones && typeof metadata.phones === 'object') {
    callerPhone = metadata.phones.senior || metadata.phones.caller || Object.values(metadata.phones) || '';
  }

  // Format optional confidence
  let formattedConfidence = null;
  if (triage.confidence !== undefined && triage.confidence !== null) {
    const num = Number(triage.confidence);
    formattedConfidence = !isNaN(num)
      ? `${(num <= 1 ? num * 100 : num).toFixed(1)}%`
      : String(triage.confidence);
  }
// Check if core fields exist before allowing caregiver actions
  const hasRequiredFields = Boolean(metadata.senior_name && metadata.status);

  return {
    id: callId,
    isComplete: hasRequiredFields,
    seniorName: metadata.senior_name || 'Unidentified Caller',
    company: metadata.company || 'Support Line',
    callerPhone,
    // Never default to 'pending' on an incomplete record so buttons stay safely hidden
    status: metadata.status || 'incomplete',
    timestamp: formatEpochTime(metadata.timestamp),
    // AI Triage fields
    intent: triage.intent || 'Pending Triage',
    sentiment: triage.sentiment || 'Neutral',
    urgency: triage.urgency || 'Medium',
    gemini_summary: triage.gemini_summary || 'Awaiting AI incident summary from backend...',
    confidenceScore: formattedConfidence,
    // Visual Diagnostic fields
    requires_visual: Boolean(visual.requires_visual),
    chert_link: visual.chert_link || '',
    chert_status: visual.chert_status || 'not_required',
  };
};

// TEMPORARY MOCK SCENARIO DATA FOR TESTING MY IMPLEMENTATION

// New version with Gemini summary, intent, sentiment, and chert_link
// Necessary to integrate with Alaina's part of the project, which will eventually replace this mock data with live Firebase data.
const MOCK_SCENARIOS = [
  {
    metadata: {
      senior_name: 'Arthur Pendelton (Dad)',
      company: 'Comcast Support',
      status: 'pending',
      timestamp: Math.floor(Date.now() / 1000),
    },
    ai_triage: {
      intent: 'Hardware Problem',
      sentiment: 'Frustrated',
      urgency: 'High',
      gemini_summary: 'Caller reported blinking orange lights on his living room gateway after a brief power outage. Automated diagnostics confirmed a firmware hang requiring caregiver sign-off.',
      confidence: 0.994,
    },
    visual_diagnostic: {
      requires_visual: true,
      chert_link: 'https://example.com',
      chert_status: 'pending',
    },
  },
  {
    metadata: {
      senior_name: 'Eleanor Vance (Mom)',
      company: 'First National Bank',
      status: 'pending',
      timestamp: Math.floor(Date.now() / 1000),
    },
    ai_triage: {
      intent: 'Fraud Verification',
      sentiment: 'Anxious',
      urgency: 'Critical',
      gemini_summary: 'Automated fraud hold triggered on a $240 prescription pickup at CVS. Caller confirmed she is at the pharmacy counter and requested family verification.',
      // confidence omitted on purpose to test optional badge hiding
    },
    visual_diagnostic: {
      requires_visual: false,
      chert_link: '',
      chert_status: 'not_required',
    },
  }
];

// New old version with Gemini summary, intent, sentiment, and chert_link
/*const MOCK_SCENARIOS = [
  {
    seniorName: 'Arthur Pendelton (Dad)',
    company: 'Comcast Support',
    passphrase: 'blue monkey',
    gemini_summary: 'Caller reported blinking orange lights on his living room gateway after a brief power outage. Automated diagnostics confirmed a firmware hang requiring caregiver sign-off for a remote factory reset.',
    intent: 'Hardware Reset',
    sentiment: 'Frustrated',
    chert_link: 'https://example.com',
    confidenceScore: '99.4%',
  },
  {
    seniorName: 'Eleanor Vance (Mom)',
    company: 'First National Bank',
    passphrase: 'sunny garden',
    gemini_summary: 'Automated fraud hold triggered on a $240 prescription pickup at CVS. Caller confirmed she is physically at the pharmacy counter and requested family verification.',
    intent: 'Fraud Verification',
    sentiment: 'Confused',
    chert_link: '', // Empty on purpose to test conditional button hiding
    confidenceScore: '98.9%',
  },
  {
    seniorName: 'Arthur Pendelton (Dad)',
    company: 'ADT Home Security',
    passphrase: 'blue monkey',
    gemini_summary: 'Low-battery chirp on back patio sensor. Visual inspection requested to verify sensor housing alignment before dispatching a technician.',
    intent: 'Visual Triage',
    sentiment: 'Calm',
    chert_link: 'https://example.com',
    confidenceScore: '99.6%',
  }
]; */

// Old ver w/ issueSummary instead of Gemini summary, intent, sentiment, and chert_link
// const MOCK_SCENARIOS = [
//   {
//     seniorName: 'Arthur Pendelton (Dad)',
//     company: 'Comcast Support',
//     passphrase: 'blue monkey',
//     issueSummary: 'Support requires authorization to remotely factory-reset the gateway router and apply a $0 service credit.',
//     confidenceScore: '99.4%',
//   },
//   {
//     seniorName: 'Eleanor Vance (Mom)',
//     company: 'First National Bank',
//     passphrase: 'sunny garden',
//     issueSummary: 'Fraud prevention flagged a $240 pharmacy charge. Approve verification to unlock her debit card immediately.',
//     confidenceScore: '98.9%',
//   },
//   {
//     seniorName: 'Arthur Pendelton (Dad)',
//     company: 'Medicare Advantage',
//     passphrase: 'blue monkey',
//     issueSummary: 'Agent needs caregiver confirmation to update preferred mail-order pharmacy address on file.',
//     confidenceScore: '99.6%',
//   }
// ];

// END TEMPORARY MOCK SCENARIO DATA - SECTION WILL LIKELY BE REMOVED ONCE ALAINA IMPLEMENTS THE FIREBASE DATABASE.

export default function App() {
  const [activeCall, setActiveCall] = useState(null);
  const [showNewAlert, setShowNewAlert] = useState(false);
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [dbError, setDbError] = useState(null);
  const isInitialLoad = useRef(true);
  const alertTimerRef = useRef(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [writeError, setWriteError] = useState(null);


  const triggerIncomingCall = (mappedPayload, shouldFlash = true) => {
    setActiveCall(mappedPayload);

    if (shouldFlash) {
      setShowNewAlert(false);
      setTimeout(() => setShowNewAlert(true), 50);

      if (alertTimerRef.current) clearTimeout(alertTimerRef.current);
      alertTimerRef.current = setTimeout(() => setShowNewAlert(false), 6000);
    }
  };

    // Keep a ref to the current activeCall ID so onChildChanged always sees the latest ID
  const activeCallIdRef = useRef(null);
  useEffect(() => {
    activeCallIdRef.current = activeCall?.id || null;
  }, [activeCall?.id]);

  useEffect(() => {
    if (!db) return;

    let unsubAdded = () => {};
    let unsubChanged = () => {};

    try {
      const callsRef = ref(db, 'active_calls');

      // 1. Listen for brand-new calls
      unsubAdded = onChildAdded(
        callsRef,
        (snapshot) => {
          const rawData = snapshot.val();
          if (rawData) {
            const mapped = mapFirebaseCallRecord(snapshot.key, rawData);
            triggerIncomingCall(mapped, !isInitialLoad.current);
          }
        },
        (error) => {
          console.error('Firebase read error:', error);
          setDbError(error.message);
        }
      );

      // 2. Listen for updates to existing calls (triage, status, chert_status)
      unsubChanged = onChildChanged(
        callsRef,
        (snapshot) => {
          const rawData = snapshot.val();
          if (rawData && snapshot.key === activeCallIdRef.current) {
            const updatedRecord = mapFirebaseCallRecord(snapshot.key, rawData);
            setActiveCall(updatedRecord);
          }
        },
        (error) => {
          console.error('Firebase update listener error:', error);
          setDbError(error.message);
        }
      );
    } catch (err) {
      console.error('Firebase ref error:', err);
      setDbError(err.message);
    }

    const loadTimer = setTimeout(() => {
      isInitialLoad.current = false;
    }, 1000);

    return () => {
      unsubAdded();
      unsubChanged();
      clearTimeout(loadTimer);
    };
  },);


  const handleSimulateCall = () => {
    const rawMock = MOCK_SCENARIOS[scenarioIndex % MOCK_SCENARIOS.length];
    const fakeId = `SIM-${Math.floor(1000 + Math.random() * 9000)}`;
    const mapped = mapFirebaseCallRecord(fakeId, rawMock);

    triggerIncomingCall(mapped, true);
    setScenarioIndex((prev) => prev + 1);
  };

  const handleResetDemo = () => {
    setActiveCall(null);
    setShowNewAlert(false);
    setWriteError(null);
    setIsSubmitting(false);
  };

  // Bug #2 Fix: Await Firebase confirmation before updating UI status
  const handleDecision = async (newStatus) => {
    if (!activeCall?.id || isSubmitting) return;
    setWriteError(null);

    // Local simulation mode (no Firebase write needed)
    if (!db || activeCall.id.startsWith('SIM-')) {
      setActiveCall((prev) => ({ ...prev, status: newStatus }));
      setShowNewAlert(false);
      return;
    }
    setIsSubmitting(true);
    try {
      const metadataRef = ref(db, `active_calls/${activeCall.id}/metadata`);
      await update(metadataRef, { status: newStatus });

      // Only update UI after Firebase confirms the write succeeded
      setActiveCall((prev) => ({ ...prev, status: newStatus }));
      setShowNewAlert(false);
    } catch (error) {
      console.error('Failed to update metadata/status:', error);
      setWriteError(`Could not save decision (${error.message}). Please try again.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Bug #2 & #4 Fix: Confirm Chert launch write and update visible chert_status
  const handleVisualLaunch = async (e) => {
    if (!activeCall?.id) return;
    setWriteError(null);

    if (!db || activeCall.id.startsWith('SIM-')) {
      setActiveCall((prev) => ({ ...prev, chert_status: 'launched' }));
      return;
    }

    // Prevent immediate navigation until Firebase logs the launch, then open link
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const visualRef = ref(db, `active_calls/${activeCall.id}/visual_diagnostic`);
      await update(visualRef, { chert_status: 'launched' });

      setActiveCall((prev) => ({ ...prev, chert_status: 'launched' }));
      window.open(activeCall.chert_link, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error('Failed to update chert_status:', error);
      setWriteError(`Could not log diagnostic launch (${error.message}).`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getUrgencyBadgeStyle = (urgency) => {
    const u = (urgency || '').toLowerCase();
    if (u === 'critical') return 'bg-RelayApp-Accent2 text-white border-RelayApp-Accent2';
    if (u === 'high') return 'bg-RelayApp-Primary/30 text-amber-950 border-RelayApp-Primary';
    if (u === 'low') return 'bg-slate-100 text-slate-700 border-slate-300';
    return 'bg-RelayApp-Accent1/20 text-indigo-950 border-RelayApp-Accent1';
  };

  const getSentimentBadgeStyle = (sentiment) => {
    const s = (sentiment || '').toLowerCase();
    if (s === 'frustrated' || s === 'distressed') {
      return 'bg-RelayApp-Accent2/20 text-rose-950 border-RelayApp-Accent2';
    }
    if (s === 'anxious') {
      return 'bg-RelayApp-Primary/25 text-amber-950 border-RelayApp-Primary';
    }
    if (s === 'calm') {
      return 'bg-RelayApp-Secondary/25 text-emerald-950 border-RelayApp-Secondary';
    }
    return 'bg-slate-100 text-slate-800 border-slate-300';
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row items-center justify-center gap-8 p-4 sm:p-6">
      
      {/* Simulated Mobile Device Frame */}
      <div className="w-full sm:w-[390px] h-[812px] sm:h-[844px] bg-slate-50 rounded-[44px] border-[10px] border-slate-900 shadow-2xl overflow-hidden flex flex-col relative shrink-0">
        
        {/* Top Brand Header */}
        <header className="bg-RelayApp-Tertiary text-white px-6 pt-8 pb-6 rounded-b-3xl shadow-md z-10">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold uppercase tracking-wider bg-white/15 px-3 py-1 rounded-full flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-RelayApp-Secondary" />
              Twilio Live Sync
            </span>
            <span className="text-xs font-medium text-RelayApp-Accent1">
              {activeCall ? `ID #${activeCall.id.slice(-4)}` : 'Listening...'}
            </span>
          </div>

          <h1 className="text-2xl font-extrabold tracking-tight">The Relay</h1>
          <p className="text-sm text-indigo-100 mt-1">
            Caregiver Asynchronous Support Portal
          </p>
        </header>

        {/* FLASHING "NEW REQUEST" ALERT BANNER */}
        {showNewAlert && (
          <div className="mx-4 mt-4 px-4 py-3 rounded-2xl bg-RelayApp-Primary border-2 border-slate-900 text-slate-950 shadow-lg flex items-center justify-between animate-new-request">
            <div className="flex items-center gap-2.5">
              <BellRing className="w-5 h-5 shrink-0 animate-bounce" />
              <div>
                <p className="text-sm font-black uppercase tracking-wide">New Request!</p>
                <p className="text-xs font-semibold">Incoming delegation from {activeCall?.seniorName}</p>
              </div>
            </div>
            <button
              onClick={() => setShowNewAlert(false)}
              className="text-xs font-bold underline px-2 py-1 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* WRITE ERROR BANNER (Bug #2 Fix) */}
        {writeError && (
          <div className="mx-4 mt-3 px-4 py-2.5 rounded-xl bg-rose-100 border border-rose-400 text-rose-950 text-xs font-bold">
            ⚠ {writeError}
          </div>
        )}

        {/* Main Scrollable Content Area */}
        <main className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          {!activeCall ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-4 space-y-3">
              <div className="w-12 h-12 rounded-full bg-RelayApp-Accent1/20 flex items-center justify-center">
                <span className="w-3 h-3 rounded-full bg-RelayApp-Tertiary animate-ping" />
              </div>
              <h2 className="text-base font-bold text-slate-900">Waiting for Call Events</h2>
              <p className="text-xs text-slate-500 leading-relaxed">
                {db && !dbError
                  ? 'Listening to active_calls in Firebase. New requests will appear automatically.'
                  : "Demo Mode active. Click 'Simulate Incoming Call' to test a caregiver handoff."}
              </p>
              {dbError && (
                <p className="text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2">
                  Firebase Notice: {dbError}
                </p>
              )}
            </div>
          ) : (
            <>
              {/* 1. Handoff Context Banner (Now includes metadata.phones) */}
              <div className="bg-white border-l-4 border-RelayApp-Primary rounded-xl p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="bg-RelayApp-Primary/20 p-2 rounded-lg text-slate-900 shrink-0">
                    <PhoneForwarded className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
                        Live Call Intercepted
                      </span>
                      <span className="text-[11px] text-slate-400">• {activeCall.timestamp}</span>
                    </div>
                    <h2 className="text-base font-bold text-slate-900 mt-0.5">
                      {activeCall.seniorName}
                    </h2>
                    {activeCall.callerPhone && (
                      <p className="text-xs font-semibold text-slate-700 mt-0.5">
                        Caller ID: {activeCall.callerPhone}
                      </p>
                    )}
                    <p className="text-xs text-slate-600 mt-1 leading-snug">
                      Delegated from <strong>{activeCall.company}</strong> support line.
                    </p>
                  </div>
                </div>
              </div>

              {/* 2. Verification Strip (Confidence renders only if present) */}
              <div className="bg-RelayApp-Accent1/15 border border-RelayApp-Accent1/40 rounded-xl px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="w-5 h-5 text-RelayApp-Tertiary shrink-0" />
                  <p className="text-xs font-bold text-slate-900">Voice & Caller ID Verified</p>
                </div>
                {activeCall.confidenceScore && (
                  <span className="text-xs font-bold bg-RelayApp-Secondary/25 text-emerald-950 px-2.5 py-0.5 rounded-md">
                    {activeCall.confidenceScore} Match
                  </span>
                )}
              </div>

              {/* 3. GEMINI AI INCIDENT BRIEFING CARD */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3.5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-RelayApp-Accent1/20 rounded-lg text-RelayApp-Tertiary">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wide">
                      Incident Briefing
                    </h3>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-RelayApp-Tertiary bg-RelayApp-Accent1/15 px-2 py-0.5 rounded-full">
                    Gemini AI
                  </span>
                </div>

                {/* Urgency, Intent & Sentiment Tags */}
                <div className="flex flex-wrap gap-2">
                  <span className={`inline-flex items-center gap-1 text-xs font-extrabold px-2.5 py-1 rounded-lg border ${getUrgencyBadgeStyle(activeCall.urgency)}`}>
                    Urgency: {activeCall.urgency}
                  </span>

                  <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-lg bg-RelayApp-Tertiary/10 text-RelayApp-Tertiary border border-RelayApp-Tertiary/25">
                    <Tag className="w-3.5 h-3.5" />
                    {activeCall.intent}
                  </span>

                  <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-lg border ${getSentimentBadgeStyle(activeCall.sentiment)}`}>
                    <Activity className="w-3.5 h-3.5" />
                    {activeCall.sentiment}
                  </span>
                </div>

                {/* Gemini Summary Body */}
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                  <p className="text-sm text-slate-800 leading-relaxed">
                    {activeCall.gemini_summary}
                  </p>
                </div>

                {/* CONDITIONAL SPONSOR FEATURE + VISIBLE CHERT STATUS (Bug #4 Fix) */}
                {activeCall.requires_visual && activeCall.chert_link && (
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between text-xs px-1">
                      <span className="font-bold text-slate-600">Visual Diagnostic Status:</span>
                      <span
                        className={`font-extrabold uppercase px-2 py-0.5 rounded-md ${
                          activeCall.chert_status === 'launched'
                            ? 'bg-RelayApp-Secondary/25 text-emerald-950'
                            : 'bg-RelayApp-Primary/25 text-amber-950'
                        }`}
                      >
                        {activeCall.chert_status === 'launched' ? '✓ Launched' : 'Pending Launch'}
                      </span>
                    </div>

                    <a
                      href={activeCall.chert_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={handleVisualLaunch}
                      className={`w-full py-3.5 px-4 font-extrabold text-sm rounded-xl shadow-md transition flex items-center justify-center gap-2 ${
                        isSubmitting
                          ? 'bg-slate-400 text-white cursor-wait'
                          : 'bg-RelayApp-Tertiary hover:brightness-110 text-white'
                      }`}
                    >
                      <Video className="w-5 h-5 text-RelayApp-Primary" />
                      {activeCall.chert_status === 'launched'
                        ? 'Re-open Visual Diagnostic'
                        : 'Initiate Visual Diagnostic'}
                    </a>
                  </div>
                )}
              </div>

              {/* 4. Caregiver Resolution Actions (Guarded against incomplete records) */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                  Caregiver Authorization
                </h4>

                {!activeCall.isComplete || activeCall.status === 'incomplete' ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
                    <p className="text-xs font-bold text-amber-900">
                      Syncing full call details from backend...
                    </p>
                  </div>
                ) : activeCall.status === 'pending' ? (
                  <div className="space-y-2.5">
                    <button
                      disabled={isSubmitting}
                      onClick={() => handleDecision('approved')}
                      className="w-full py-3.5 px-4 bg-RelayApp-Secondary hover:brightness-95 disabled:opacity-50 text-slate-950 font-extrabold text-base rounded-xl shadow-sm transition flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <CheckCircle2 className="w-5 h-5" />
                      {isSubmitting ? 'Confirming with Server...' : 'Approve & Resolve'}
                    </button>

                    <button
                      disabled={isSubmitting}
                      onClick={() => handleDecision('declined')}
                      className="w-full py-3 px-4 bg-white border-2 border-RelayApp-Accent2 text-slate-900 hover:bg-RelayApp-Accent2/10 disabled:opacity-50 font-bold text-sm rounded-xl transition flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <XCircle className="w-5 h-5 text-RelayApp-Accent2" />
                      {isSubmitting ? 'Saving...' : 'Decline & Request Callback'}
                    </button>
                  </div>
                ) : activeCall.status === 'approved' ? (
                  <div className="bg-RelayApp-Secondary/20 border border-RelayApp-Secondary rounded-xl p-4 text-center space-y-1">
                    <p className="text-sm font-extrabold text-emerald-950">
                      ✓ Authorization Confirmed
                    </p>
                    <p className="text-xs text-emerald-900">
                      {activeCall.seniorName.split(' ')} has been notified via automated voice update.
                    </p>
                  </div>
                ) : activeCall.status === 'declined' ? (
                  <div className="bg-RelayApp-Accent2/15 border border-RelayApp-Accent2 rounded-xl p-4 text-center space-y-1">
                    <p className="text-sm font-extrabold text-rose-950">
                      ✕ Request Declined
                    </p>
                    <p className="text-xs text-rose-900">
                      A human agent has been queued to call you directly.
                    </p>
                  </div>
                ) : (
                  <div className="bg-slate-100 border border-slate-200 rounded-xl p-3 text-center">
                    <p className="text-xs font-bold text-slate-700 uppercase">
                      Current Status: {activeCall.status}
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </main>

        {/* Bottom Simulated Home Indicator */}
        <footer className="bg-white border-t border-slate-200 px-6 py-3 text-center">
          <p className="text-[11px] font-medium text-slate-400">
            {db && !dbError ? 'Encrypted Session • Firebase Live Sync' : 'Encrypted Session • Local Demo Mode'}
          </p>
          <div className="w-32 h-1 bg-slate-300 rounded-full mx-auto mt-2" />
        </footer>
      </div>

      {/* External Pitch / Demo Control Panel */}
      <aside className="w-full max-w-[390px] lg:w-72 bg-white/95 backdrop-blur border border-slate-200 rounded-2xl p-5 shadow-lg space-y-4">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-RelayApp-Tertiary">
            Presenter Controls
          </span>
          <h3 className="text-base font-extrabold text-slate-900 mt-0.5">
            Twilio Event Simulator
          </h3>
          <p className="text-xs text-slate-600 mt-1 leading-relaxed">
            Test live <code>active_calls</code> records or cycle through mock Gemini AI briefings.
          </p>
        </div>

        <div className="space-y-2.5">
          <button
            onClick={handleSimulateCall}
            className="w-full py-3 px-4 bg-RelayApp-Primary hover:brightness-95 text-slate-950 font-extrabold text-sm rounded-xl shadow-sm transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <Play className="w-4 h-4 fill-slate-950" />
            Simulate Incoming Call
          </button>

          <button
            onClick={handleResetDemo}
            className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset to Waiting Screen
          </button>
        </div>

        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
          <span className="text-slate-500 font-medium">Database Status:</span>
          <span className={`font-bold px-2 py-0.5 rounded-full ${db && !dbError ? 'bg-RelayApp-Secondary/20 text-emerald-900' : 'bg-amber-100 text-amber-900'}`}>
            {db && !dbError ? 'Firebase Connected' : 'Local / Check URL'}
          </span>
        </div>
      </aside>
    </div>
  );
}  

