import { createServerFn } from "@tanstack/react-start";
import { checkAllServices, checkServiceHealth } from "@/lib/utils/health-check";
import { z } from "zod";

export const getSystemHealth = createServerFn({ method: "GET" }).handler(async () => {
  const services = await checkAllServices();
  // Model routing: complex → Grok-4.3 via LiteLLM; fast → Ollama local
  const litellm = services.find((s) => s.name === "litellm");
  const ollama = services.find((s) => s.name === "ollama");
  const routing = {
    complex: {
      label: "Grok-4.3 (complex tasks)",
      provider: "LiteLLM",
      ok: litellm?.status === "healthy" || litellm?.status === "degraded",
    },
    fast: {
      label: "Ollama (fast tasks)",
      provider: "Ollama",
      ok: ollama?.status === "healthy" || ollama?.status === "degraded",
    },
  };
  return { services, routing, checkedAt: new Date().toISOString() };
});

const serviceSchema = z.object({
  name: z.enum(["langflow", "litellm", "ollama", "hermes"]),
});

export const refreshServiceHealth = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => serviceSchema.parse(d))
  .handler(async ({ data }) => checkServiceHealth(data.name));
