"use client";

import { useEffect, useRef, useState } from "react";

type Step = "idle" | "scraping" | "analyzing" | "personalizing" | "done" | "error";

interface Changes    { title?: string; metaDesc?: string; h1?: string; h2?: string; cta?: string; }
interface OrigPage   { title: string; metaDesc: string; h1: string; h2: string; cta: string; }
interface AdInsights { headline?: string; value_prop?: string; offer?: string; tone?: string; target_audience?: string; }

interface Props {
  modifiedHtml?: string;
  step: Step;
  changes?: Changes;
  originalPage?: OrigPage;
  adInsights?: AdInsights;
}

function MockPreview({ changes, originalPage, adInsights }: { changes: Changes; originalPage: OrigPage; adInsights: AdInsights }) {
  const before = {
    headline : originalPage.h1  || originalPage.title    || "Welcome",
    sub      : originalPage.h2  || originalPage.metaDesc || "",
    cta      : originalPage.cta || "Learn More",
  };
  const after = {
    headline : changes.h1  || changes.title    || before.headline,
    sub      : changes.h2  || changes.metaDesc || before.sub,
    cta      : changes.cta || before.cta,
  };

  return (
    <div className="space-y-4">
      {/* Side-by-side cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* BEFORE */}
        <div className="rounded-2xl p-5 space-y-3 flex flex-col"
             style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)" }}>
          <p className="text-xs font-bold uppercase tracking-widest text-red-400">Before</p>
          <h2 className="text-white font-bold text-lg leading-snug">{before.headline}</h2>
          {before.sub && <p className="text-white/40 text-sm leading-relaxed">{before.sub}</p>}
          <div className="mt-auto pt-3">
            <span className="inline-block px-5 py-2.5 rounded-xl text-sm font-semibold text-white/50"
                  style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}>
              {before.cta}
            </span>
          </div>
        </div>

        {/* AFTER */}
        <div className="rounded-2xl p-5 space-y-3 flex flex-col relative overflow-hidden"
             style={{ background: "rgba(124,58,237,0.08)", border: "1px solid rgba(139,92,246,0.3)" }}>
          <div className="absolute inset-0 pointer-events-none"
               style={{ background: "radial-gradient(ellipse at top right, rgba(139,92,246,0.12), transparent 60%)" }} />

          <div className="flex items-center justify-between relative z-10">
            <p className="text-xs font-bold uppercase tracking-widest text-purple-400">After</p>
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                  style={{ background: "rgba(124,58,237,0.2)", color: "#c4b5fd" }}>
              ✦ AI Personalized
            </span>
          </div>

          <h2 className="text-white font-bold text-lg leading-snug relative z-10">{after.headline}</h2>
          {after.sub && <p className="text-white/60 text-sm leading-relaxed relative z-10">{after.sub}</p>}

          <div className="mt-auto pt-3 relative z-10">
            <span className="inline-block px-5 py-2.5 rounded-xl text-sm font-bold text-white"
                  style={{ background: "linear-gradient(135deg,#7c3aed,#ec4899)", boxShadow: "0 4px 16px rgba(124,58,237,0.4)" }}>
              {after.cta}
            </span>
          </div>
        </div>
      </div>

      {/* CRO principles */}
      <div className="rounded-2xl p-4 space-y-3"
           style={{ background: "rgba(13,13,26,0.8)", border: "1px solid rgba(139,92,246,0.15)" }}>
        <p className="text-xs font-bold text-purple-400 uppercase tracking-widest">CRO Principles Applied</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            ["Message Match",  "Page headline now mirrors the ad promise"],
            ["Benefit-First",  "Copy leads with what the user gains"],
            ["Urgency Hook",   "CTA carries the ad's offer or urgency"],
            ["Tone Alignment", `Matches ad tone: ${adInsights?.tone || "matched"}`],
          ].map(([label, desc]) => (
            <div key={label} className="flex gap-2 text-xs">
              <span className="text-purple-400 shrink-0">✓</span>
              <span><strong className="text-white/70">{label}:</strong> <span className="text-white/35">{desc}</span></span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function PreviewPanel({ modifiedHtml, step, changes, originalPage, adInsights }: Props) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  // Default to mock view; user can toggle to live iframe
  const [showLive, setShowLive] = useState(false);
  const prevRef   = useRef<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (prevRef.current) { URL.revokeObjectURL(prevRef.current); prevRef.current = null; }
    setShowLive(false); // reset to mock view on new result
    if (modifiedHtml) {
      const url = URL.createObjectURL(new Blob([modifiedHtml], { type: "text/html" }));
      setBlobUrl(url);
      prevRef.current = url;
    } else {
      setBlobUrl(null);
    }
    return () => { if (prevRef.current) URL.revokeObjectURL(prevRef.current); };
  }, [modifiedHtml]);

  /* ── Idle ── */
  if (step === "idle") {
    return (
      <div className="glow-card rounded-2xl flex flex-col items-center justify-center min-h-[540px] relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full opacity-10"
               style={{ background: "radial-gradient(circle,#7c3aed,transparent)", filter: "blur(40px)" }} />
        </div>
        <div className="text-center space-y-4 px-8 relative z-10 float">
          <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center text-3xl"
               style={{ background: "linear-gradient(135deg,rgba(124,58,237,0.2),rgba(236,72,153,0.2))", border: "1px solid rgba(139,92,246,0.3)" }}>
            🖥️
          </div>
          <p className="grad-text font-bold text-lg">Your preview awaits</p>
          <p className="text-white/30 text-sm leading-relaxed max-w-xs">
            Paste an ad creative + landing page URL and watch the magic happen
          </p>
        </div>
      </div>
    );
  }

  /* ── Loading ── */
  if (step !== "done") {
    return (
      <div className="glow-card rounded-2xl flex flex-col items-center justify-center min-h-[540px] relative overflow-hidden">
        <div className="absolute inset-0 shimmer" />
        <div className="text-center space-y-5 relative z-10">
          <div className="relative w-16 h-16 mx-auto">
            <div className="absolute inset-0 rounded-full grad-border" />
            <div className="absolute inset-1 rounded-full" style={{ background: "var(--surface)" }} />
            <div className="absolute inset-0 flex items-center justify-center text-2xl">✨</div>
          </div>
          <div className="space-y-1">
            <p className="text-white font-semibold">Personalizing your page…</p>
            <p className="text-white/30 text-xs">AI is analysing and rewriting</p>
          </div>
        </div>
      </div>
    );
  }

  const hasMock = changes && originalPage && adInsights;

  /* ── Done — shared header ── */
  const header = (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-400" />
        </span>
        <span className="text-sm font-semibold grad-text">Personalized Preview</span>
      </div>
      <div className="flex items-center gap-2">
        {hasMock && (
          <button
            onClick={() => setShowLive((v) => !v)}
            className="text-xs border px-3 py-1.5 rounded-lg transition-all"
            style={showLive
              ? { borderColor: "rgba(139,92,246,0.5)", color: "#c4b5fd", background: "rgba(124,58,237,0.12)" }
              : { borderColor: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.35)" }
            }>
            {showLive ? "◀ Copy Mockup" : "Live Preview ▶"}
          </button>
        )}
        {blobUrl && showLive && (
          <a href={blobUrl} target="_blank" rel="noopener noreferrer"
             className="text-xs text-purple-400 hover:text-purple-300 border border-purple-800/60 hover:border-purple-600 px-3 py-1.5 rounded-lg transition-all hover:shadow-[0_0_12px_rgba(139,92,246,0.3)]">
            Open full page ↗
          </a>
        )}
      </div>
    </div>
  );

  /* ── Done — mock view (default) ── */
  if (!showLive && hasMock) {
    return (
      <div className="space-y-3">
        {header}
        <MockPreview changes={changes} originalPage={originalPage} adInsights={adInsights} />
      </div>
    );
  }

  /* ── Done — live iframe view ── */
  return (
    <div className="space-y-3">
      {header}
      {showLive && (
        <div className="flex items-start gap-2 rounded-xl px-4 py-3 text-xs"
             style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.15)", color: "#fbbf24" }}>
          <span className="shrink-0 mt-0.5">⚡</span>
          <span>Live preview may appear blank for JS-heavy sites. Use <strong>Copy Mockup</strong> to see the changes clearly.</span>
        </div>
      )}

      <div className="rounded-2xl overflow-hidden"
           style={{ border: "1px solid rgba(139,92,246,0.25)", boxShadow: "0 0 40px rgba(139,92,246,0.1)" }}>
        {/* Browser chrome */}
        <div className="flex items-center gap-2 px-4 py-2.5"
             style={{ background: "rgba(13,13,26,0.95)", borderBottom: "1px solid rgba(139,92,246,0.15)" }}>
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/70" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
            <div className="w-3 h-3 rounded-full bg-green-500/70" />
          </div>
          <div className="flex-1 bg-white/5 rounded-md px-3 py-1 text-xs text-white/30 flex items-center gap-2 ml-2">
            <span>🔒</span><span>personalized-preview</span>
          </div>
          <div className="text-xs px-2 py-0.5 rounded-full text-purple-300 font-medium"
               style={{ background: "rgba(124,58,237,0.2)", border: "1px solid rgba(139,92,246,0.3)" }}>
            ✦ AI Personalized
          </div>
        </div>

        {blobUrl ? (
          <iframe ref={iframeRef} src={blobUrl} title="Personalized landing page"
            className="w-full bg-white" style={{ height: "560px" }}
            sandbox="allow-scripts allow-same-origin allow-forms" />
        ) : (
          <div className="h-32 flex items-center justify-center text-white/20 text-sm">Preview unavailable</div>
        )}
      </div>
    </div>
  );
}
