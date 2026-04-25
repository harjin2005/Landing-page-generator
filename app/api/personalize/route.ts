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

function extractRealImageUrl(raw: string): string {
  try {
    const u = new URL(raw);
    if (u.hostname.includes("google.") && u.pathname.includes("imgres")) {
      const imgurl = u.searchParams.get("imgurl");
      if (imgurl) return decodeURIComponent(imgurl);
    }
    if (u.hostname.includes("google.") && u.searchParams.get("tbm") === "isch") {
      throw new Error(
        "That is a Google Images search page, not a direct image URL. " +
          "Right-click an image → 'Copy image address' and paste that instead."
      );
    }
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("That is")) throw e;
  }
  return raw;
}

async function tryFetchBase64(url: string): Promise<string | null> {
  const origin = new URL(url).origin;
  const attempts: Record<string, string>[] = [
    {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
      Accept: "image/webp,image/apng,image/*,*/*;q=0.8",
      Referer: origin,
    },
    { "User-Agent": "Mozilla/5.0" },
  ];

  for (const headers of attempts) {
    try {
      const res = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(4_000), // reduced: 4s per attempt (was 8s)
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

function buildVisionMessages(imageSource: string) {
  return [
    {
      role: "system" as const,
      content: 'You are an ad analyst. Return ONLY valid JSON: {"headline":"","value_prop":"","offer":"","cta":"","tone":"","target_audience":""}',
    },
    {
      role: "user" as const,
      content: [
        { type: "image_url" as const, image_url: { url: imageSource } },
        { type: "text" as const, text: "Analyze this ad. Return JSON only." },
      ],
    },
  ];
}

export async function POST(req: NextRequest) {
  try {
    const { adUrl: rawAdUrl, adBase64, pageUrl } = await req.json();
    const adUrl: string | undefined = rawAdUrl ? extractRealImageUrl(rawAdUrl) : undefined;

    if (!pageUrl) return NextResponse.json({ error: "pageUrl is required" }, { status: 400 });
    if (!adUrl && !adBase64)
      return NextResponse.json({ error: "Ad creative (URL or upload) is required" }, { status: 400 });

    let adRaw: string;
    let pageData: Awaited<ReturnType<typeof scrapePage>>;

    if (adBase64) {
      // ── Fast path: base64 already available → scrape + vision in parallel ──
      [pageData, adRaw] = await Promise.all([
        scrapePage(pageUrl),
        callModel(MODELS.vision, buildVisionMessages(adBase64), 400, false),
      ]);
    } else {
      // ── URL path: resolve image, then scrape + vision in parallel ──────────
      const url = adUrl as string;
      const [base64, scrapeResult] = await Promise.all([
        tryFetchBase64(url),
        scrapePage(pageUrl),
      ]);
      pageData = scrapeResult;

      const imageSource = base64 ?? url;
      const imageIsUrl = !base64;
      adRaw = await callModel(MODELS.vision, buildVisionMessages(imageSource), 400, imageIsUrl);
    }

    const adInsights = extractJSON<AdInsights>(adRaw);

    // ── Text rewrite (needs both scrape + vision results) ────────────────────
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
