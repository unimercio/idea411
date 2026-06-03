import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { analysisSchema } from "./vetting.functions";
import { resolveSkill, withSkillPreamble } from "./skills.server";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-3-flash-preview";

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
});

export const chatAboutIdea = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      idea: z.string().min(1).max(4000),
      analysis: analysisSchema,
      messages: z.array(messageSchema).min(1).max(40),
    }),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured on the server.");

    const baseSystem = `You are the same senior product-innovation partner who produced the
vetting report below. You answer follow-up questions from the founder with
sharp, specific, actionable advice. Reference the report's scores and findings
when relevant. Be concise: 2–5 short paragraphs or a tight bulleted list.
Use Markdown. Never invent new scores — only the report below is authoritative.

ORIGINAL IDEA:
${data.idea}

VETTING REPORT (JSON):
${JSON.stringify(data.analysis)}`;

    const skill = await resolveSkill("chat");
    const systemPrompt = withSkillPreamble(baseSystem, skill);
    const model = skill?.model || DEFAULT_MODEL;

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
          ...data.messages,
        ],
      }),
    });

    if (res.status === 429) {
      throw new Error("Rate limited. Try again in a moment.");
    }
    if (res.status === 402) {
      throw new Error("AI credits exhausted. Add credits in Settings → Workspace → Usage.");
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("Chat gateway error:", res.status, text);
      throw new Error(`AI gateway error (${res.status}).`);
    }

    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const reply = json.choices?.[0]?.message?.content?.trim();
    if (!reply) throw new Error("AI returned no reply.");
    return { reply };
  });
