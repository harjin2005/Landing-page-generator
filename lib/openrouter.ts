const BASE = "https://openrouter.ai/api/v1";

export const MODELS = {
  // All free vision models — widest net to beat rate limits
  // Gemma accept URLs + base64; NVIDIA base64 only (last resort)
  vision: [
    process.env.VISION_MODEL ?? "google/gemma-3-27b-it:free",
    "google/gemma-4-31b-it:free",
    "google/gemma-4-26b-a4b-it:free",
    "google/gemma-3-4b-it:free",
    "nvidia/nemotron-nano-12b-v2-vl:free", // base64 only — always last
  ],
  text: [
    process.env.TEXT_MODEL ?? "tencent/hy3-preview:free",
    "openai/gpt-oss-120b:free",
    "openai/gpt-oss-20b:free",
    "google/gemma-4-31b-it:free",
  ],
};

// Models that require base64 (cannot fetch remote URLs)
const BASE64_ONLY_MODELS = ["nvidia/nemotron-nano-12b-v2-vl:free"];

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
  maxTokens: number,
  imageIsUrl: boolean
): Promise<string | null> {
  // Skip base64-only models when we only have a URL
  if (imageIsUrl && BASE64_ONLY_MODELS.includes(model)) return null;

  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "https://troopod.vercel.app",
      "X-Title": "Troopod Ad Personalizer",
    },
    body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature: 0.2 }),
  });

  if (res.status === 429) {
    // Brief pause before caller tries next model
    await sleep(500);
    return null;
  }
  if (res.status === 502 || res.status === 503) return null;

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenRouter ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  const msg = data.choices?.[0]?.message;

  if (msg?.content) return msg.content as string;

  // Reasoning models (NVIDIA): extract JSON block from reasoning trace if content is null
  if (msg?.reasoning) {
    const jsonBlock = (msg.reasoning as string).match(/\{[\s\S]+?\}/);
    if (jsonBlock) return jsonBlock[0];
  }

  return null;
}

/** Call models in priority order, auto-skipping rate-limited and incompatible ones. */
export async function callModel(
  models: string[],
  messages: Message[],
  maxTokens = 400,
  imageIsUrl = false
): Promise<string> {
  const errors: string[] = [];

  for (const model of models) {
    try {
      const result = await callOne(model, messages, maxTokens, imageIsUrl);
      if (result) return result;
      errors.push(`${model}: rate limited or skipped`);
    } catch (err) {
      errors.push(`${model}: ${err instanceof Error ? err.message.slice(0, 80) : String(err)}`);
    }
  }

  throw new Error(`All models failed:\n${errors.join("\n")}`);
}

/** Extract JSON from a model response that may include markdown fences. */
export function extractJSON<T = Record<string, string>>(text: string): T {
  try {
    return JSON.parse(text) as T;
  } catch {}

  const fenced = text.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
  if (fenced) {
    try {
      return JSON.parse(fenced[1]) as T;
    } catch {}
  }

  const block = text.match(/\{[\s\S]+\}/);
  if (block) {
    try {
      return JSON.parse(block[0]) as T;
    } catch {}
  }

  throw new Error(`Could not parse JSON from model output: ${text.slice(0, 120)}`);
}
