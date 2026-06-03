import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { sourcedSizingSchema } from "./market-research.functions";
import { resolveSkill, withSkillPreamble, type ResolvedSkill } from "./skills.server";

// ───────── Shared analysis schema (mirrors the AI tool-call output) ─────────
export const severitySchema = z.enum(["low", "medium", "high"]);
export const trendDirSchema = z.enum(["up", "flat", "down"]);
export const competitorTypeSchema = z.enum(["direct", "indirect"]);
export const demandSchema = z.enum(["low", "moderate", "strong"]);

const complianceSchema = z.object({
  score: z.number().min(1).max(10),
  summary: z.string(),
  risks: z
    .array(z.object({ title: z.string(), severity: severitySchema, detail: z.string() }))
    .max(8),
  regulations: z.array(z.string()).max(8),
  ipConcerns: z.array(z.string()).max(8),
});

const marketSchema = z.object({
  score: z.number().min(1).max(10),
  summary: z.string(),
  tam: z.string(),
  sam: z.string(),
  som: z.string(),
  competitors: z
    .array(z.object({ name: z.string(), type: competitorTypeSchema, note: z.string() }))
    .max(8),
  trends: z
    .array(z.object({ title: z.string(), direction: trendDirSchema, note: z.string() }))
    .max(6),
  barriers: z.array(z.string()).max(6),
  differentiation: z.array(z.string()).max(6),
  sourcedSizing: sourcedSizingSchema.optional(),
});

const salesSchema = z.object({
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
});

const strategicSchema = z.object({
  overallScore: z.number().min(0).max(100),
  healthVerdict: z.string().min(1).max(280),
  oneLineThesis: z.string().min(1).max(280),
});

export const analysisSchema = strategicSchema.extend({
  compliance: complianceSchema,
  market: marketSchema,
  sales: salesSchema,
});

export type Analysis = z.infer<typeof analysisSchema>;

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-3-flash-preview";

// ───────── System prompts per pillar ─────────
const BASE_TONE = `Be specific, honest, and defensible. Name real companies,
real regulations, and concrete numbers. Avoid hedging and generic platitudes.
Calibrate scores honestly: most ideas should land 5–7. Reserve 9–10 for
truly exceptional fit and 1–3 for serious problems. Always respond by
invoking the provided tool — never plain text.`;

const STRATEGIC_SYSTEM = `You are a senior strategic partner vetting a new product idea.
Produce only the top-level read: an Overall Idea Health Score (0–100), a one-sentence
verdict, and a crisp one-line thesis (what it is + who it's for). Be opinionated.
${BASE_TONE}`;

const COMPLIANCE_SYSTEM = `You are a regulatory & compliance reviewer for early-stage
products. Identify jurisdiction-specific obligations (US/EU primarily), data privacy
(GDPR/CCPA), licensing, consumer protection, IP, and industry-specific rules.
${BASE_TONE}`;

const MARKET_SYSTEM = `You are a market analyst sizing and segmenting an opportunity.
Produce defensible TAM/SAM/SOM logic, named competitors (not categories), real
trends, structural barriers, and concrete differentiation.
${BASE_TONE}`;

const SALES_SYSTEM = `You are a go-to-market strategist. Define the ICP, demand level,
a pricing ladder, year-1 revenue scenarios, and the first 5 GTM moves in priority
order. Be specific about channels and motion.
${BASE_TONE}`;

// ───────── Per-pillar tool schemas ─────────
const STRATEGIC_TOOL = {
  type: "function" as const,
  function: {
    name: "submit_strategic_summary",
    description: "Submit the top-level health verdict for the idea.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["overallScore", "healthVerdict", "oneLineThesis"],
      properties: {
        overallScore: { type: "number", description: "0–100 overall idea health." },
        healthVerdict: { type: "string" },
        oneLineThesis: { type: "string" },
      },
    },
  },
};

const COMPLIANCE_TOOL = {
  type: "function" as const,
  function: {
    name: "submit_compliance_review",
    description: "Submit the compliance & regulatory review of the idea.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["score", "summary", "risks", "regulations", "ipConcerns"],
      properties: {
        score: { type: "number", description: "1 (terrible) – 10 (clean)." },
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
        regulations: { type: "array", maxItems: 6, items: { type: "string" } },
        ipConcerns: { type: "array", maxItems: 6, items: { type: "string" } },
      },
    },
  },
};

const MARKET_TOOL = {
  type: "function" as const,
  function: {
    name: "submit_market_analysis",
    description: "Submit the market sizing and competitive analysis.",
    parameters: {
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
        tam: { type: "string" },
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
  },
};

const SALES_TOOL = {
  type: "function" as const,
  function: {
    name: "submit_sales_analysis",
    description: "Submit the GTM, pricing, and revenue analysis.",
    parameters: {
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
            conservative: { type: "string" },
            moderate: { type: "string" },
            optimistic: { type: "string" },
          },
        },
        targetCustomer: { type: "string" },
        gtm: { type: "array", maxItems: 5, items: { type: "string" } },
      },
    },
  },
};

