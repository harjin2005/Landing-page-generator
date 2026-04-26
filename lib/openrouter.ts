const BASE = "https://openrouter.ai/api/v1";

export const MODELS = {
  // Confirmed free vision models on OpenRouter — all raced concurrently
  vision: [
    process.env.VISION_MODEL ?? "qwen/qwen-2.5-vl-7b-instruct:free",
    "mistralai/pixtral-12b:free",
    "google/gemma-3-27b-it:free",
    "google/gemma-4-31b-it:free",
    "google/gemma-4-26b-a4b-it:free",
  ],
  text: [
    process.env.TEXT_MODEL ?? "meta-llama/llama-3.1-8b-instruct:free",
    "openai/gpt-oss-20b:free",
    "tencent/hy3-preview:free",
    "openai/gpt-oss-120b:free",
    "google/gemma-4-31b-it:free",
  ],
};

type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

type Message =
  | { role: "system"; content: string }
  | { role: "user"; content: string | ContentPart[] };

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function callOne(
  model: string,
  messages: Message[],
  maxTokens: number
): Promise<string | null> {
  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "https://troopod.vercel.app",
      "X-Title": "Troopod Ad Personalizer",
    },
    body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature: 0.2 }),
    signal: AbortSignal.timeout(18_000),
  });

  if (res.status === 429 || res.status === 502 || res.status === 503) return null;
  if (res.status === 400 || res.status === 404) return null; // bad model config — skip silently
  if (!res.ok) return null; // any other error — skip

  const data = await res.json();
  const msg = data.choices?.[0]?.message;
  if (msg?.content) return msg.content as string;

  // Reasoning models: pull JSON from reasoning trace
  if (msg?.reasoning) {
    const jsonBlock = (msg.reasoning as string).match(/\{[\s\S]+?\}/);
    if (jsonBlock) return jsonBlock[0];
  }

  return null;
}

/**
 * Race all models simultaneously — return the first non-null response.
 * Much faster than sequential: winner is whichever model responds first,
 * and diverse providers have separate rate-limit buckets.
 */
async function raceModels(
  models: string[],
  messages: Message[],
  maxTokens: number
): Promise<string | null> {
  return new Promise((resolve) => {
    let settled = false;
    let remaining = models.length;

    if (remaining === 0) { resolve(null); return; }

    models.forEach((model) => {
      callOne(model, messages, maxTokens)
        .then((result) => {
          remaining--;
          if (!settled && result) {
            settled = true;
            resolve(result);
          } else if (remaining === 0 && !settled) {
            resolve(null);
          }
        })
        .catch(() => {
          remaining--;
          if (remaining === 0 && !settled) resolve(null);
        });
    });
  });
}

/**
 * Race all models; if all fail, wait 4s and race once more.
 * With 5 diverse providers two rounds = 10 chances — nearly impossible to exhaust.
 */
export async function callModel(
  models: string[],
  messages: Message[],
  maxTokens = 400,
  _imageIsUrl = false // kept for API compat, no longer needed
): Promise<string> {
  const first = await raceModels(models, messages, maxTokens);
  if (first) return first;

  // All 5 failed — brief pause then one more race
  await sleep(4_000);
  const second = await raceModels(models, messages, maxTokens);
  if (second) return second;

  throw new Error(
    "AI models are currently busy (free tier rate limits). Please wait a moment and click Regenerate."
  );
}

/** Extract JSON from a model response that may include markdown fences. */
export function extractJSON<T = Record<string, string>>(text: string): T {
  try { return JSON.parse(text) as T; } catch {}

  const fenced = text.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
  if (fenced) { try { return JSON.parse(fenced[1]) as T; } catch {} }

  const block = text.match(/\{[\s\S]+\}/);
  if (block) { try { return JSON.parse(block[0]) as T; } catch {} }

  throw new Error("Could not parse model output. Please try again.");
}
