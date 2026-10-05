import React from "react";
import { ShieldCheck, EyeOff } from "lucide-react";

export function PrivacyNotice() {
  return (
    <aside
      aria-label="Privacy and Surveillance Protection Notice"
      className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 backdrop-blur-sm"
    >
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-sky-500/10 p-2 text-sky-400">
          <ShieldCheck className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="flex-1">
          <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <span>Privacy-By-Design Assurance</span>
            <span className="inline-flex items-center gap-1 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-medium text-slate-300">
              <EyeOff className="h-3 w-3" aria-hidden="true" />
              Zero Facial Tracking
            </span>
          </h2>
          <p className="mt-1 text-xs text-slate-400 leading-relaxed">
            OpenWay analyzes the physical environment (pathways, ramps, automatic doors),{" "}
            <strong>never people&apos;s identities</strong>. We strictly prohibit facial recognition,
            disability inference, visitor profiling, cross-camera tracking, or biometric surveillance.
          </p>
        </div>
      </div>
    </aside>
  );
}