// ───────── Shared helper: one tool-call against the AI gateway ─────────
async function callPillar<T>(opts: {
  apiKey: string;
  skill: ResolvedSkill;
  baseSystem: string;
  userPrompt: string;
  tool: { type: "function"; function: { name: string; description: string; parameters: unknown } };
  schema: z.ZodType<T>;
  label: string;
}): Promise<T> {
  const systemPrompt = withSkillPreamble(opts.baseSystem, opts.skill);
  const model = opts.skill?.model || DEFAULT_MODEL;

  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: opts.userPrompt },
      ],
      tools: [opts.tool],
      tool_choice: { type: "function", function: { name: opts.tool.function.name } },
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
    console.error(`AI gateway error (${opts.label}):`, res.status, text);
    throw new Error(`AI gateway error on ${opts.label} (${res.status}). Please try again.`);
  }

  const json = (await res.json()) as {
    choices?: { message?: { tool_calls?: { function?: { arguments?: string } }[] } }[];
  };
  const args = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!args) {
    throw new Error(`AI did not return a structured ${opts.label} analysis. Please retry.`);
  }
  let raw: unknown;
  try {
    raw = JSON.parse(args);
  } catch {
    throw new Error(`AI returned malformed JSON for ${opts.label}. Please retry.`);
  }
  const parsed = opts.schema.safeParse(raw);
  if (!parsed.success) {
    console.error(`${opts.label} schema mismatch:`, parsed.error.format());
    throw new Error(`AI returned an unexpected shape for ${opts.label}. Please retry.`);
  }
  return parsed.data;
}

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

Return your output by calling the provided tool. Do not return plain text.`;

    // Resolve all four skills in parallel, then fan out the AI calls.
    const [strategicSkill, complianceSkill, marketSkill, salesSkill] = await Promise.all([
      resolveSkill("vetting_strategic"),
      resolveSkill("vetting_compliance"),
      resolveSkill("vetting_market"),
      resolveSkill("vetting_sales"),
    ]);

    const [strategic, compliance, market, sales] = await Promise.all([
      callPillar({
        apiKey,
        skill: strategicSkill,
        baseSystem: STRATEGIC_SYSTEM,
        userPrompt,
        tool: STRATEGIC_TOOL,
        schema: strategicSchema,
        label: "strategic",
      }),
      callPillar({
        apiKey,
        skill: complianceSkill,
        baseSystem: COMPLIANCE_SYSTEM,
        userPrompt,
        tool: COMPLIANCE_TOOL,
        schema: complianceSchema,
        label: "compliance",
      }),
      callPillar({
        apiKey,
        skill: marketSkill,
        baseSystem: MARKET_SYSTEM,
        userPrompt,
        tool: MARKET_TOOL,
        schema: marketSchema,
        label: "market",
      }),
      callPillar({
        apiKey,
        skill: salesSkill,
        baseSystem: SALES_SYSTEM,
        userPrompt,
        tool: SALES_TOOL,
        schema: salesSchema,
        label: "sales",
      }),
    ]);

    return {
      ...strategic,
      compliance,
      market,
      sales,
    };
  });

// ───────── Intake refine: tighten/clarify the founder's idea ─────────
const refineSchema = z.object({
  refined: z.string().min(1).max(2000),
  question: z.string().max(300).optional(),
});
export type IdeaRefinement = z.infer<typeof refineSchema>;

const REFINE_SYSTEM = `You help a founder articulate a product idea clearly before
it goes into vetting. Keep the founder's voice; sharpen, don't replace. Optimize
for clarity on: who it's for, the core problem, the unique mechanism, and what
success looks like. Always respond by calling the submit_refined_idea tool.`;

const REFINE_TOOL = {
  type: "function" as const,
  function: {
    name: "submit_refined_idea",
    description: "Return a tightened restatement of the founder's idea.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["refined"],
      properties: {
        refined: {
          type: "string",
          description: "A one-paragraph tightened restatement of the idea, in the founder's voice.",
        },
        question: {
          type: "string",
          description: "Optional single follow-up question if a key dimension is still vague.",
        },
      },
    },
  },
};

export const refineIdea = createServerFn({ method: "POST" })
  .inputValidator(z.object({ idea: z.string().trim().min(5).max(4000) }))
  .handler(async ({ data }): Promise<IdeaRefinement> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured on the server.");

    const skill = await resolveSkill("intake_refine");
    return callPillar({
      apiKey,
      skill,
      baseSystem: REFINE_SYSTEM,
      userPrompt: `Tighten this idea brief:\n\n${data.idea}`,
      tool: REFINE_TOOL,
      schema: refineSchema,
      label: "intake_refine",
    });
  });
