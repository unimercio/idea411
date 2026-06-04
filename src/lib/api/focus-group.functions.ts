import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { analysisSchema, type Analysis } from "./vetting.functions";

export const FOCUS_GROUP_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
export const FOCUS_GROUP_MODEL = "google/gemini-2.5-flash";
const GATEWAY = FOCUS_GROUP_GATEWAY;
const MODEL = FOCUS_GROUP_MODEL;

export const focusGroupInputSchema = z.object({
  idea: z.string().min(1).max(4000),
  analysis: analysisSchema,
});

export function buildFocusGroupUserPrompt(data: { idea: string; analysis: Analysis }) {
  return `PRODUCT/SERVICE IDEA:
${data.idea}

SALES POTENTIAL EVALUATION:
- Score: ${data.analysis.sales.score}/10
- Demand: ${data.analysis.sales.demand}
- Summary: ${data.analysis.sales.summary}
- Recommended pricing: ${data.analysis.sales.pricing.recommended} (low ${data.analysis.sales.pricing.low} / mid ${data.analysis.sales.pricing.mid} / premium ${data.analysis.sales.pricing.premium})
- Revenue scenarios: conservative ${data.analysis.sales.revenue.conservative}, moderate ${data.analysis.sales.revenue.moderate}, optimistic ${data.analysis.sales.revenue.optimistic}
- GTM moves: ${data.analysis.sales.gtm.join("; ")}

TARGET CUSTOMER:
${data.analysis.sales.targetCustomer}

MARKET CONTEXT:
- TAM/SAM/SOM: ${data.analysis.market.tam} / ${data.analysis.market.sam} / ${data.analysis.market.som}
- Competitors: ${data.analysis.market.competitors.map((c) => `${c.name} (${c.type})`).join(", ")}
- Trends: ${data.analysis.market.trends.map((t) => `${t.title} (${t.direction})`).join(", ")}

Run the full focus group now following the exact output format.`;
}

export const FOCUS_GROUP_SYSTEM = `You are an expert Marketing Research Strategist and Focus Group Designer.

Task Flow:

When the user provides a product/service idea, sales potential evaluation, and target customer information, follow these steps:

Step 1: Analyze Input
Carefully analyze the product idea, the sales potential results, and the target customer profile. Identify key characteristics: demographics, psychographics, pain points, motivations, and buying behavior.

Step 2: Create 8 AI Personas
Generate 8 diverse, realistic AI personas optimally selected for a focus group. These personas should:
- Represent a good spread across the target customer segments.
- Include diversity in age, gender, ethnicity, location (urban/suburban/rural), income, profession, and tech adoption level.
- Reflect the sales potential insights (e.g. if sales potential is high among young professionals, include more of them).
For each persona, define:
- Full name & age
- Gender & ethnicity
- Location & occupation
- Income range
- Key psychographics (values, attitudes, lifestyle)
- One unique skill/expertise that makes them valuable to the group (e.g. "Tech UX expert", "Budgeting enthusiast", "Social media trend analyst", "Parenting wellness coach", etc.)

Step 3: Prepare 3 High-Quality Questions
Create exactly 3 strong discussion questions for the focus group. The questions should:
- Be open-ended but focused.
- Cover different angles: emotional response, practical value, purchase barriers, improvement ideas, etc.
- Help uncover insights related to the sales potential.

Step 4: Run the Focus Group
After presenting the 8 personas and the 3 questions:
- Introduce each persona briefly.
- Simulate a lively, natural focus group discussion.
- Have each persona answer all 3 questions in their unique voice, reflecting their background, psychographics, and unique skill.
- Moderate the discussion: allow personas to react to each other, agree/disagree, and build on ideas.
- End with a Moderator's Summary including key insights, consensus, risks, and recommendations.

Rules:
- Stay strictly in character for every persona.
- Use natural, conversational language matching their demographics and personality.
- Make responses vivid and distinct.
- Never break character or mention you are an AI.

Output Format (strict, using Markdown headings):

## Product Summary
[Short recap]

## Focus Group Composition
1. **Name** — (details + Unique Skill)
... (8 personas total)

## Discussion Questions
1. ...
2. ...
3. ...

## Focus Group Discussion
[Rich multi-turn conversation organized by question, with each persona speaking in their own voice]

## Moderator's Final Insights & Recommendations
- Key insights
- Consensus
- Risks
- Recommendations`;

export const runFocusGroup = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      idea: z.string().min(1).max(4000),
      analysis: analysisSchema,
    }),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured on the server.");

    const userPrompt = `PRODUCT/SERVICE IDEA:
${data.idea}

SALES POTENTIAL EVALUATION:
- Score: ${data.analysis.sales.score}/10
- Demand: ${data.analysis.sales.demand}
- Summary: ${data.analysis.sales.summary}
- Recommended pricing: ${data.analysis.sales.pricing.recommended} (low ${data.analysis.sales.pricing.low} / mid ${data.analysis.sales.pricing.mid} / premium ${data.analysis.sales.pricing.premium})
- Revenue scenarios: conservative ${data.analysis.sales.revenue.conservative}, moderate ${data.analysis.sales.revenue.moderate}, optimistic ${data.analysis.sales.revenue.optimistic}
- GTM moves: ${data.analysis.sales.gtm.join("; ")}

TARGET CUSTOMER:
${data.analysis.sales.targetCustomer}

MARKET CONTEXT:
- TAM/SAM/SOM: ${data.analysis.market.tam} / ${data.analysis.market.sam} / ${data.analysis.market.som}
- Competitors: ${data.analysis.market.competitors.map((c) => `${c.name} (${c.type})`).join(", ")}
- Trends: ${data.analysis.market.trends.map((t) => `${t.title} (${t.direction})`).join(", ")}

Run the full focus group now following the exact output format.`;

    const res = await fetch(GATEWAY, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: FOCUS_GROUP_SYSTEM },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (res.status === 429) throw new Error("Rate limited. Try again in a moment.");
    if (res.status === 402)
      throw new Error("AI credits exhausted. Add credits in Settings → Workspace → Usage.");
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("Focus group gateway error:", res.status, text);
      throw new Error(`AI gateway error (${res.status}).`);
    }

    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const transcript = json.choices?.[0]?.message?.content?.trim();
    if (!transcript) throw new Error("AI returned no focus group transcript.");
    return { transcript };
  });
