import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { OSShell } from "@/components/os/OSShell";
import { Activity, RefreshCw, CheckCircle2, AlertTriangle, CircleOff, Zap } from "lucide-react";
import { getSystemHealth } from "@/lib/api/system-health.functions";
import type { HealthCheckResult, HealthStatus } from "@/lib/utils/health-check";

export const Route = createFileRoute("/_authenticated/system")({
  head: () => ({ meta: [{ title: "System Status — Seven Day Ventures" }] }),
  component: SystemPage,
});

const STATUS_STYLES: Record<HealthStatus, { dot: string; label: string; text: string }> = {
  healthy: { dot: "bg-emerald-400", label: "Healthy", text: "text-emerald-300" },
  degraded: { dot: "bg-amber-400", label: "Degraded", text: "text-amber-300" },
  down: { dot: "bg-rose-500", label: "Down", text: "text-rose-300" },
  disabled: { dot: "bg-muted-foreground/40", label: "Not configured", text: "text-muted-foreground" },
};

function SystemPage() {
  const fn = useServerFn(getSystemHealth);
  const q = useQuery({
    queryKey: ["system-health"],
    queryFn: () => fn(),
    refetchInterval: 30_000,
  });

  const services = q.data?.services ?? [];
  const routing = q.data?.routing;

  return (
    <OSShell
      eyebrow="Infrastructure"
      title="System Status"
      description="Live health for Langflow, LiteLLM, Ollama, and Hermes plus model routing posture."
      actions={
        <button
          onClick={() => q.refetch()}
          disabled={q.isFetching}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-1/60 px-3 py-1.5 text-xs hover:bg-surface-2 transition disabled:opacity-60"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${q.isFetching ? "animate-spin" : ""}`} />
          {q.isFetching ? "Checking…" : "Refresh Status"}
        </button>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {services.map((s) => (
          <ServiceCard key={s.name} svc={s} />
        ))}
        {q.isLoading && services.length === 0 && (
          <p className="col-span-full text-sm text-muted-foreground">Checking services…</p>
        )}
      </div>

      <section className="mt-8 rounded-2xl border border-border bg-surface-1/40 p-5">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
          <Zap className="h-3.5 w-3.5 text-indigo" /> Model Routing
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <RoutingRow ok={routing?.complex.ok} label={routing?.complex.label ?? "Grok-4.3 (complex tasks)"} provider={routing?.complex.provider ?? "LiteLLM"} />
          <RoutingRow ok={routing?.fast.ok} label={routing?.fast.label ?? "Ollama (fast tasks)"} provider={routing?.fast.provider ?? "Ollama"} />
        </div>
        {q.data?.checkedAt && (
          <p className="mt-4 text-[11px] text-muted-foreground">
            Last checked {new Date(q.data.checkedAt).toLocaleTimeString()}
          </p>
        )}
      </section>
    </OSShell>
  );
}

function ServiceCard({ svc }: { svc: HealthCheckResult }) {
  const s = STATUS_STYLES[svc.status];
  const Icon =
    svc.status === "healthy"
      ? CheckCircle2
      : svc.status === "disabled"
      ? CircleOff
      : svc.status === "down"
      ? AlertTriangle
      : Activity;
  return (
    <div className="rounded-2xl border border-border bg-surface-1/40 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${s.dot}`} />
          <span className="text-sm font-medium">{svc.label}</span>
        </div>
        <Icon className={`h-4 w-4 ${s.text}`} />
      </div>
      <div className="mt-2 flex items-baseline justify-between">
        <span className={`text-xs font-medium ${s.text}`}>{s.label}</span>
        <span className="text-xs text-muted-foreground">
          {svc.latency != null ? `${svc.latency} ms` : "—"}
        </span>
      </div>
      {svc.error && (
        <p className="mt-2 line-clamp-2 text-[11px] text-muted-foreground">{svc.error}</p>
      )}
      <p className="mt-2 text-[10px] text-muted-foreground">
        {new Date(svc.lastChecked).toLocaleTimeString()}
      </p>
    </div>
  );
}

function RoutingRow({ ok, label, provider }: { ok?: boolean; label: string; provider: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-background/40 p-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-[11px] text-muted-foreground">via {provider}</p>
      </div>
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] ${
          ok
            ? "bg-emerald-500/15 text-emerald-300"
            : "bg-rose-500/15 text-rose-300"
        }`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-emerald-400" : "bg-rose-500"}`} />
        {ok ? "Routable" : "Unavailable"}
      </span>
    </div>
  );
}
