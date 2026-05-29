import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { campaignSchema } from "./campaign.functions";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
});

export const coachCampaign = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      idea: z.string().min(1).max(4000),
      campaign: campaignSchema,
      messages: z.array(messageSchema).min(1).max(40),
    }),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured on the server.");

    const systemPrompt = `You are an AI Campaign Coach — the same world-class crowdfunding
strategist who built the campaign below. The founder will ask you to refine sections,
strengthen copy, restructure tiers, or test alternatives. Be specific and actionable.
Use Markdown. Keep replies tight (2–5 paragraphs or a focused bulleted list).
Reference exact sections, tier names, and lines from the campaign when relevant.

ORIGINAL IDEA:
${data.idea}

CURRENT CAMPAIGN (JSON):
${JSON.stringify(data.campaign)}`;

    const res = await fetch(GATEWAY, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "system", content: systemPrompt }, ...data.messages],
      }),
    });

    if (res.status === 429) throw new Error("Rate limited. Try again in a moment.");
    if (res.status === 402)
      throw new Error("AI credits exhausted. Add credits in Settings → Workspace → Usage.");
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      console.error("Coach gateway error:", res.status, t);
      throw new Error(`AI gateway error (${res.status}).`);
    }
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const reply = json.choices?.[0]?.message?.content?.trim();
    if (!reply) throw new Error("AI returned no reply.");
    return { reply };
  });
