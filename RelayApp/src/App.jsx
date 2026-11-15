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
  Activity,
  LoaderCircle
} from 'lucide-react';

const formatEpochTime = (timestamp) => {
  if (timestamp == null) return '';
  const date = new Date(timestamp * 1000);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const normalizeCall = (id, data) => {
  const metadata = data?.metadata ?? {};
  const triage = data?.ai_triage ?? {};
  const visual = data?.visual_diagnostic ?? {};
  const confidence = triage.confidence;

  return {
    id,
    seniorName: metadata.senior_name ?? '',
    company: metadata.company ?? '',
    status: metadata.status ?? '',
    timestamp: formatEpochTime(metadata.timestamp),
    intent: triage.intent ?? '',
    sentiment: triage.sentiment ?? '',
    urgency: triage.urgency ?? '',
    gemini_summary: triage.gemini_summary ?? '',
    confidenceScore: typeof confidence === 'number' && Number.isFinite(confidence)
      ? `${(confidence * 100).toFixed(1)}%`
      : null,
    requires_visual: Boolean(visual.requires_visual),
    chert_link: visual.chert_link ?? '',
    chert_status: visual.chert_status ?? '',
  };
};

const MOCK_SCENARIOS = [
  {
    metadata: {
      senior_name: 'Arthur Pendelton (Dad)',
      company: 'Comcast Support',
      status: 'awaiting_caregiver',
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
      status: 'awaiting_caregiver',
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

export default function App() {
  const [activeCall, setActiveCall] = useState(null);
  const [showNewAlert, setShowNewAlert] = useState(false);
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [dbError, setDbError] = useState(null);
  const isInitialLoad = useRef(true);
  const alertTimerRef = useRef(null);

  const triggerIncomingCall = (mappedPayload, shouldFlash = true) => {
    setActiveCall(mappedPayload);

    if (shouldFlash) {
      setShowNewAlert(false);
      setTimeout(() => setShowNewAlert(true), 50);

      if (alertTimerRef.current) clearTimeout(alertTimerRef.current);
      alertTimerRef.current = setTimeout(() => setShowNewAlert(false), 6000);
    }
  };

  useEffect(() => {
    if (!db) return;

    let unsubscribe = () => {};

    try {
      const callsRef = ref(db, 'active_calls');

      const handleSnapshot = (snapshot, shouldFlash) => {
        const data = snapshot.val();
        if (!snapshot.key || !data) return;

        const normalized = normalizeCall(snapshot.key, data);
        if (shouldFlash) {
          triggerIncomingCall(normalized, !isInitialLoad.current);
        } else {
          setActiveCall((current) => current?.id === normalized.id ? normalized : current);
        }
      };

      const unsubscribeAdded = onChildAdded(
        callsRef,
        (snapshot) => handleSnapshot(snapshot, true),
        (error) => {
          console.error('Firebase read error:', error);
          setDbError(error.message);
        }
      );
      const unsubscribeChanged = onChildChanged(
        callsRef,
        (snapshot) => handleSnapshot(snapshot, false),
        (error) => {
          console.error('Firebase change listener error:', error);
          setDbError(error.message);
        }
      );
      unsubscribe = () => {
        unsubscribeAdded();
        unsubscribeChanged();
      };
    } catch (err) {
      console.error('Firebase ref error:', err);
      setDbError(err.message);
    }

    const loadTimer = setTimeout(() => {
      isInitialLoad.current = false;
    }, 1000);

    return () => {
      unsubscribe();
      clearTimeout(loadTimer);
    };
  }, []);

  const handleSimulateCall = () => {
    const rawMock = MOCK_SCENARIOS[scenarioIndex % MOCK_SCENARIOS.length];
    const fakeId = `SIM-${Math.floor(1000 + Math.random() * 9000)}`;
    const mapped = normalizeCall(fakeId, rawMock);

    triggerIncomingCall(mapped, true);
    setScenarioIndex((prev) => prev + 1);
  };

  const handleResetDemo = () => {
    setActiveCall(null);
    setShowNewAlert(false);
  };

  const handleDecision = async (newStatus) => {
    if (!activeCall?.id) return;

    setShowNewAlert(false);

    if (db && !activeCall.id.startsWith('SIM-')) {
      try {
        const metadataRef = ref(db, `active_calls/${activeCall.id}/metadata`);
        await update(metadataRef, { status: newStatus });
        setActiveCall((prev) => prev?.id === activeCall.id ? { ...prev, status: newStatus } : prev);
      } catch (error) {
        console.error('Failed to update metadata/status:', error);
        setDbError(error.message);
      }
    } else {
      setActiveCall((prev) => prev?.id === activeCall.id ? { ...prev, status: newStatus } : prev);
    }
  };

  const handleVisualLaunch = async () => {
    if (!activeCall?.id) return;
    setActiveCall((prev) => ({ ...prev, chert_status: 'launched' }));

    if (db && !activeCall.id.startsWith('SIM-')) {
      try {
        const visualRef = ref(db, `active_calls/${activeCall.id}/visual_diagnostic`);
        await update(visualRef, { chert_status: 'launched' });
      } catch (error) {
        console.error('Failed to update chert_status:', error);
      }
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
    if (s === 'frustrated' || s === 'distressed' || s === 'anxious') {
      return 'bg-RelayApp-Accent2/20 text-rose-950 border-RelayApp-Accent2';
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
              {/* 1. Handoff Context Banner */}
              <div className="bg-white border-l-4 border-RelayApp-Primary rounded-xl p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="bg-RelayApp-Primary/20 p-2 rounded-lg text-slate-900 shrink-0">
                    <PhoneForwarded className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
                        Live Call Intercepted
                      </span>
                      <span className="text-[11px] text-slate-400">• {activeCall.timestamp}</span>
                    </div>
                    <h2 className="text-base font-bold text-slate-900 mt-0.5">
                      {activeCall.seniorName}
                    </h2>
                    <p className="text-xs text-slate-600 mt-1 leading-snug">
                      Delegated from <strong>{activeCall.company}</strong> support line.
                    </p>
                  </div>
                </div>
              </div>

              {/* 2. Transcript confidence is optional */}
              {activeCall.confidenceScore !== null && (
                <div className="bg-RelayApp-Accent1/15 border border-RelayApp-Accent1/40 rounded-xl px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <ShieldCheck className="w-5 h-5 text-RelayApp-Tertiary shrink-0" />
                    <p className="text-xs font-bold text-slate-900">Transcript confidence</p>
                  </div>
                  <span className="text-xs font-bold bg-RelayApp-Secondary/25 text-emerald-950 px-2.5 py-0.5 rounded-md">
                    {activeCall.confidenceScore}
                  </span>
                </div>
              )}

              {/* 3. GEMINI AI INCIDENT BRIEFING CARD */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3.5">
                {activeCall.urgency.toLowerCase() === 'critical' && (
                  <div className="bg-RelayApp-Accent2 text-white border border-RelayApp-Accent2 rounded-xl px-4 py-3 text-sm font-extrabold uppercase tracking-wide">
                    Critical urgency
                  </div>
                )}
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

                {/* CONDITIONAL SPONSOR FEATURE: Depends on requires_visual */}
                {activeCall.requires_visual && activeCall.chert_link && (
                  <a
                    href={activeCall.chert_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={handleVisualLaunch}
                    className="w-full py-3.5 px-4 bg-RelayApp-Tertiary hover:brightness-110 text-white font-extrabold text-sm rounded-xl shadow-md transition flex items-center justify-center gap-2"
                  >
                    <Video className="w-5 h-5 text-RelayApp-Primary" />
                    Initiate Visual Diagnostic
                  </a>
                )}
              </div>

              {/* 4. Caregiver Resolution Actions */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                  Caregiver Authorization
                </h4>

                {activeCall.status === 'authenticating' && (
                  <div className="flex items-center justify-center gap-2 py-3 text-xs font-bold text-slate-600">
                    <LoaderCircle className="w-4 h-4 animate-spin" />
                    Authenticating caller
                  </div>
                )}

                {activeCall.status === 'awaiting_caregiver' && (
                  <div className="space-y-2.5">
                    <button
                      onClick={() => handleDecision('resolved')}
                      className="w-full py-3.5 px-4 bg-RelayApp-Secondary hover:brightness-95 text-slate-950 font-extrabold text-base rounded-xl shadow-sm transition flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <CheckCircle2 className="w-5 h-5" />
                      Approve & Resolve
                    </button>

                    <button
                      onClick={() => handleDecision('declined')}
                      className="w-full py-3 px-4 bg-white border-2 border-RelayApp-Accent2 text-slate-900 hover:bg-RelayApp-Accent2/10 font-bold text-sm rounded-xl transition flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <XCircle className="w-5 h-5 text-RelayApp-Accent2" />
                      Decline & Request Callback
                    </button>
                  </div>
                )}

                {activeCall.status === 'resolved' && (
                  <div className="bg-RelayApp-Secondary/20 border border-RelayApp-Secondary rounded-xl p-4 text-center space-y-1">
                    <p className="text-sm font-extrabold text-emerald-950">
                      ✓ Request Resolved
                    </p>
                    <p className="text-xs text-emerald-900">
                      {activeCall.seniorName.split(' ')[0]} has been notified via automated voice update.
                    </p>
                  </div>
                )}

                {activeCall.status === 'declined' && (
                  <div className="bg-RelayApp-Accent2/15 border border-RelayApp-Accent2 rounded-xl p-4 text-center space-y-1">
                    <p className="text-sm font-extrabold text-rose-950">
                      ✕ Request Declined
                    </p>
                    <p className="text-xs text-rose-900">
                      A human agent has been queued to call you directly.
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
