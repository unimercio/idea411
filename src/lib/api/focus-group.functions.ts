import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { analysisSchema, type Analysis } from "./vetting.functions";
import { resolveSkill, withSkillPreamble } from "./skills.server";
import { resolveAiEndpoint, buildAiHeaders } from "./ai-gateway.server";

export const FOCUS_GROUP_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
/** Fallback model used only if no enabled `focus_group` skill row exists. */
export const FOCUS_GROUP_MODEL = "openai/gpt-5-mini";

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

Step 2: Create 8 AI Personas (anchored to the Product Summary)
Use the Product Summary you just wrote — especially its Target Customer line and Focus Group Mandate — as the explicit rationale for who is in the room. Generate 8 diverse, realistic AI personas optimally selected for THIS specific focus group. These personas should:
- Represent a good spread across the target customer segments identified in the sales vetting.
- Include diversity in age, gender, ethnicity, location (urban/suburban/rural), income, profession, and tech adoption level.
- Reflect the sales potential insights (e.g. if sales potential is high among young professionals, include more of them); include at least 1–2 plausible skeptics or non-buyers to stress-test the mandate.

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
- Have each persona answer all 3 questions in their unique voice, reflecting their background, psychographics, and unique skill — and reasoning about the product *as framed in the Product Summary* (its pricing, demand context, and target-customer mandate), not a generic version of it.
- Moderate the discussion: allow personas to react to each other, agree/disagree, and build on ideas.
- End with a Moderator's Summary including key insights, consensus, risks, and recommendations.

Rules:
- Stay strictly in character for every persona.
- Use natural, conversational language matching their demographics and personality.
- Make responses vivid and distinct.
- Never break character or mention you are an AI.

Persona Behavior & Character Consistency Rules (STRICT — enforce for every persona turn):

1. Unique Skill Activation: Each persona MUST actively use their given Unique Skill in every response. They interpret the product, the question, and other personas' comments through the filter of that skill. Their opinions, critiques, and suggestions are visibly shaped by it — as a working lens, not a label.

2. Distinct Voice: First person with vocabulary, tone, cadence, and sentence rhythm that genuinely match their age, profession, region, education, and personality. A 19-year-old rural barista and a 54-year-old urban CFO must not sound alike. Use slang, jargon, idioms, or formality specific to them.

3. Lived-in Context: Weave personal life details naturally — kids, commute, budget pressures, hobbies, recent purchases, workplace anecdotes — never forced, never a bio dump. One concrete detail per turn is usually enough.

4. Psychographics Drive Reasoning: Their stated values, attitudes, and lifestyle must visibly drive WHY they like, dislike, hesitate, or get excited. No generic "this sounds useful" reactions — every opinion is anchored to who they are.

5. Length: Keep each persona turn to 2–5 sentences unless explicitly asked for more. Tight, vivid, character-rich turns beat long generic monologues.

6. Interaction: Personas react to each other by name — agree, push back, or build on points — filtered through their own skill and worldview. Disagreement is encouraged when true to character.

