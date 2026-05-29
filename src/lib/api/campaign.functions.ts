import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";

/* ───────── Schema ───────── */
export const tierSchema = z.object({
  name: z.string(),
  price: z.string(),
  tagline: z.string(),
  earlyBird: z.boolean(),
  limited: z.boolean(),
  limitedCount: z.number().optional(),
  contents: z.array(z.string()).min(1).max(8),
  estShipping: z.string(),
  delivery: z.string(),
  perceivedValue: z.string(),
});

export const sceneSchema = z.object({
  scene: z.string(),
  duration: z.string(),
  visual: z.string(),
  voiceover: z.string(),
});

export const campaignSchema = z.object({
  recommendedTitle: z.string(),
  titleOptions: z.array(z.string()).min(3).max(5),
  tagline: z.string(),
  category: z.string(),
  fundingGoal: z.string(),
  description: z.object({
    problem: z.string(),
    solution: z.string(),
    features: z.array(z.object({ title: z.string(), detail: z.string() })).min(3).max(7),
    whyNow: z.string(),
    socialImpact: z.string().optional(),
    seoKeywords: z.array(z.string()).max(8),
  }),
  tiers: z.array(tierSchema).min(5).max(8),
  story: z.object({
    founderStory: z.string(),
    productJourney: z.string(),
    vision: z.string(),
  }),
  video: z.object({
    title: z.string(),
    totalDuration: z.string(),
    tone: z.string(),
    scenes: z.array(sceneSchema).min(4).max(8),
    fullNarration: z.string(),
    shotList: z.array(z.string()).min(4).max(12),
    aiPrompts: z.array(z.string()).min(3).max(8),
  }),
  cta: z.string(),
});

export type Campaign = z.infer<typeof campaignSchema>;
export type CampaignTier = z.infer<typeof tierSchema>;
export type CampaignScene = z.infer<typeof sceneSchema>;

/* ───────── Tool spec ───────── */
const TOOL = {
  type: "function" as const,
  function: {
    name: "submit_campaign",
    description: "Submit a complete, conversion-optimized crowdfunding campaign package.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: [
        "recommendedTitle",
        "titleOptions",
        "tagline",
        "category",
        "fundingGoal",
        "description",
        "tiers",
        "story",
        "video",
        "cta",
      ],
      properties: {
        recommendedTitle: { type: "string", description: "The single best campaign title." },
        titleOptions: {
          type: "array",
          minItems: 3,
          maxItems: 5,
          items: { type: "string" },
          description: "3-5 distinct benefit-driven title options.",
        },
        tagline: { type: "string", description: "One-line punchy sub-title." },
        category: { type: "string", description: "Kickstarter/Indiegogo category, e.g. 'Design / Product Design'." },
        fundingGoal: { type: "string", description: "Suggested funding goal, e.g. '$45,000'." },
        description: {
          type: "object",
          additionalProperties: false,
          required: ["problem", "solution", "features", "whyNow", "seoKeywords"],
          properties: {
            problem: { type: "string" },
            solution: { type: "string" },
            features: {
              type: "array",
              minItems: 3,
              maxItems: 7,
              items: {
                type: "object",
                additionalProperties: false,
                required: ["title", "detail"],
                properties: {
                  title: { type: "string" },
                  detail: { type: "string" },
                },
              },
            },
            whyNow: { type: "string" },
            socialImpact: { type: "string" },
            seoKeywords: { type: "array", maxItems: 8, items: { type: "string" } },
          },
        },
        tiers: {
          type: "array",
          minItems: 5,
          maxItems: 8,
          items: {
            type: "object",
            additionalProperties: false,
            required: [
              "name",
              "price",
              "tagline",
              "earlyBird",
              "limited",
              "contents",
              "estShipping",
              "delivery",
              "perceivedValue",
            ],
            properties: {
              name: { type: "string" },
              price: { type: "string", description: "e.g. '$59'" },
              tagline: { type: "string" },
              earlyBird: { type: "boolean" },
              limited: { type: "boolean" },
              limitedCount: { type: "number" },
              contents: { type: "array", minItems: 1, maxItems: 8, items: { type: "string" } },
              estShipping: { type: "string", description: "e.g. '$9 US / $19 intl'" },
              delivery: { type: "string", description: "e.g. 'March 2026'" },
              perceivedValue: { type: "string", description: "e.g. 'Retail $120 — save 51%'" },
            },
          },
        },
        story: {
          type: "object",
          additionalProperties: false,
          required: ["founderStory", "productJourney", "vision"],
          properties: {
            founderStory: { type: "string" },
            productJourney: { type: "string" },
            vision: { type: "string" },
          },
        },
        video: {
          type: "object",
          additionalProperties: false,
          required: ["title", "totalDuration", "tone", "scenes", "fullNarration", "shotList", "aiPrompts"],
          properties: {
            title: { type: "string" },
            totalDuration: { type: "string", description: "e.g. '75 seconds'" },
            tone: { type: "string", description: "e.g. 'cinematic, hopeful'" },
            scenes: {
              type: "array",
              minItems: 4,
              maxItems: 8,
              items: {
                type: "object",
                additionalProperties: false,
                required: ["scene", "duration", "visual", "voiceover"],
                properties: {
                  scene: { type: "string", description: "e.g. 'Scene 1 — The Problem'" },
                  duration: { type: "string", description: "e.g. '0:00-0:10'" },
                  visual: { type: "string" },
                  voiceover: { type: "string" },
                },
              },
            },
            fullNarration: { type: "string", description: "Continuous VO script, ready to record." },
            shotList: { type: "array", minItems: 4, maxItems: 12, items: { type: "string" } },
            aiPrompts: {
              type: "array",
              minItems: 3,
              maxItems: 8,
              items: { type: "string" },
              description: "Prompt-ready text for Runway / Kling / Luma / Sora.",
            },
          },
        },
        cta: { type: "string", description: "Closing call-to-action line." },
      },
    },
  },
};

