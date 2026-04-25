const BASE = "https://openrouter.ai/api/v1";

export const MODELS = {
  // Confirmed free vision models on OpenRouter — smallest/fastest first
  vision: [
    process.env.VISION_MODEL ?? "qwen/qwen-2.5-vl-7b-instruct:free", // 7B — fastest
    "mistralai/pixtral-12b:free",                                      // 12B
    "google/gemma-3-27b-it:free",                                      // 27B
    "google/gemma-4-31b-it:free",                                      // 31B
    "google/gemma-4-26b-a4b-it:free",                                  // 26B MoE
  ],
  text: [
    process.env.TEXT_MODEL ?? "meta-llama/llama-3.1-8b-instruct:free", // 8B — fastest
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
  maxTokens: number,
  imageIsUrl: boolean
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

  // Treat rate limits and temporary errors as "skip to next model"
  if (res.status === 429 || res.status === 502 || res.status === 503) {
    await sleep(300);
    return null;
  }

  if (!res.ok) {
    const body = await res.text();
    // 400/404 = model config issue — skip silently
    if (res.status === 400 || res.status === 404) return null;
    throw new Error(`OpenRouter ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  const msg = data.choices?.[0]?.message;

  if (msg?.content) return msg.content as string;

  // Reasoning models: extract JSON block from reasoning trace
  if (msg?.reasoning) {
    const jsonBlock = (msg.reasoning as string).match(/\{[\s\S]+?\}/);
    if (jsonBlock) return jsonBlock[0];
  }

  return null;
}

/** Try all models in order; if all fail, pause 3s and try the top 2 once more. */
export async function callModel(
  models: string[],
  messages: Message[],
  maxTokens = 400,
  imageIsUrl = false
): Promise<string> {
  // First pass — try every model
  for (const model of models) {
    try {
      const result = await callOne(model, messages, maxTokens, imageIsUrl);
      if (result) return result;
    } catch {
      // continue
    }
  }

  // Second pass — models may have just been momentarily busy; wait and retry top 2
  await sleep(3_000);
  for (const model of models.slice(0, 2)) {
    try {
      const result = await callOne(model, messages, maxTokens, imageIsUrl);
      if (result) return result;
    } catch {
      // continue
    }
  }

  throw new Error(
    "AI models are currently busy (free tier rate limits). Please wait a few seconds and try again."
  );
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

  throw new Error(`Could not parse model output. Please try again.`);
}
