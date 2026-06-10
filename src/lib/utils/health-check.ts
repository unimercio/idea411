// Server-only health-check helpers. Only call from createServerFn handlers.
import {
  getAllServiceConfigs,
  getHealthUrl,
  getServiceConfig,
  type ServiceName,
} from "@/lib/config/services";

export type HealthStatus = "healthy" | "degraded" | "down" | "disabled";

export interface HealthCheckResult {
  name: ServiceName;
  label: string;
  status: HealthStatus;
  latency: number | null;
  lastChecked: string;
  error?: string;
  url?: string;
}

const TIMEOUT_MS = 4000;

export async function checkServiceHealth(name: ServiceName): Promise<HealthCheckResult> {
  const cfg = getServiceConfig(name);
  const lastChecked = new Date().toISOString();
  if (!cfg.enabled) {
    return { name, label: cfg.label, status: "disabled", latency: null, lastChecked };
  }
  const url = getHealthUrl(name)!;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (cfg.apiKey) headers.Authorization = `Bearer ${cfg.apiKey}`;

  const started = Date.now();
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { method: "GET", headers, signal: ctrl.signal });
    const latency = Date.now() - started;
    if (!res.ok) {
      return {
        name,
        label: cfg.label,
        status: res.status >= 500 ? "down" : "degraded",
        latency,
        lastChecked,
        error: `HTTP ${res.status}`,
        url,
      };
    }
    return {
      name,
      label: cfg.label,
      status: latency > 1500 ? "degraded" : "healthy",
      latency,
      lastChecked,
      url,
    };
  } catch (e) {
    return {
      name,
      label: cfg.label,
      status: "down",
      latency: null,
      lastChecked,
      error: e instanceof Error ? e.message : "Network error",
      url,
    };
  } finally {
    clearTimeout(t);
  }
}

export async function checkAllServices(): Promise<HealthCheckResult[]> {
  const cfgs = getAllServiceConfigs();
  return Promise.all(cfgs.map((c) => checkServiceHealth(c.name)));
}
