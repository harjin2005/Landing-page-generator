# AI PM Assignment — Troopod
### Submitted by: Harjinder Singh
**Live Demo:** https://troopod-personalizer-psi.vercel.app
**Email:** harjins2005@gmail.com | **Phone:** +91 99716 49275

---

## What I Built

A lightweight AI workflow that takes an **ad creative** (image URL or upload) and a **landing page URL**, then automatically rewrites the page's copy to align with the ad — applying CRO (Conversion Rate Optimization) principles. The existing page design stays intact; only the messaging changes.

**The core problem it solves:**
When a user clicks an ad promising "50% off fitness plans today" and lands on a generic "Welcome to FitPro" page, there's a *message mismatch*. That mismatch kills conversions. This tool closes that gap automatically — no designer, no developer, no manual copywriting.

---

## How the System Works — Flow

```
User inputs:
  ├── Ad Creative (image URL or file upload)
  └── Landing Page URL
          │
          ▼
  ┌─────────────────────────────┐
  │  Step 1: Page Scraping      │
  │  Fetch landing page HTML    │
  │  Extract: H1, H2, CTA,      │
  │  title, meta description    │
  └────────────┬────────────────┘
               │
          ▼
  ┌─────────────────────────────┐
  │  Step 2: Ad Analysis        │
  │  Vision model reads ad      │
  │  Extracts: headline,        │
  │  offer, tone, CTA,          │
  │  value prop, audience       │
  └────────────┬────────────────┘
               │
          ▼
  ┌─────────────────────────────┐
  │  Step 3: CRO Rewrite        │
  │  Language model rewrites    │
  │  page copy to match ad      │
  │  Applies CRO principles:    │
  │  - Message match            │
  │  - Benefit-first language   │
  │  - Action-oriented CTAs     │
  └────────────┬────────────────┘
               │
          ▼
  ┌─────────────────────────────┐
  │  Step 4: Inject + Preview   │
  │  Changes injected into      │
  │  original page HTML         │
  │  Live preview shown         │
  │  Before/after diff shown    │
  └─────────────────────────────┘
```

**Important:** The output is the *same existing page* with smarter copy — not a new page. Brand identity, layout, images, and design are all preserved.

---

## Key Components

### 1. Page Scraper
Built using `cheerio` (server-side HTML parser). It fetches the landing page and extracts only the high-impact text elements:
- Page title and meta description
- Hero headline (H1)
- Sub-headline (H2)
- CTA button text

It also injects a `<base>` tag pointing back to the original domain, so all images, CSS, and fonts still load correctly in the preview.

**Why not scrape everything?** Keeping the input small reduces AI token usage and speeds up the response. Only the elements that affect conversions are extracted.

### 2. Vision Agent (Ad Analyzer)
A multimodal AI model reads the ad image and extracts structured information:

```
Input:  Ad creative image
Output: {
  "headline": "Get Fit in 30 Days",
  "value_prop": "Science-backed training plans",
  "offer": "50% off first month",
  "cta": "Start Free Trial",
  "tone": "motivational, urgent",
  "target_audience": "busy professionals aged 25-40"
}
```

I used **OpenRouter's free model tier** and designed a fallback chain across multiple vision models so the system stays live even when individual models are rate-limited. The primary model is Google Gemma (fast), with NVIDIA Nemotron VL as a reliable fallback.

### 3. CRO Rewrite Agent (Content Personalizer)
A language model takes the ad insights + current page copy and rewrites only the messaging layer:

```
Input:  Ad insights + current page {H1, H2, CTA, title, meta}
Output: {
  "h1": "Get Fit in 30 Days — Built Around Your Schedule",
  "h2": "Science-backed plans, now 50% off for new members",
  "cta": "Claim Your 50% Discount",
  "title": "FitPro — 50% Off Today | 30-Day Fitness Plans",
  "metaDesc": "Join 100,000+ members. Get a science-backed fitness plan at 50% off."
}
```

**CRO principles applied:**
- **Message match** — page headline mirrors the ad promise
- **Benefit-first language** — lead with what the user gets, not what the product is
- **Urgency preservation** — if the ad has "today only", the page reflects it
- **Brand name protection** — the model is instructed never to change product/brand names

### 4. HTML Injector
A whitelist-based injection system that surgically replaces text in specific elements only (`h1`, `h2`, `title`, `meta`, first CTA button). It does not touch the page structure, CSS, or images.

