import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// ───────── Shared analysis schema (mirrors the AI tool-call output) ─────────
export const severitySchema = z.enum(["low", "medium", "high"]);
export const trendDirSchema = z.enum(["up", "flat", "down"]);
export const competitorTypeSchema = z.enum(["direct", "indirect"]);
export const demandSchema = z.enum(["low", "moderate", "strong"]);

export const analysisSchema = z.object({
  overallScore: z.number().min(0).max(100),
  healthVerdict: z.string().min(1).max(280),
  oneLineThesis: z.string().min(1).max(280),
  compliance: z.object({
    score: z.number().min(1).max(10),
    summary: z.string(),
    risks: z
      .array(
        z.object({
          title: z.string(),
          severity: severitySchema,
          detail: z.string(),
        }),
      )
      .max(8),
    regulations: z.array(z.string()).max(8),
    ipConcerns: z.array(z.string()).max(8),
  }),
  market: z.object({
    score: z.number().min(1).max(10),
    summary: z.string(),
    tam: z.string(),
    sam: z.string(),
    som: z.string(),
    competitors: z
      .array(
        z.object({
          name: z.string(),
          type: competitorTypeSchema,
          note: z.string(),
        }),
      )
      .max(8),
    trends: z
      .array(
        z.object({
          title: z.string(),
          direction: trendDirSchema,
          note: z.string(),
        }),
      )
      .max(6),
    barriers: z.array(z.string()).max(6),
    differentiation: z.array(z.string()).max(6),
  }),
  sales: z.object({
    score: z.number().min(1).max(10),
    summary: z.string(),
    demand: demandSchema,
    pricing: z.object({
      low: z.string(),
      mid: z.string(),
      premium: z.string(),
      recommended: z.string(),
    }),
    revenue: z.object({
      conservative: z.string(),
      moderate: z.string(),
      optimistic: z.string(),
    }),
    targetCustomer: z.string(),
    gtm: z.array(z.string()).max(6),
  }),
});

export type Analysis = z.infer<typeof analysisSchema>;

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";

const SYSTEM_PROMPT = `You are a senior partner at a top-tier product innovation consultancy
(think IDEO × a16z × a regulatory specialist). You vet new product ideas with
sharp, honest, defensible analysis. Be specific — name real competitors,
real regulations (FDA / FCC / CPSC / CE / GDPR / etc. when applicable), and
concrete numbers. Avoid hedging language and avoid generic platitudes.
Calibrate scores honestly: most ideas should land 5–7. Reserve 9–10 for
truly exceptional fit and 1–3 for serious problems. Always respond by
invoking the provided 'submit_vetting_analysis' tool — never plain text.`;

