import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type OpenRouterModel = {
  id: string; // e.g. "anthropic/claude-3.5-sonnet"
  name: string;
  context_length?: number;
};

// Admin-only: lists chat models available from OpenRouter so they can be
// picked in the Skills admin page. Each returned id should be stored as
// `openrouter/<id>` so the gateway resolver routes calls to OpenRouter.
export const listOpenRouterModels = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error("OPENROUTER_API_KEY is not configured on the server.");

    const res = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("OpenRouter models error:", res.status, text);
      throw new Error(`OpenRouter error (${res.status}).`);
    }
    const json = (await res.json()) as { data?: Array<Record<string, unknown>> };
    const models: OpenRouterModel[] = (json.data ?? [])
      .map((m) => ({
        id: String(m.id ?? ""),
        name: String(m.name ?? m.id ?? ""),
        context_length: typeof m.context_length === "number" ? m.context_length : undefined,
      }))
      .filter((m) => m.id.length > 0)
      .sort((a, b) => a.id.localeCompare(b.id));
    return { models };
  });