A "Personalized for this campaign" badge is added as a fixed overlay — non-intrusive, purely for demo visibility.

### 5. Preview Layer
The modified HTML is returned to the browser and rendered in a sandboxed iframe using a Blob URL. Users can also open the personalized page in a new tab. A before/after diff panel shows exactly what changed and why.

---

## Agent Design

I intentionally kept this as a **2-agent pipeline** rather than a complex multi-agent system. Here's why:

| Approach | Why I chose / rejected |
|---|---|
| Single agent for everything | Rejected — one model can't reliably do vision + CRO rewriting at high quality |
| 2-agent pipeline (vision → text) | **Chosen** — clean separation of concerns, easy to debug, faster |
| 4+ agent orchestration | Overkill for this scope — adds latency and failure points with no clear upside |

**Agent 1 — Vision:** Specialized in reading images. Returns structured JSON. No page context needed.

**Agent 2 — CRO Writer:** Specialized in persuasive copywriting. Gets structured ad data + page data. No image access needed.

Both agents output strict JSON, which makes the system deterministic and easy to validate.

---

## How I Handle Edge Cases

### Random Changes
**Problem:** AI might change things we don't want changed — brand name, page structure, legal copy.

**Solution:** Whitelist-based injection. The injector only touches 5 specific elements. Everything else is untouched. Additionally, the CRO agent prompt explicitly states: *"Never change the brand name or product name."*

### Broken UI / Preview
**Problem:** Scraped page HTML has relative URLs that break when rendered outside the original domain.

**Solution:** A `<base href="https://original-domain.com">` tag is injected into the page `<head>` before previewing. This tells the browser to resolve all relative paths against the original domain — images, CSS, fonts, and JS all load correctly.

### Hallucinations
**Problem:** AI invents offers, prices, or claims that don't exist in the ad.

**Three-layer defence:**
1. **Grounded input** — the model only sees real text extracted from the actual ad, not a description of it
2. **Length constraints** — all outputs are capped at 12 words per headline, preventing verbose fabrication
3. **Sanitization** — before any text is injected into the HTML, it's stripped of HTML tags and special characters

### Inconsistent Outputs
**Problem:** Free models at temperature 1.0 produce different results on every run.

**Solution:**
1. Temperature set to **0.2** across all model calls — near-deterministic outputs
2. Strict JSON schema enforced in every system prompt
3. A multi-strategy JSON parser (`extractJSON`) handles responses even when models wrap output in markdown code fences or add extra commentary — it tries 3 parsing strategies before failing

---

## Technology Decisions

| Decision | What I chose | Why |
|---|---|---|
| Frontend | Next.js 14 | Fast to deploy, built-in API routes, Vercel-native |
| Page scraping | Cheerio (server-side) | Lightweight, no browser overhead, no Puppeteer complexity |
| AI models | OpenRouter free tier | Zero cost, model fallback chain, no API key purchase needed |
| Vision model | Google Gemma 3/4 → NVIDIA VL fallback | Gemma is fast; NVIDIA is reliable backup |
| Text model | Tencent Hy3 → GPT-OSS fallback | Hy3 has 111B free weekly tokens |
| Deployment | Vercel | One command deploy, 120s function timeout for slow model calls |
| Preview method | Blob URL iframe | No storage needed, works instantly, shareable via new tab |

---

## Assumptions Made

1. **Ad creative = image** — I assumed the primary ad format is a static image (banner, social, display). Video ad support would require a different extraction approach.

2. **Landing page is publicly accessible** — pages behind login walls or paywalls cannot be scraped. This is an acceptable constraint for a demo.

3. **CRO = copy changes only** — I scoped personalization to messaging, not layout or images. Full dynamic landing page generation is a larger problem that would require a page builder integration.

4. **Free models are sufficient for demo quality** — the output quality from Gemma and Hy3 is strong enough to demonstrate the concept, even if a paid model would be more consistent at scale.

---

## What I'd Build Next (if given more time)

- **A/B test integration** — automatically generate 2–3 variants of the personalized copy and route traffic to compare conversion rates
- **Google Ads / Meta Ads API integration** — pull ad creatives directly from ad accounts instead of manual URL input
- **Analytics overlay** — show which page elements have the highest predicted CRO impact based on heatmap data
- **Saved sessions** — let teams save and compare personalized versions across campaigns
