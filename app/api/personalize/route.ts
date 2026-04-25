import { NextRequest, NextResponse } from "next/server";
import { callModel, extractJSON, MODELS } from "@/lib/openrouter";
import { scrapePage } from "@/lib/scraper";
import { injectChanges, Changes } from "@/lib/injector";

export const maxDuration = 120;

interface AdInsights {
  headline: string;
  value_prop: string;
  offer: string;
  cta: string;
  tone: string;
  target_audience: string;
}

/**
 * Google Images search result URLs contain the real image in the `imgurl` param.
 * Detect and unwrap them before doing anything else.
 */
function extractRealImageUrl(raw: string): string {
  try {
    const u = new URL(raw);
    // google.com/imgres?imgurl=...
    if (u.hostname.includes("google.") && u.pathname.includes("imgres")) {
      const imgurl = u.searchParams.get("imgurl");
      if (imgurl) return decodeURIComponent(imgurl);
    }
    // google.com/search?q=...&tbm=isch — not a direct image
    if (u.hostname.includes("google.") && u.searchParams.get("tbm") === "isch") {
      throw new Error(
        "That is a Google Images search page, not a direct image URL. " +
          "Right-click an image on Google → 'Copy image address' and paste that instead."
      );
    }
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("That is")) throw e;
    // URL parse failed — return as-is
  }
  return raw;
}

/**
 * Try to convert a remote image URL to base64 data URL.
 * Returns null if the image cannot be fetched (blocked, 404, etc.)
 */
async function tryFetchBase64(url: string): Promise<string | null> {
  const origin = new URL(url).origin;
  const attempts: Record<string, string>[] = [
    {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
      Accept: "image/webp,image/apng,image/*,*/*;q=0.8",
      Referer: origin,
    },
    { "User-Agent": "Mozilla/5.0" },
  ];

  for (const headers of attempts) {
    try {
      const res = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(8_000),
        redirect: "follow",
      });
      if (!res.ok) continue;
      const ct = res.headers.get("content-type") ?? "";
      if (!ct.startsWith("image/")) continue;
      const buf = await res.arrayBuffer();
      return `data:${ct};base64,${Buffer.from(buf).toString("base64")}`;
    } catch {
      continue;
    }
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const { adUrl: rawAdUrl, adBase64, pageUrl } = await req.json();
    // Unwrap Google Images search URLs → extract the real image URL
    const adUrl: string | undefined = rawAdUrl ? extractRealImageUrl(rawAdUrl) : undefined;

    if (!pageUrl) return NextResponse.json({ error: "pageUrl is required" }, { status: 400 });
    if (!adUrl && !adBase64)
      return NextResponse.json({ error: "Ad creative (URL or upload) is required" }, { status: 400 });

    // ── Step 1: Scrape the landing page ──────────────────────────────────
    const pageData = await scrapePage(pageUrl);

    // ── Step 2: Resolve image source ─────────────────────────────────────
    // Priority: uploaded base64 → server-fetched base64 → raw URL (Gemma only)
    let imageSource: string;
    let imageIsUrl = false;

    if (adBase64) {
      imageSource = adBase64;
    } else {
      // adUrl is guaranteed non-empty here (validated above)
      const url = adUrl as string;
      const base64 = await tryFetchBase64(url);
      if (base64) {
        imageSource = base64;
      } else {
        imageSource = url;
        imageIsUrl = true;
      }
    }

    // ── Step 3: Analyze ad creative (vision model) ───────────────────────
    const adRaw = await callModel(
      MODELS.vision,
      [
        {
          role: "system",
          content:
            'You are an ad analyst. Analyze the ad image and return ONLY valid JSON: {"headline":"","value_prop":"","offer":"","cta":"","tone":"","target_audience":""}',
        },
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: imageSource } },
            { type: "text", text: "Extract the ad elements. Return JSON only." },
          ],
        },
      ],
      800,
      imageIsUrl // tells callModel to skip base64-only models (NVIDIA)
    );

    const adInsights = extractJSON<AdInsights>(adRaw);

    // ── Step 4: Generate personalized page copy (text model) ─────────────
    const pageContext = [
      `title: "${pageData.title}"`,
      `h1: "${pageData.h1}"`,
      `h2: "${pageData.h2}"`,
      `cta: "${pageData.ctaTexts[0] ?? ""}"`,
      `meta: "${pageData.metaDesc}"`,
    ].join("\n");

    const adContext = [
      `headline: "${adInsights.headline}"`,
      `value_prop: "${adInsights.value_prop}"`,
      `offer: "${adInsights.offer}"`,
      `tone: "${adInsights.tone}"`,
      `audience: "${adInsights.target_audience}"`,
    ].join("\n");

    const changesRaw = await callModel(
      MODELS.text,
      [
        {
          role: "system",
          content: `You are a CRO specialist. Rewrite landing page copy to align with the ad creative.
Rules:
- Maintain message match between ad and page (same offer, same hook)
- Use action verbs, benefit-first language
- Keep headlines under 12 words
- Never change the brand name or product name
- Return ONLY valid JSON: {"title":"","metaDesc":"","h1":"","h2":"","cta":""}`,
        },
        {
          role: "user",
          content: `AD:\n${adContext}\n\nCURRENT PAGE:\n${pageContext}\n\nReturn personalized JSON only.`,
        },
      ],
      320
    );

    const changes = extractJSON<Changes>(changesRaw);

    // ── Step 5: Inject changes into the page HTML ─────────────────────────
    const modifiedHtml = injectChanges(pageData.html, changes);

    return NextResponse.json({
      adInsights,
      changes,
      originalPage: {
        title: pageData.title,
        metaDesc: pageData.metaDesc,
        h1: pageData.h1,
        h2: pageData.h2,
        cta: pageData.ctaTexts[0] ?? "",
      },
      modifiedHtml,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    console.error("[personalize]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
