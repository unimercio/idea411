import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getLiteLLMChatUrl, getServiceConfig } from "@/lib/config/services";

const inputSchema = z.object({
  idea: z.string().min(5).max(8000),
  mode: z.enum(["quick", "detailed"]).default("quick"),
});

const SYSTEM_PROMPT = `You are an expert venture analyst at the Seven Day Ventures incubator.
Refine the user's raw idea into a crisp, investor-ready statement.
- Preserve the user's intent and voice.
- Add only what is necessary to make the value proposition, target customer, and primary mechanism unambiguous.
- Do NOT invent fake numbers, brands, or customers.
Return only the refined idea — no preamble, no commentary.`;

const DETAILED_PROMPT = `${SYSTEM_PROMPT}
For detailed mode, expand to 4-6 short sentences covering: (1) the customer & pain, (2) the solution, (3) why now, (4) early go-to-market wedge.`;

export interface EnhanceIdeaResult {
  ok: boolean;
  refined: string;
  model: string;
  error?: string;
}

export const enhanceIdea = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => inputSchema.parse(d))
  .handler(async ({ data }): Promise<EnhanceIdeaResult> => {
    const cfg = getServiceConfig("litellm");
    if (!cfg.enabled) {
      return {
        ok: false,
        refined: data.idea,
        model: "",
        error: "LiteLLM base URL is not configured.",
      };
    }
    const url = getLiteLLMChatUrl();
    const model = data.mode === "detailed" ? "grok-4" : "ollama/llama3.1";
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (cfg.apiKey) headers.Authorization = `Bearer ${cfg.apiKey}`;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: data.mode === "detailed" ? DETAILED_PROMPT : SYSTEM_PROMPT },
            { role: "user", content: data.idea },
          ],
          temperature: 0.4,
        }),
      });
      const text = await res.text();
      let json: { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } } | string;
      try {
        json = JSON.parse(text);
      } catch {
        json = text;
      }
      if (!res.ok) {
        const msg =
          typeof json === "string"
            ? json.slice(0, 300)
            : json.error?.message ?? `LiteLLM HTTP ${res.status}`;
        return { ok: false, refined: data.idea, model, error: msg };
      }
      const refined =
        typeof json === "object" ? json.choices?.[0]?.message?.content?.trim() ?? "" : "";
      if (!refined) {
        return { ok: false, refined: data.idea, model, error: "Empty response from model." };
      }
      return { ok: true, refined, model };
    } catch (e) {
      return {
        ok: false,
        refined: data.idea,
        model,
        error: e instanceof Error ? e.message : "Network error reaching LiteLLM",
      };
    }
  });
