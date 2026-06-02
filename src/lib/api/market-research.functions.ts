import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const sourcedSizingSchema = z.object({
  tam: z.object({ value: z.string(), methodology: z.string() }),
  sam: z.object({ value: z.string(), methodology: z.string() }),
  som: z.object({ value: z.string(), methodology: z.string() }),
  assumptions: z.array(z.string()).max(8),
  sources: z
    .array(
      z.object({
        title: z.string().max(280),
        url: z.string().url(),
      }),
    )
    .max(12),
});

export type SourcedSizing = z.infer<typeof sourcedSizingSchema>;

export const researchMarketSize = createServerFn({ method: "POST" })
  .inputValidator(z.object({ idea: z.string().trim().min(10).max(4000) }))
  .handler(async ({ data }): Promise<SourcedSizing> => {
    const apiKey = process.env.PERPLEXITY_API_KEY;
    if (!apiKey) throw new Error("PERPLEXITY_API_KEY is not configured.");

    const userPrompt = `You are a market analyst. For the product idea below, research and
estimate TAM, SAM, and SOM using current public data. Cite specific reports
(IDC, Statista, Grand View Research, Gartner, etc.) wherever possible.

PRODUCT IDEA:
${data.idea}

Definitions:
- TAM (Total Addressable Market): worldwide annual revenue if every potential
  buyer purchased.
- SAM (Serviceable Addressable Market): the subset realistically reachable
  given geography, channels, and segment.
- SOM (Serviceable Obtainable Market): a credible 3-year capture by a new
  entrant.

For EACH of TAM/SAM/SOM provide:
  - value: dollar figure with units (e.g. "$8.4B" or "$120M")
  - methodology: 1-2 sentences explaining the calculation, citing the source(s)
    used (year, publisher).

Also return:
  - assumptions: 3-6 bullet strings stating the key assumptions (geography,
    pricing, capture rate, year, etc.)
  - sources: array of {title, url} for every report/article you relied on.

Return ONLY JSON matching this exact shape — no prose, no markdown fences:
{
  "tam": { "value": "...", "methodology": "..." },
  "sam": { "value": "...", "methodology": "..." },
  "som": { "value": "...", "methodology": "..." },
  "assumptions": ["..."],
  "sources": [{ "title": "...", "url": "https://..." }]
}`;

    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar-pro",
        messages: [
          {
            role: "system",
            content:
              "You are a rigorous market sizing analyst. You ground every number in a public source and never invent figures. Respond with JSON only.",
          },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.1,
        search_recency_filter: "year",
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "market_sizing",
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["tam", "sam", "som", "assumptions", "sources"],
              properties: {
                tam: {
                  type: "object",
                  additionalProperties: false,
                  required: ["value", "methodology"],
                  properties: {
                    value: { type: "string" },
                    methodology: { type: "string" },
                  },
                },
                sam: {
                  type: "object",
                  additionalProperties: false,
                  required: ["value", "methodology"],
                  properties: {
                    value: { type: "string" },
                    methodology: { type: "string" },
                  },
                },
                som: {
                  type: "object",
                  additionalProperties: false,
                  required: ["value", "methodology"],
                  properties: {
                    value: { type: "string" },
                    methodology: { type: "string" },
                  },
                },
                assumptions: {
                  type: "array",
                  items: { type: "string" },
                  maxItems: 8,
                },
                sources: {
                  type: "array",
                  maxItems: 12,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["title", "url"],
                    properties: {
                      title: { type: "string" },
                      url: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("Perplexity error:", res.status, text);
      throw new Error(`Market research failed (${res.status}).`);
    }

    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      citations?: string[];
    };
    const content = json.choices?.[0]?.message?.content;
    if (!content) throw new Error("Perplexity returned no content.");

    let raw: unknown;
    try {
      // Strip accidental code fences if any.
      const cleaned = content
        .trim()
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "");
      raw = JSON.parse(cleaned);
    } catch {
      throw new Error("Perplexity returned malformed JSON.");
    }

    // If sources are missing/empty, fall back to top-level citations.
    if (raw && typeof raw === "object") {
      const obj = raw as { sources?: unknown };
      if (!Array.isArray(obj.sources) || obj.sources.length === 0) {
        const citations = Array.isArray(json.citations) ? json.citations : [];
        obj.sources = citations.slice(0, 12).map((url) => ({
          title: safeHostname(url),
          url,
        }));
      }
    }

    const parsed = sourcedSizingSchema.safeParse(raw);
    if (!parsed.success) {
      console.error("Sizing schema mismatch:", parsed.error.format());
      throw new Error("Market research returned an unexpected shape.");
    }
    return parsed.data;
  });

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