// Tool-calling schema for structured output
const ANALYSIS_TOOL = {
  type: "function" as const,
  function: {
    name: "submit_vetting_analysis",
    description:
      "Submit a comprehensive vetting analysis of the product idea covering compliance, market viability, and sales potential.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: [
        "overallScore",
        "healthVerdict",
        "oneLineThesis",
        "compliance",
        "market",
        "sales",
      ],
      properties: {
        overallScore: { type: "number", description: "Overall Idea Health Score, 0-100." },
        healthVerdict: {
          type: "string",
          description: "One-sentence verdict on the overall opportunity.",
        },
        oneLineThesis: {
          type: "string",
          description: "A crisp one-line thesis describing what this product is and for whom.",
        },
        compliance: {
          type: "object",
          additionalProperties: false,
          required: ["score", "summary", "risks", "regulations", "ipConcerns"],
          properties: {
            score: { type: "number", description: "Compliance Risk Score, 1 (terrible) - 10 (clean)." },
            summary: { type: "string" },
            risks: {
              type: "array",
              maxItems: 6,
              items: {
                type: "object",
                additionalProperties: false,
                required: ["title", "severity", "detail"],
                properties: {
                  title: { type: "string" },
                  severity: { type: "string", enum: ["low", "medium", "high"] },
                  detail: { type: "string" },
                },
              },
            },
            regulations: {
              type: "array",
              maxItems: 6,
              items: { type: "string" },
              description: "Specific named regulations / standards that apply.",
            },
            ipConcerns: {
              type: "array",
              maxItems: 6,
              items: { type: "string" },
              description: "Trademark or trade-secret concerns and prior-art conflicts.",
            },
          },
        },
        market: {
          type: "object",
          additionalProperties: false,
          required: [
            "score",
            "summary",
            "tam",
            "sam",
            "som",
            "competitors",
            "trends",
            "barriers",
            "differentiation",
          ],
          properties: {
            score: { type: "number" },
            summary: { type: "string" },
            tam: { type: "string", description: "Total Addressable Market, e.g. '$8.2B globally'." },
            sam: { type: "string" },
            som: { type: "string" },
            competitors: {
              type: "array",
              maxItems: 7,
              items: {
                type: "object",
                additionalProperties: false,
                required: ["name", "type", "note"],
                properties: {
                  name: { type: "string" },
                  type: { type: "string", enum: ["direct", "indirect"] },
                  note: { type: "string" },
                },
              },
            },
            trends: {
              type: "array",
              maxItems: 5,
              items: {
                type: "object",
                additionalProperties: false,
                required: ["title", "direction", "note"],
                properties: {
                  title: { type: "string" },
                  direction: { type: "string", enum: ["up", "flat", "down"] },
                  note: { type: "string" },
                },
              },
            },
            barriers: { type: "array", maxItems: 5, items: { type: "string" } },
            differentiation: { type: "array", maxItems: 5, items: { type: "string" } },
          },
        },
        sales: {
          type: "object",
          additionalProperties: false,
          required: [
            "score",
            "summary",
            "demand",
            "pricing",
            "revenue",
            "targetCustomer",
            "gtm",
          ],
          properties: {
            score: { type: "number" },
            summary: { type: "string" },
            demand: { type: "string", enum: ["low", "moderate", "strong"] },
            pricing: {
              type: "object",
              additionalProperties: false,
              required: ["low", "mid", "premium", "recommended"],
              properties: {
                low: { type: "string" },
                mid: { type: "string" },
                premium: { type: "string" },
                recommended: { type: "string" },
              },
            },
            revenue: {
              type: "object",
              additionalProperties: false,
              required: ["conservative", "moderate", "optimistic"],
              properties: {
                conservative: { type: "string", description: "Year-1 revenue estimate, conservative." },
                moderate: { type: "string" },
                optimistic: { type: "string" },
              },
            },
            targetCustomer: { type: "string" },
            gtm: {
              type: "array",
              maxItems: 5,
              items: { type: "string" },
              description: "Go-to-market moves in priority order.",
            },
          },
        },
      },
    },
  },
};

export const analyzeIdea = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      idea: z.string().trim().min(10).max(4000),
      sketchName: z.string().max(255).optional(),
    }),
  )
  .handler(async ({ data }): Promise<Analysis> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured on the server.");

    const userPrompt = `Vet the following product idea. Be honest, specific, and useful.

IDEA:
${data.idea}
${data.sketchName ? `\n(The founder attached a napkin sketch named "${data.sketchName}".)` : ""}

Return the analysis by calling the submit_vetting_analysis tool. Do not return plain text.`;

    const res = await fetch(GATEWAY, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        tools: [ANALYSIS_TOOL],
        tool_choice: { type: "function", function: { name: "submit_vetting_analysis" } },
      }),
    });

    if (res.status === 429) {
      throw new Error("Rate limited by the AI gateway. Please try again in a moment.");
    }
    if (res.status === 402) {
      throw new Error(
        "AI credits exhausted. Add credits in Settings → Workspace → Usage to keep vetting.",
      );
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("AI gateway error:", res.status, text);
      throw new Error(`AI gateway error (${res.status}). Please try again.`);
    }

    const json = (await res.json()) as {
      choices?: { message?: { tool_calls?: { function?: { arguments?: string } }[] } }[];
    };
    const args = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) {
      throw new Error("AI did not return a structured analysis. Please retry.");
    }
    let raw: unknown;
    try {
      raw = JSON.parse(args);
    } catch {
      throw new Error("AI returned malformed JSON. Please retry.");
    }

    const parsed = analysisSchema.safeParse(raw);
    if (!parsed.success) {
      console.error("Analysis schema mismatch:", parsed.error.format());
      throw new Error("AI returned an unexpected shape. Please retry.");
    }
    return parsed.data;
  });
