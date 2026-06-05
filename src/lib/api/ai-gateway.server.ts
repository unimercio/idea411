// Resolves the chat-completions endpoint + auth for a given model id.
//
// Models stored as `openrouter/<provider>/<name>` (e.g. `openrouter/anthropic/claude-3.5-sonnet`)
// are routed to the OpenRouter API. Everything else goes through the Lovable
// AI gateway. The OpenRouter prefix is stripped before sending.
export type ResolvedEndpoint = {
  url: string;
  apiKey: string;
  model: string;
  extraHeaders?: Record<string, string>;
};

export const OPENROUTER_PREFIX = "openrouter/";

export function isOpenRouterModel(model: string): boolean {
  return model.startsWith(OPENROUTER_PREFIX);
}

export function resolveAiEndpoint(model: string): ResolvedEndpoint {
  if (isOpenRouterModel(model)) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error("OPENROUTER_API_KEY is not configured on the server.");
    return {
      url: "https://openrouter.ai/api/v1/chat/completions",
      apiKey,
      model: model.slice(OPENROUTER_PREFIX.length),
      extraHeaders: {
        "HTTP-Referer": "https://idea411.lovable.app",
        "X-Title": "IdeaForge",
      },
    };
  }
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured on the server.");
  return {
    url: "https://ai.gateway.lovable.dev/v1/chat/completions",
    apiKey,
    model,
  };
}

export function buildAiHeaders(ep: ResolvedEndpoint): Record<string, string> {
  return {
    Authorization: `Bearer ${ep.apiKey}`,
    "Content-Type": "application/json",
    ...(ep.extraHeaders ?? {}),
  };
}
