// Centralized service configuration. Reads from process.env at call time
// (server-only execution). Safe to import from server fns / server-only files.

export type ServiceName = "langflow" | "litellm" | "ollama" | "hermes";

export interface ServiceConfig {
  name: ServiceName;
  label: string;
  baseUrl: string;
  apiKey?: string;
  healthPath: string;
  enabled: boolean;
}

const env = (k: string, fallback = "") => (process.env[k] ?? fallback).trim();

export function getServiceConfig(name: ServiceName): ServiceConfig {
  switch (name) {
    case "langflow": {
      const baseUrl = env("LANGFLOW_BASE_URL", "http://localhost:7860");
      return {
        name,
        label: "Langflow",
        baseUrl,
        apiKey: env("LANGFLOW_API_KEY") || undefined,
        healthPath: "/health",
        enabled: !!baseUrl,
      };
    }
    case "litellm": {
      const baseUrl = env("LITELLM_BASE_URL", "http://localhost:4000");
      return {
        name,
        label: "LiteLLM",
        baseUrl,
        apiKey: env("LITELLM_API_KEY") || undefined,
        healthPath: "/health/liveliness",
        enabled: !!baseUrl,
      };
    }
    case "ollama": {
      const baseUrl = env("OLLAMA_BASE_URL", "http://localhost:11434");
      return {
        name,
        label: "Ollama",
        baseUrl,
        healthPath: "/api/tags",
        enabled: !!baseUrl,
      };
    }
    case "hermes": {
      const baseUrl = env("HERMES_BASE_URL");
      return {
        name,
        label: "Hermes Gateway",
        baseUrl,
        healthPath: "/health",
        enabled: !!baseUrl,
      };
    }
  }
}

export function getAllServiceConfigs(): ServiceConfig[] {
  return (["langflow", "litellm", "ollama", "hermes"] as const).map(getServiceConfig);
}

export function getHealthUrl(name: ServiceName): string | null {
  const cfg = getServiceConfig(name);
  if (!cfg.enabled) return null;
  return `${cfg.baseUrl.replace(/\/$/, "")}${cfg.healthPath}`;
}

export function getLangflowDefaultFlowId(): string {
  return env("LANGFLOW_DEFAULT_FLOW_ID", "Venture Incubator v3 - LiteLLM");
}

export function getLangflowFlowUrl(flowId?: string): string {
  const cfg = getServiceConfig("langflow");
  const id = encodeURIComponent(flowId ?? getLangflowDefaultFlowId());
  return `${cfg.baseUrl.replace(/\/$/, "")}/api/v1/run/${id}`;
}

export function getLiteLLMChatUrl(): string {
  const cfg = getServiceConfig("litellm");
  return `${cfg.baseUrl.replace(/\/$/, "")}/v1/chat/completions`;
}
