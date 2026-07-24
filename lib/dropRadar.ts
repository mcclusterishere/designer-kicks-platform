import { prisma } from "./db";
import { geminiConfigured, geminiJson } from "./gemini";
import { formatUsd } from "./market";

/**
 * Drop Radar — automated retail-drop coverage.
 *
 * Turns real releases in the catalog (dated, imaged, priced by the KicksDB
 * sync) into full draft articles so the newsroom + drop calendar stay
 * current with zero manual writing. The split that keeps it honest: the
 * hard facts — release date, style code, retail — come straight from the
 * database and are rendered from the DB, never from the model. Gemini
 * writes ONLY the narrative and a culture question. Everything lands as a
 * DRAFT; an editor reviews and one-tap publishes, so nothing unverified
 * goes live on its own.
 */

const DAY = 24 * 60 * 60 * 1000;

type DraftShape = {
  angle: string;
  story: string[];
  deep?: string[];
  question?: { q: string; options: string[]; answer: number; explain: string };
};

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/['"’.]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

function brandLaunchUrl(brand: string | null): string | null {
  const b = (brand || "").toLowerCase();
  if (b.includes("jordan") || b.includes("nike")) return "https://www.nike.com/launch";
  if (b.includes("adidas") || b.includes("yeezy")) return "https://www.adidas.com/us/release-dates";
  if (b.includes("new balance")) return "https://www.newbalance.com/release-dates/";
  return null;
}

export type DropRadarResult = {
  configured: boolean;
  scanned: number;
  drafted: number;
  skipped: number;
};

export async function generateDropDrafts(limit = 5): Promise<DropRadarResult> {
  if (!geminiConfigured()) return { configured: false, scanned: 0, drafted: 0, skipped: 0 };

  const now = new Date();
  const from = new Date(now.getTime() - 21 * DAY); // just-released
  const to = new Date(now.getTime() + 150 * DAY); // ~5 months out

  const candidates = await prisma.catalogShoe.findMany({
    where: {
      releaseDate: { gte: from, lte: to },
      imageUrl: { not: null },
    },
    orderBy: { releaseDate: "asc" },
    take: 40,
    select: {
      sku: true, name: true, brand: true, colorway: true, silhouette: true,
      imageUrl: true, retailPriceCents: true, marketPriceCents: true, releaseDate: true,
    },
  });

  let scanned = 0, drafted = 0, skipped = 0;

  for (const shoe of candidates) {
    if (drafted >= limit) break;
    scanned++;

    const slug = slugify(`${shoe.name} release date`);
    // Never duplicate: skip if any article already covers this SKU or slug.
    const exists = await prisma.article
      .findFirst({ where: { OR: [{ sku: shoe.sku }, { slug }] }, select: { id: true } })
      .catch(() => null);
    if (exists) { skipped++; continue; }

    const draft = await geminiJson<DraftShape>({
      temperature: 0.55,
      timeoutMs: 30000,
      system: [
        "You write for The Heat Chart, a sneaker-culture site with an artist-first, streetwear voice — confident, knowledgeable, never corny or salesy.",
        "You are given ONE real sneaker release. Write a short drop story and one culture trivia question.",
        "HARD RULES:",
        "- Do NOT state the release date, retail price, or style code anywhere in the story — those are shown in a separate facts table.",
        "- Do NOT invent collaborators, backstory, quotes, or specifics you are not sure of. If you don't know this exact colorway, keep it about the silhouette's legacy and what this colorway does aesthetically (based on its name).",
        "- The culture question must be a genuine, checkable sneaker fact (history, designer, tech, silhouette lore) — not about this release's price or date.",
        "Return STRICT JSON only: {\"angle\": string (one punchy sentence, no date/price), \"story\": string[] (2-4 short paragraphs, markdown ok), \"deep\": string[] (2-4 quick factual bullets), \"question\": {\"q\": string, \"options\": string[4], \"answer\": number 0-3, \"explain\": string}}.",
      ].join("\n"),
      parts: [{
        text: `Sneaker: ${shoe.name}\nBrand: ${shoe.brand ?? "—"}\nSilhouette: ${shoe.silhouette ?? "—"}\nColorway: ${shoe.colorway ?? "—"}`,
      }],
    }).catch(() => null);

    if (!draft || !Array.isArray(draft.story) || draft.story.length === 0) { skipped++; continue; }

    const dateLabel = shoe.releaseDate
      ? shoe.releaseDate.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" })
      : "TBA";

    const content = [
      draft.angle ? `_${draft.angle.trim()}_` : "",
      draft.angle ? "" : null,
      "## The drop at a glance",
      "",
      "| | |",
      "|---|---|",
      `| **Model** | ${shoe.name} |`,
      shoe.colorway ? `| **Colorway** | ${shoe.colorway} |` : null,
      `| **Style code** | ${shoe.sku} |`,
      shoe.retailPriceCents ? `| **Retail** | ${formatUsd(shoe.retailPriceCents)} |` : null,
      `| **Release** | ${dateLabel} |`,
      "",
      "## The story",
      "",
      ...draft.story.flatMap((p) => [p.trim(), ""]),
      ...(draft.deep && draft.deep.length ? ["## The deep cuts", "", ...draft.deep.map((f) => `- ${f.trim()}`), ""] : []),
      "## How to cop",
      "",
      "1. **Launch draw** — enter the second it opens; the raffle button above takes you there.",
      "2. **Retailer raffles** — the big accounts open entries in the days before the drop.",
      "3. **Miss it?** The buy links on this page route to the marketplaces we trust.",
      "",
      "*Drafted by Drop Radar from live release data and reviewed by an editor before publishing. Dates move — we update as brands confirm.*",
    ].filter((x) => x !== null && x !== undefined).join("\n");

    const excerpt = (draft.angle?.trim() || `${shoe.name} — release date, price, and where to cop.`).slice(0, 180);

    let article;
    try {
      article = await prisma.article.create({
        data: {
          slug,
          title: `${shoe.name} — Release Date, Price & The Story`,
          excerpt,
          content,
          coverImage: shoe.imageUrl,
          tags: [shoe.brand, "Release Dates", "Drop Radar"].filter(Boolean).join(", "),
          sku: shoe.sku,
          dropAt: shoe.releaseDate,
          dropSource: "KicksDB",
          raffleUrl: brandLaunchUrl(shoe.brand),
          status: "DRAFT",
        },
      });
    } catch {
      skipped++; // slug/sku raced to unique — skip
      continue;
    }

    // Culture question rides along but stays INACTIVE until the article is
    // published, so nothing surfaces in the quiz/feed before review.
    const q = draft.question;
    if (q && q.q && Array.isArray(q.options) && q.options.length === 4 && Number.isInteger(q.answer)) {
      await prisma.quizQuestion.create({
        data: {
          question: q.q.trim(),
          options: JSON.stringify(q.options.map((o) => String(o).trim())),
          answerIndex: Math.min(3, Math.max(0, q.answer)),
          category: "culture",
          explanation: q.explain?.trim() || null,
          articleId: article.id,
          active: false,
        },
      }).catch(() => {});
    }

    drafted++;
  }

  return { configured: true, scanned, drafted, skipped };
}
