import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  getLangflowDefaultFlowId,
  getLangflowFlowUrl,
  getServiceConfig,
} from "@/lib/config/services";

const inputSchema = z.object({
  idea: z.string().min(3).max(8000),
  flowId: z.string().min(1).max(200).optional(),
  tweaks: z.record(z.string(), z.unknown()).optional(),
});

export interface LangflowRunResult {
  flowId: string;
  ok: boolean;
  report: string;
  rawJson?: string;
  durationMs: number;
  error?: string;
}

function extractReport(payload: unknown): string {
  // Best-effort flatten of Langflow's nested response shape
  try {
    const p = payload as Record<string, unknown>;
    const outputs = (p?.outputs as Array<Record<string, unknown>>) ?? [];
    const parts: string[] = [];
    for (const o of outputs) {
      const inner = (o?.outputs as Array<Record<string, unknown>>) ?? [];
      for (const x of inner) {
        const results = (x?.results as Record<string, unknown>) ?? {};
        const msg = (results?.message as Record<string, unknown>) ?? {};
        const text = (msg?.text as string) ?? (results?.text as string);
        if (typeof text === "string" && text.trim()) parts.push(text.trim());
      }
    }
    if (parts.length) return parts.join("\n\n");
  } catch {
    /* fall through */
  }
  return typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
}

export const triggerLangflowWorkflow = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => inputSchema.parse(d))
  .handler(async ({ data }): Promise<LangflowRunResult> => {
    const cfg = getServiceConfig("langflow");
    const flowId = data.flowId ?? getLangflowDefaultFlowId();
    const url = getLangflowFlowUrl(flowId);
    const started = Date.now();
    if (!cfg.enabled) {
      return {
        flowId,
        ok: false,
        report: "",
        durationMs: 0,
        error: "Langflow base URL is not configured.",
      };
    }
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (cfg.apiKey) headers["x-api-key"] = cfg.apiKey;

    try {
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          input_value: data.idea,
          output_type: "chat",
          input_type: "chat",
          tweaks: data.tweaks ?? {},
        }),
      });
      const durationMs = Date.now() - started;
      const text = await res.text();
      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        json = text;
      }
      if (!res.ok) {
        return {
          flowId,
          ok: false,
          report: "",
          raw: json,
          durationMs,
          error: `Langflow HTTP ${res.status}: ${typeof json === "string" ? json.slice(0, 400) : (json as { detail?: string })?.detail ?? "request failed"}`,
        };
      }
      return {
        flowId,
        ok: true,
        report: extractReport(json),
        raw: json,
        durationMs,
      };
    } catch (e) {
      return {
        flowId,
        ok: false,
        report: "",
        durationMs: Date.now() - started,
        error: e instanceof Error ? e.message : "Network error reaching Langflow",
      };
    }
  });

export const listLangflowFlows = createServerFn({ method: "GET" }).handler(async () => {
  // Langflow's flow-listing API is not always enabled; return the configured default
  // plus a placeholder list. Users can add more flow IDs in env.
  return {
    flows: [
      {
        id: getLangflowDefaultFlowId(),
        name: getLangflowDefaultFlowId(),
        description:
          "End-to-end venture analysis pipeline orchestrating market, compliance, sales, and strategic review.",
        isDefault: true,
      },
    ],
  };
});
