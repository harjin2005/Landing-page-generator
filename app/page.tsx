"use client";

import { useState } from "react";
import AdInput from "@/components/AdInput";
import StepIndicator from "@/components/StepIndicator";
import PreviewPanel from "@/components/PreviewPanel";

type Step = "idle" | "scraping" | "analyzing" | "personalizing" | "done" | "error";

interface AdInsights { headline?: string; value_prop?: string; offer?: string; cta?: string; tone?: string; target_audience?: string; }
interface Changes { title?: string; metaDesc?: string; h1?: string; h2?: string; cta?: string; }
interface OriginalPage { title: string; metaDesc: string; h1: string; h2: string; cta: string; }
interface Result { adInsights: AdInsights; changes: Changes; originalPage: OriginalPage; modifiedHtml: string; }

const FIELD_LABELS: Record<string, string> = {
  title: "Page Title", metaDesc: "Meta Description",
  h1: "Hero Headline", h2: "Sub-headline", cta: "CTA Button",
};

export default function Home() {
  const [adUrl, setAdUrl] = useState("");
  const [adFile, setAdFile] = useState<File | null>(null);
  const [adBase64FromUrl, setAdBase64FromUrl] = useState<string | null>(null);
  const [pageUrl, setPageUrl] = useState("");
  const [step, setStep] = useState<Step>("idle");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");

  const canGenerate =
    (adUrl.trim() || adFile) &&
    pageUrl.trim() &&
    (step === "idle" || step === "done" || step === "error");

  async function handleGenerate() {
    if (!canGenerate) return;
    setStep("scraping");
    setError("");
    setResult(null);

    try {
      let adBase64: string | undefined;

      if (adFile) {
        await new Promise<void>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => { adBase64 = reader.result as string; resolve(); };
          reader.readAsDataURL(adFile);
        });
      } else if (adBase64FromUrl) {
        adBase64 = adBase64FromUrl;
      }

      setStep("analyzing");
      const res = await fetch("/api/personalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adUrl: adBase64 ? undefined : adUrl.trim() || undefined,
          adBase64,
          pageUrl: pageUrl.trim(),
        }),
      });

      setStep("personalizing");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      setResult(data as Result);
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setStep("error");
    }
  }

  const isRunning = step !== "idle" && step !== "done" && step !== "error";

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>

      {/* ── Ambient background orbs ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full opacity-20"
             style={{ background: "radial-gradient(circle, #7c3aed, transparent 70%)", filter: "blur(80px)" }} />
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full opacity-15"
             style={{ background: "radial-gradient(circle, #ec4899, transparent 70%)", filter: "blur(80px)" }} />
        <div className="absolute top-[40%] right-[20%] w-[300px] h-[300px] rounded-full opacity-10"
             style={{ background: "radial-gradient(circle, #06b6d4, transparent 70%)", filter: "blur(60px)" }} />
      </div>

      <div className="relative z-10">
        {/* ── Header ── */}
        <header className="px-6 py-4 flex items-center gap-3 sticky top-0 z-20"
                style={{ background: "rgba(4,4,10,0.85)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(139,92,246,0.15)" }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm select-none"
               style={{ background: "linear-gradient(135deg, #7c3aed, #ec4899)", boxShadow: "0 0 16px rgba(124,58,237,0.5)" }}>
            T
          </div>
          <span className="font-bold text-white text-sm tracking-wide">Troopod</span>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs font-medium px-3 py-1 rounded-full"
                  style={{ background: "rgba(124,58,237,0.15)", border: "1px solid rgba(139,92,246,0.3)", color: "#c4b5fd" }}>
              ✦ AI Ad Personalizer
            </span>
          </div>
        </header>

        {/* ── Hero ── */}
        <div className="text-center pt-12 pb-8 px-4">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-6 text-xs font-semibold"
               style={{ background: "rgba(124,58,237,0.1)", border: "1px solid rgba(139,92,246,0.25)", color: "#a78bfa" }}>
            <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-pulse" />
            Powered by Multi-Model AI Pipeline
          </div>
          <h1 className="text-4xl sm:text-5xl font-black mb-3 leading-tight">
            <span className="text-white">Turn Any Ad Into a </span>
            <span className="grad-text">Converting Page</span>
          </h1>
          <p className="text-white/40 text-base max-w-xl mx-auto">
            Paste your ad creative + landing page URL. AI rewrites your page copy to match the ad — same design, smarter message.
          </p>
        </div>

        {/* ── Main grid ── */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-16 grid grid-cols-1 lg:grid-cols-[440px_1fr] gap-6 items-start">

          {/* ── Left: Input panel ── */}
          <div className="space-y-4">
            <div className="glow-card rounded-2xl p-5 space-y-5">

              {/* Ad Creative */}
              <AdInput
                adUrl={adUrl} setAdUrl={setAdUrl}
                adFile={adFile} setAdFile={setAdFile}
                setAdBase64FromUrl={setAdBase64FromUrl}
              />

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px" style={{ background: "rgba(139,92,246,0.15)" }} />
                <span className="text-xs text-white/20">then</span>
                <div className="flex-1 h-px" style={{ background: "rgba(139,92,246,0.15)" }} />
              </div>

              {/* Landing Page URL */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-white/70">Landing Page URL</label>
                <input
                  type="url" value={pageUrl}
                  onChange={(e) => setPageUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
                  placeholder="https://yoursite.com/landing"
                  className="magic-input w-full rounded-xl px-4 py-3 text-sm"
                />
              </div>

              {/* Generate button */}
              <button onClick={handleGenerate} disabled={!canGenerate}
                      className="grad-btn w-full text-white font-bold py-3.5 rounded-xl text-sm tracking-wide">
                {isRunning ? "✨ Generating…" : result ? "↺ Regenerate" : "✦ Generate Personalized Page"}
              </button>
            </div>

            {/* Step indicator */}
            {step !== "idle" && <StepIndicator step={step} />}

            {/* Error */}
            {step === "error" && error && (
              <div className="rounded-xl p-4 space-y-2"
                   style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}>
                <strong className="block text-sm text-red-400">
                  {error.includes("busy") || error.includes("rate limit") || error.includes("All models")
                    ? "⏳ AI models are busy right now"
                    : "⚠ Something went wrong"}
                </strong>
                <p className="text-xs text-red-300/70 leading-relaxed">
                  {error.includes("busy") || error.includes("rate limit") || error.includes("All models")
                    ? "Free-tier AI servers are under heavy load. Click ↺ Regenerate to try again — it usually works on the second attempt."
                    : error}
                </p>
              </div>
            )}

            {/* Results */}
            {result && (
              <div className="space-y-4">
                {/* Ad Insights */}
                <div className="glow-card rounded-2xl p-4 space-y-3">
                  <p className="text-xs font-bold text-purple-400 uppercase tracking-widest flex items-center gap-1.5">
                    <span>🔍</span> Ad Insights Extracted
                  </p>
                  <div className="space-y-2">
                    {Object.entries(result.adInsights).filter(([,v]) => v).map(([key, val]) => (
                      <div key={key} className="flex gap-3 text-xs">
                        <span className="text-white/30 capitalize shrink-0 w-28">{key.replace(/_/g," ")}</span>
                        <span className="text-white/70 leading-relaxed">{val}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Before / After */}
                <div className="rounded-2xl p-4 space-y-4"
                     style={{ background: "rgba(13,13,26,0.8)", border: "1px solid rgba(139,92,246,0.25)" }}>
                  <p className="text-xs font-bold uppercase tracking-widest flex items-center gap-1.5"
                     style={{ color: "#a78bfa" }}>
                    <span>✏️</span> Changes Applied
                  </p>
                  {Object.entries(result.changes).filter(([,v]) => v).map(([key, newVal]) => {
                    const oldVal = (result.originalPage as unknown as Record<string,string>)[key];
                    return (
                      <div key={key} className="space-y-1 pb-3 border-b border-white/5 last:border-0 last:pb-0">
                        <p className="text-xs font-semibold" style={{ color: "#c4b5fd" }}>
                          {FIELD_LABELS[key] ?? key}
                        </p>
                        {oldVal && (
                          <p className="text-xs text-red-400/60 line-through leading-relaxed">{oldVal}</p>
                        )}
                        <p className="text-xs text-emerald-400 leading-relaxed">{newVal}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ── Right: Preview ── */}
          <div className="lg:sticky lg:top-[73px]">
            <PreviewPanel
                modifiedHtml={result?.modifiedHtml}
                step={step}
                changes={result?.changes}
                originalPage={result?.originalPage}
                adInsights={result?.adInsights}
              />
          </div>
        </div>

        {/* ── Footer ── */}
        <footer className="px-6 py-8" style={{ borderTop: "1px solid rgba(139,92,246,0.12)" }}>
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs"
                   style={{ background: "linear-gradient(135deg,#7c3aed,#ec4899)" }}>T</div>
              <span className="font-bold text-white/50 text-sm">Troopod Ad Personalizer</span>
            </div>
            <div className="space-y-1 text-xs text-white/30">
              <p><span className="text-white/50 font-medium">Owner:</span> Harjinder Singh</p>
              <p>
                <span className="text-white/50 font-medium">Phone:</span>{" "}
                <a href="tel:+919971649275" className="hover:text-purple-400 transition-colors">+91 99716 49275</a>
              </p>
              <p>
                <span className="text-white/50 font-medium">Email:</span>{" "}
                <a href="mailto:harjins2005@gmail.com" className="hover:text-purple-400 transition-colors">harjins2005@gmail.com</a>
              </p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
