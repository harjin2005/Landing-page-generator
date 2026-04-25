type Step = "idle" | "scraping" | "analyzing" | "personalizing" | "done" | "error";

const STEPS: { id: Step; label: string; icon: string }[] = [
  { id: "scraping",     label: "Scraping page",   icon: "⚡" },
  { id: "analyzing",   label: "Reading ad",       icon: "🔍" },
  { id: "personalizing", label: "Rewriting copy", icon: "✏️" },
  { id: "done",        label: "Done",             icon: "🎉" },
];

export default function StepIndicator({ step }: { step: Step }) {
  const activeIdx = STEPS.findIndex((s) => s.id === step);

  return (
    <div className="rounded-xl p-4 glow-card space-y-3">
      <p className="text-xs font-semibold text-purple-400 uppercase tracking-widest">Processing</p>
      <div className="flex items-center gap-1">
        {STEPS.map((s, i) => {
          const done  = step === "done" || (activeIdx > i && step !== "error");
          const active = s.id === step && step !== "done";

          return (
            <div key={s.id} className="flex items-center gap-1 flex-1">
              <div
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-300 flex-1 justify-center ${
                  done
                    ? "bg-purple-900/40 border border-purple-600/40 text-purple-300"
                    : active
                    ? "bg-purple-600/20 border border-purple-500/60 text-white"
                    : "bg-transparent border border-white/5 text-white/20"
                }`}
                style={active ? { animation: "pulseGlow 2s infinite" } : {}}
              >
                {active ? (
                  <span className="w-3 h-3 border-2 border-purple-400 border-t-transparent rounded-full animate-spin inline-block shrink-0" />
                ) : (
                  <span>{s.icon}</span>
                )}
                <span className="hidden sm:inline">{s.label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`w-3 h-px shrink-0 transition-colors duration-500 ${done ? "bg-purple-600" : "bg-white/10"}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
