// import { useState } from 'react'
// import heroImg from './assets/hero.png'
// import reactLogo from './assets/react.svg'
// import viteLogo from './assets/vite.svg'
import './App.css'
import React, { useState } from 'react';
import { ShieldCheck, PhoneForwarded, CheckCircle2, XCircle, Wifi, Lock } from 'lucide-react';

export default function App() {
  const [status, setStatus] = useState('pending'); // 'pending' | 'approved' | 'declined'

  return (
    /* Outer Viewport: Centers the mobile device on desktop screens */
    <div className="min-h-screen flex items-center justify-center p-0 sm:p-6">
      
      {/* Simulated Mobile Device Frame */}
      <div className="w-full sm:w-[390px] h-screen sm:h-[844px] bg-slate-50 sm:rounded-[44px] sm:border-[10px] sm:border-slate-900 shadow-2xl overflow-hidden flex flex-col relative">
        
        {/* Top Simulated Status Bar & Brand Header */}
        <header className="bg-RelayApp-Tertiary text-white px-6 pt-8 pb-6 rounded-b-3xl shadow-md">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold uppercase tracking-wider bg-white/15 px-3 py-1 rounded-full flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-RelayApp-Secondary" />
              Twilio Verified Handoff
            </span>
            <span className="text-xs font-medium text-RelayApp-Accent1">ID #8842</span>
          </div>

          <h1 className="text-2xl font-extrabold tracking-tight">The Relay</h1>
          <p className="text-sm text-indigo-100 mt-1">
            Caregiver Asynchronous Support Portal
          </p>
        </header>

        {/* Main Scrollable Content Area */}
        <main className="flex-1 overflow-y-auto px-5 py-6 space-y-5">
          
          {/* 1. Handoff Context Banner (Primary Orange Accent) */}
          <div className="bg-white border-l-4 border-RelayApp-Primary rounded-xl p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="bg-RelayApp-Primary/20 p-2 rounded-lg text-slate-900 shrink-0">
                <PhoneForwarded className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-amber-800">
                  Live Call Intercepted
                </span>
                <h2 className="text-base font-bold text-slate-900 mt-0.5">
                  Arthur Pendelton (Dad)
                </h2>
                <p className="text-sm text-slate-600 mt-1 leading-snug">
                  Bypassed Comcast Support IVR via voice passphrase <strong className="text-slate-900">"blue monkey"</strong>.
                </p>
              </div>
            </div>
          </div>

          {/* 2. Verification & Security Card (Accent 1 Wisteria Blue) */}
          <div className="bg-RelayApp-Accent1/15 border border-RelayApp-Accent1/40 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-6 h-6 text-RelayApp-Tertiary shrink-0" />
              <div>
                <p className="text-sm font-bold text-slate-900">Voice Identity Verified</p>
                <p className="text-xs text-slate-700">Caller ID & Passphrase Matched</p>
              </div>
            </div>
            <span className="text-xs font-bold bg-RelayApp-Secondary/20 text-emerald-950 px-2.5 py-1 rounded-md">
              99.4% Match
            </span>
          </div>

          {/* 3. Actionable Task Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-slate-100 rounded-lg text-RelayApp-Tertiary">
                <Wifi className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Action Required</h3>
                <p className="text-xs text-slate-500">Requested 1 min ago</p>
              </div>
            </div>

            <p className="text-sm text-slate-700 leading-relaxed">
              Arthur reported his internet is offline. Support requires authorization to <strong>remotely factory-reset the gateway router</strong> and apply a $0 service credit.
            </p>

            {/* Interactive State Feedback */}
            {status === 'pending' && (
              <div className="pt-2 space-y-3">
                <button
                  onClick={() => setStatus('approved')}
                  className="w-full py-3.5 px-4 bg-RelayApp-Secondary hover:brightness-95 active:scale-[0.99] text-slate-950 font-extrabold text-base rounded-xl shadow-sm transition flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  Approve Router Reset
                </button>

                <button
                  onClick={() => setStatus('declined')}
                  className="w-full py-3 px-4 bg-white border-2 border-RelayApp-Accent2 text-slate-900 hover:bg-RelayApp-Accent2/10 font-bold text-sm rounded-xl transition flex items-center justify-center gap-2"
                >
                  <XCircle className="w-5 h-5 text-RelayApp-Accent2" />
                  Decline & Request Callback
                </button>
              </div>
            )}

            {status === 'approved' && (
              <div className="bg-RelayApp-Secondary/20 border border-RelayApp-Secondary rounded-xl p-4 text-center space-y-1">
                <p className="text-sm font-extrabold text-emerald-950">
                  ✓ Authorization Sent to Support
                </p>
                <p className="text-xs text-emerald-900">
                  Arthur has been notified via automated voice update. No further action needed.
                </p>
              </div>
            )}

            {status === 'declined' && (
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

        </main>

        {/* Bottom Simulated Home Indicator */}
        <footer className="bg-white border-t border-slate-200 px-6 py-3 text-center">
          <p className="text-[11px] font-medium text-slate-400">
            Encrypted Session • Auto-expires in 14:59
          </p>
          <div className="w-32 h-1 bg-slate-300 rounded-full mx-auto mt-2" />
        </footer>

      </div>
    </div>
  );
}

