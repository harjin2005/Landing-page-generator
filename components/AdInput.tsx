"use client";

import { useRef, useState, useCallback } from "react";

interface Props {
  adUrl: string;
  setAdUrl: (v: string) => void;
  adFile: File | null;
  setAdFile: (f: File | null) => void;
  // base64 converted client-side from URL — sent to API instead of raw URL when available
  setAdBase64FromUrl: (b: string | null) => void;
}

/** Load image URL in-browser via canvas → base64. Works for images with CORS headers.
 *  Falls back gracefully (returns null) for blocked/no-CORS images. */
function urlToBase64(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    const timer = setTimeout(() => resolve(null), 8000);
    img.onload = () => {
      clearTimeout(timer);
      try {
        const canvas = document.createElement("canvas");
        // Cap at 1200px to avoid huge payloads
        const scale = Math.min(1, 1200 / Math.max(img.width, img.height));
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      } catch {
        resolve(null); // CORS tainted canvas
      }
    };
    img.onerror = () => { clearTimeout(timer); resolve(null); };
    img.src = url;
  });
}

export default function AdInput({ adUrl, setAdUrl, adFile, setAdFile, setAdBase64FromUrl }: Props) {
  const [tab, setTab] = useState<"url" | "upload">("url");
  const [preview, setPreview] = useState("");
  const [urlStatus, setUrlStatus] = useState<"idle" | "loading" | "ok" | "warn">("idle");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUrlChange = useCallback(
    async (raw: string) => {
      setAdUrl(raw);
      setAdFile(null);
      setAdBase64FromUrl(null);
      setPreview("");

      if (!raw.trim()) { setUrlStatus("idle"); return; }

      setUrlStatus("loading");

      // Try converting to base64 in the browser first
      const b64 = await urlToBase64(raw);
      if (b64) {
        setAdBase64FromUrl(b64);
        setPreview(b64);
        setUrlStatus("ok");
      } else {
        // Couldn't convert — will send URL to API and let the vision model fetch it
        setPreview(raw); // still show img tag for display
        setAdBase64FromUrl(null);
        setUrlStatus("warn");
      }
    },
    [setAdUrl, setAdFile, setAdBase64FromUrl]
  );

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4_000_000) {
      alert("Image too large. Please use an image under 4 MB.");
      return;
    }
    setAdFile(file);
    setAdUrl("");
    setAdBase64FromUrl(null);
    const reader = new FileReader();
    reader.onloadend = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
    setUrlStatus("idle");
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-300">Ad Creative</label>

      <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-lg p-1 w-fit">
        {(["url", "upload"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              tab === t ? "bg-indigo-600 text-white" : "text-gray-500 hover:text-gray-300"
            }`}
          >
            {t === "url" ? "Image URL" : "Upload File"}
          </button>
        ))}
      </div>

      {tab === "url" ? (
        <div className="space-y-2">
          <div className="relative">
            <input
              type="text"
              value={adUrl}
              onChange={(e) => handleUrlChange(e.target.value)}
              placeholder="Paste any image URL here"
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 pr-10 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors"
            />
            {/* status indicator */}
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {urlStatus === "loading" && (
                <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              )}
              {urlStatus === "ok" && <span className="text-green-400 text-sm">✓</span>}
              {urlStatus === "warn" && <span className="text-yellow-400 text-sm">!</span>}
            </div>
          </div>

          {/* status message */}
          {urlStatus === "ok" && (
            <p className="text-xs text-green-500">Image loaded — ready to analyse</p>
          )}
          {urlStatus === "warn" && (
            <p className="text-xs text-yellow-500">
              Could not preview — will send URL directly to AI. If it fails, use Upload File.
            </p>
          )}

          {/* image preview */}
          {preview && (
            <img
              src={preview}
              alt="Ad preview"
              className="max-h-32 rounded-lg object-contain border border-gray-700"
              onError={() => setUrlStatus("warn")}
            />
          )}

          <p className="text-xs text-gray-600">
            Tip: right-click any image on Google → &quot;Open image in new tab&quot; → copy that URL
          </p>
        </div>
      ) : (
        <div
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-gray-700 hover:border-indigo-600 rounded-lg p-5 text-center cursor-pointer transition-colors group"
        >
          {preview && adFile ? (
            <div className="space-y-2">
              <img src={preview} alt="Ad preview" className="max-h-28 mx-auto rounded-lg object-contain" />
              <p className="text-xs text-gray-500">{adFile.name}</p>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="text-2xl text-gray-600 group-hover:text-indigo-400 transition-colors">↑</div>
              <p className="text-sm text-gray-500">Click to upload ad creative</p>
              <p className="text-xs text-gray-700">PNG, JPG, GIF · max 4 MB</p>
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
        </div>
      )}
    </div>
  );
}