const SYSTEM = `You are the lead strategist at a world-class crowdfunding launch agency
(think the team behind Peak Design, Snap, and Oura's launches). You transform
vetted product ideas into complete, conversion-optimized Kickstarter / Indiegogo
campaigns. Be persuasive but credible. Use specific numbers, concrete benefits,
and emotional hooks. Avoid generic marketing fluff. Calibrate tiers honestly:
early bird = real scarcity, premium = real upgrade. Always respond by invoking
the 'submit_campaign' tool — never plain text.`;

export const generateCampaign = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      idea: z.string().trim().min(10).max(4000),
      title: z.string().max(255).optional(),
      tone: z.enum(["balanced", "emotional", "technical", "playful"]).default("balanced"),
      analysisJson: z.string().max(20000).optional(),
    }),
  )
  .handler(async ({ data }): Promise<Campaign> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured on the server.");

    const userPrompt = `Generate a complete crowdfunding campaign for the product below.

PRODUCT IDEA:
${data.idea}
${data.title ? `\nWORKING TITLE: ${data.title}` : ""}
TONE: ${data.tone}
${data.analysisJson ? `\nVETTING REPORT (for context, do not contradict):\n${data.analysisJson}` : ""}

Return the campaign by calling submit_campaign. Be specific, persuasive, and ready to publish.`;

    const res = await fetch(GATEWAY, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userPrompt },
        ],
        tools: [TOOL],
        tool_choice: { type: "function", function: { name: "submit_campaign" } },
      }),
    });

    if (res.status === 429) throw new Error("Rate limited. Try again in a moment.");
    if (res.status === 402)
      throw new Error("AI credits exhausted. Add credits in Settings → Workspace → Usage.");
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      console.error("Campaign gateway error:", res.status, t);
      throw new Error(`AI gateway error (${res.status}).`);
    }
    const json = (await res.json()) as {
      choices?: { message?: { tool_calls?: { function?: { arguments?: string } }[] } }[];
    };
    const args = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) throw new Error("AI did not return a structured campaign. Please retry.");
    let raw: unknown;
    try {
      raw = JSON.parse(args);
    } catch {
      throw new Error("AI returned malformed JSON. Please retry.");
    }
    const parsed = campaignSchema.safeParse(raw);
    if (!parsed.success) {
      console.error("Campaign schema mismatch:", parsed.error.format());
      throw new Error("AI returned an unexpected shape. Please retry.");
    }
    return parsed.data;
  });
