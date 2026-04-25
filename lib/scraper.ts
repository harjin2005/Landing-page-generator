import * as cheerio from "cheerio";

export interface PageData {
  url: string;
  title: string;
  metaDesc: string;
  h1: string;
  h2: string;
  ctaTexts: string[];
  bodySnippet: string;
  html: string;
}

export async function scrapePage(url: string): Promise<PageData> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5",
      "Accept-Encoding": "gzip, deflate, br",
      "Cache-Control": "no-cache",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
      "Sec-Fetch-Dest": "document",
      Pragma: "no-cache",
    },
    signal: AbortSignal.timeout(15_000),
    redirect: "follow",
  });

  if (!res.ok) throw new Error(`Page fetch failed (${res.status}). Check the URL.`);

  const raw = await res.text();
  const $ = cheerio.load(raw);

  // Inject base tag so relative URLs resolve correctly in the preview iframe
  const origin = new URL(url).origin;
  if ($("base").length === 0) {
    $("head").prepend(`<base href="${origin}">`);
  } else {
    $("base").attr("href", origin);
  }

  // Extract text-only version for the AI prompt (keep tokens low)
  const $text = cheerio.load(raw);
  $text("script, style, nav, footer, header, noscript, iframe, svg").remove();

  const ctaTexts: string[] = [];
  $text("button, a[class*='btn'], a[class*='cta'], [class*='cta'], [class*='button']").each(
    (_, el) => {
      const t = $text(el).text().trim();
      if (t && t.length < 80) ctaTexts.push(t);
    }
  );

  const bodySnippet = $text("body")
    .text()
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 800);

  return {
    url,
    title: $("title").text().trim().slice(0, 120),
    metaDesc: ($("meta[name='description']").attr("content") ?? "").slice(0, 200),
    h1: $("h1").first().text().trim().slice(0, 120),
    h2: $("h2").first().text().trim().slice(0, 120),
    ctaTexts: Array.from(new Set(ctaTexts)).slice(0, 4),
    bodySnippet,
    html: $.html(), // includes the injected base tag
  };
}