Naturalness Rules (CRITICAL — the #1 failure mode is sounding like a survey response or a corporate focus group transcript):

7. Talk Like Real People in a Room, Not Like Marketers: No phrases like "I appreciate the value proposition", "this product offers", "the target demographic", "speaking as a [profession]", "from my perspective as a...", "key differentiator", "pain point", "user experience", "I would purchase", "I would recommend". Real people say "I'd buy it", "I'd tell my sister about it", "nah", "yeah but", "wait —", "okay so". Strip ALL business/MBA vocabulary unless the persona is literally an MBA and even then sparingly.

8. Messy, Mid-Thought Speech: Use contractions always (I'd, won't, gonna, kinda). Allow false starts, self-corrections, trailing off with "...", interruptions, half-sentences, "I mean", "like", "honestly", "ugh", "hmm", "wait", profanity-light fillers appropriate to the persona. Not every sentence needs to be grammatical or land cleanly.

9. React to the LAST thing said, not the question in the abstract: When a persona speaks after another persona, they pick up on a specific word or claim that person just made — agree with it, mock it, twist it, or push back. They do NOT restart from the question. This makes it feel like a conversation, not parallel monologues.

10. Concrete > Abstract: Replace generic claims with a specific moment, price, brand, person, or memory. Instead of "I care about quality" → "my last pair lasted four months before the strap snapped at Coachella". Instead of "it would save time" → "I'd get fifteen minutes back before school dropoff". One specific detail beats three abstract adjectives.

11. Emotional Texture: Show actual feelings — annoyance, excitement, suspicion, nostalgia, fatigue, FOMO, guilt — not "I feel positive about this". If they're skeptical, sound skeptical. If they're excited, sound excited (without exclamation-mark spam).

12. Banned Openings: Do NOT start turns with "As a [role]", "Speaking as a...", "From my perspective", "I think this product", "This is interesting because", "I love that..." (only the last is okay if followed by something genuinely specific). Vary openings — questions, reactions, one-word starts ("Okay.", "Nope.", "Hmm."), addressing another persona by name.

13. Disagreement and Tangents Are Good: At least a few turns per question should push back, go off on a tangent, change their mind mid-sentence, or admit something contradictory. Perfect agreement is unrealistic and reads as fake.

Product Summary Rule (CRITICAL — this section is the CONTEXT for everything that follows):

The Product Summary is NOT just a recap of the user's raw idea. It is a tight synthesis that fuses THREE inputs into the single shared context the personas, questions, and discussion all draw from:
  (a) the user's original idea — preserved faithfully (see Fidelity sub-rules below),
  (b) the Sales Potential Evaluation (score, demand, pricing, revenue scenarios, GTM moves),
  (c) the Target Customer profile and Market Context (TAM/SAM/SOM, competitors, trends).

Requirements:
- Lead with a 1–2 sentence faithful recap of the idea (verbatim intent, no softening).
- Then summarize what the sales vetting concluded: demand level, score, recommended price point, and the headline GTM insight.
- Then summarize the target customer in human terms: who they are, what they want, where they hurt, what would make them buy.
- Close with a one-line "Focus Group Mandate" stating what this group exists to pressure-test (e.g. "validate $X pricing with budget-conscious urban renters and probe the durability objection").
- This Product Summary MUST then be treated as binding context for Steps 2–4: persona selection must be justified by it, the 3 questions must target the risks/unknowns it surfaces, and every persona response must be reasoning about THIS product as framed here — not a generic version of it.

Fidelity sub-rules (still apply to the recap portion):
- NEVER rewrite, soften, sanitize, censor, water down, moralize about, or "improve" the idea.
- NEVER add disclaimers, warnings, ethical caveats, or refuse to summarize. Do NOT swap words for euphemisms.
- Preserve the user's wording, tone, scope, target audience, edgy/controversial/adult/political/risky angles, and any specific names, claims, or terminology.
- If something seems ambiguous, keep it ambiguous — do not invent or remove details.
- If you genuinely cannot summarize a portion as-is, ask the user for permission before changing it. Do not silently alter it.
- Do NOT invent sales numbers, demand levels, competitors, or customer traits not present in the provided evaluation.

Output Format (strict, using Markdown headings):

## Product Summary
**The Idea:** [faithful 1–2 sentence recap — preserve wording, scope, intent]
**Sales Vetting Signal:** [demand, score/10, recommended price, top GTM move — drawn from the evaluation]
**Target Customer:** [who they are, core motivation, top objection — drawn from the target customer + market context]
**Focus Group Mandate:** [one sentence on what this group must validate or stress-test]


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
    const skill = await resolveSkill("focus_group");
    const ep = resolveAiEndpoint(skill?.model ?? FOCUS_GROUP_MODEL);
    const systemPrompt = withSkillPreamble(FOCUS_GROUP_SYSTEM, skill);

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

    const res = await fetch(ep.url, {
      method: "POST",
      headers: buildAiHeaders(ep),
      body: JSON.stringify({
        model: ep.model,
        messages: [
          { role: "system", content: systemPrompt },
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

// ---------------------------------------------------------------------------
// Admin: short sanity-check run using the currently-resolved focus_group skill.
// ---------------------------------------------------------------------------
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TEST_USER_PROMPT = `Sample idea: "A subscription dog-walking app that pairs owners with vetted local walkers."

Run a SHORT warm-up focus group: introduce exactly TWO personas (one skeptical, one enthusiastic), give each persona ONE 2-3 sentence hot take on the idea, then a one-line moderator summary. Keep the whole thing under 200 words.`;

export const testFocusGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const { data: isAdmin, error: roleErr } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (roleErr) throw new Error(roleErr.message);
    if (!isAdmin) throw new Error("Forbidden: admin role required");

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured on the server.");

    const skill = await resolveSkill("focus_group");
    const model = skill?.model ?? FOCUS_GROUP_MODEL;
    const systemPrompt = withSkillPreamble(FOCUS_GROUP_SYSTEM, skill);

    const res = await fetch(GATEWAY, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: TEST_USER_PROMPT },
        ],
      }),
    });

    if (res.status === 429) throw new Error("Rate limited. Try again in a moment.");
    if (res.status === 402)
      throw new Error("AI credits exhausted. Add credits in Settings → Workspace → Usage.");
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("Focus group test gateway error:", res.status, text);
      throw new Error(`AI gateway error (${res.status}).`);
    }

    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const output = json.choices?.[0]?.message?.content?.trim();
    if (!output) throw new Error("AI returned no output.");
    return {
      model,
      skillName: skill?.name ?? null,
      output,
    };
  });
