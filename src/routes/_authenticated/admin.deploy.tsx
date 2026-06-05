import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Loader2,
  Rocket,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Clock,
  CircleDot,
  Terminal,
  HeartPulse,
} from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { checkAdmin } from "@/lib/api/prompt-templates.functions";
import {
  triggerVpsDeploy,
  listVpsDeployRuns,
  getDeployRunDetail,
  type DeployRun,
  type DeployStep,
  type DeployJob,
} from "@/lib/api/deploy.functions";
import { NotAuthorized } from "@/components/site/NotAuthorized";
import { AdminHeader } from "@/components/site/AdminHeader";

export const Route = createFileRoute("/_authenticated/admin/deploy")({
  head: () => ({
    meta: [
      { title: "Deploy — Admin" },
      { name: "description", content: "Trigger a deploy to the Hostinger VPS." },
    ],
  }),
  component: DeployPage,
});

function DeployPage() {
  const checkAdminFn = useServerFn(checkAdmin);
  const adminQ = useQuery({ queryKey: ["isAdmin"], queryFn: () => checkAdminFn() });

  const listFn = useServerFn(listVpsDeployRuns);
  const runsQ = useQuery({
    queryKey: ["admin", "deploy-runs"],
    queryFn: () => listFn(),
    enabled: adminQ.data?.isAdmin === true,
    refetchInterval: 8000,
  });

  const triggerFn = useServerFn(triggerVpsDeploy);
  const qc = useQueryClient();
  const [ref, setRef] = useState("main");

  const trigger = useMutation({
    mutationFn: (r: string) => triggerFn({ data: { ref: r } }),
    onSuccess: (res) => {
      toast.success(`Deploy dispatched for ${res.dispatchedRef}`);
      setTimeout(() => qc.invalidateQueries({ queryKey: ["admin", "deploy-runs"] }), 1500);
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to dispatch deploy"),
  });

  if (adminQ.isLoading) {
    return (
      <div className="grid h-screen place-items-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }
  if (!adminQ.data?.isAdmin) return <NotAuthorized area="the deploy console" />;

  const runs = runsQ.data?.runs ?? [];
  const inFlight = runs.some((r) => r.status === "queued" || r.status === "in_progress");

  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const activeRunId =
    selectedRunId ?? runs.find((r) => r.status === "in_progress" || r.status === "queued")?.id ?? runs[0]?.id ?? null;
  const activeRun = runs.find((r) => r.id === activeRunId) ?? null;

  return (
    <>
      <AdminHeader label="Deploy" />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <Link
          to="/admin"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to admin
        </Link>
        <div className="mt-2">
          <h1 className="font-display text-3xl font-semibold">Deploy to Hostinger VPS</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Dispatches the <code className="text-foreground">deploy-vps.yml</code> GitHub Action,
            which SSHes into your VPS and runs <code className="text-foreground">deploy/deploy.sh</code>.
          </p>
        </div>

        <section className="mt-8 rounded-3xl border border-border bg-card/80 p-6 shadow-elegant">
          <h2 className="font-display text-lg font-semibold">Trigger deploy</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Pick a branch, tag, or commit SHA. Defaults to <code>main</code>.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Input
              value={ref}
              onChange={(e) => setRef(e.target.value)}
              placeholder="main"
              className="w-64"
              disabled={trigger.isPending}
            />
            <button
              onClick={() => trigger.mutate(ref.trim() || "main")}
              disabled={trigger.isPending || inFlight}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-ember px-5 py-2.5 text-sm font-medium text-ember-foreground shadow-ember hover:brightness-110 transition disabled:opacity-50"
            >
              {trigger.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Rocket className="h-4 w-4" />
              )}
              {inFlight ? "Deploy in progress…" : "Deploy now"}
            </button>
            <button
              onClick={() => runsQ.refetch()}
              className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${runsQ.isFetching ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </section>

        {activeRunId && activeRun ? (
          <LiveConsole
            runId={activeRunId}
            run={activeRun}
            isActiveDefault={selectedRunId === null}
          />
        ) : null}



        <section className="mt-8">
          <h2 className="font-display text-lg font-semibold">Recent runs</h2>
          {runsQ.isLoading ? (
            <div className="mt-4 text-sm text-muted-foreground">
              <Loader2 className="inline h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : runsQ.error ? (
            <div className="mt-4 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
              {(runsQ.error as Error).message}
            </div>
          ) : runs.length === 0 ? (
            <div className="mt-4 text-sm text-muted-foreground">No deploys yet.</div>
          ) : (
            <ul className="mt-4 space-y-2">
              {runs.map((r) => (
                <RunRow
                  key={r.id}
                  run={r}
                  selected={r.id === activeRunId}
                  onSelect={() => setSelectedRunId(r.id)}
                />
              ))}
            </ul>
          )}
        </section>

        <section className="mt-10 rounded-2xl border border-border bg-muted/30 p-5 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">First time?</p>
          <p className="mt-1">
            See <code>deploy/README.md</code> in the repo for VPS setup, SSH key, and the
            list of GitHub repository secrets to add (<code>VPS_HOST</code>,{" "}
            <code>VPS_USER</code>, <code>VPS_SSH_KEY</code>, <code>VPS_APP_DIR</code>).
          </p>
        </section>
      </main>
    </>
  );
}

function RunRow({
  run,
  selected,
  onSelect,
}: {
  run: DeployRun;
  selected: boolean;
  onSelect: () => void;
}) {
  const { icon, color, label } = statusFor(run);
  return (
    <li>
      <button
        onClick={onSelect}
        className={`flex w-full items-center justify-between gap-4 rounded-2xl border p-4 text-left transition ${
          selected
            ? "border-ember/60 bg-card shadow-ember/30"
            : "border-border bg-card/60 hover:border-ember/30"
        }`}
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className={color}>{icon}</span>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">
              #{run.run_number} · {run.display_title}
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {run.head_branch ?? "—"} · {run.actor ?? "system"} ·{" "}
              {new Date(run.updated_at).toLocaleString()}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{label}</Badge>
          <a
            href={run.html_url}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            GitHub <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </button>
    </li>
  );
}

function LiveConsole({
  runId,
  run,
  isActiveDefault,
}: {
  runId: number;
  run: DeployRun;
  isActiveDefault: boolean;
}) {
  const detailFn = useServerFn(getDeployRunDetail);
  const isRunning = run.status === "in_progress" || run.status === "queued" || run.status === "waiting";

  const detailQ = useQuery({
    queryKey: ["admin", "deploy-run", runId],
    queryFn: () => detailFn({ data: { runId } }),
    refetchInterval: isRunning ? 2000 : isActiveDefault ? 8000 : false,
  });

  const job: DeployJob | undefined = detailQ.data?.jobs?.[0];
  const logs = detailQ.data?.logs ?? null;
  const logsTruncated = detailQ.data?.logsTruncated ?? false;

  const logRef = useRef<HTMLPreElement>(null);
  const [stickToBottom, setStickToBottom] = useState(true);

  useEffect(() => {
    if (!logRef.current || !stickToBottom) return;
    logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs, stickToBottom]);

  const cleanedLogs = useMemo(() => stripGhTimestamps(logs ?? ""), [logs]);

  return (
    <section className="mt-8 rounded-3xl border border-border bg-card/80 p-6 shadow-elegant">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-ember" />
          <h2 className="font-display text-lg font-semibold">
            Live console · run #{run.run_number}
          </h2>
          {isRunning ? (
            <Badge className="bg-ember/20 text-ember border-ember/40">
              <Loader2 className="mr-1 h-3 w-3 animate-spin" /> streaming
            </Badge>
          ) : (
            <Badge variant="outline">{run.conclusion ?? run.status ?? "done"}</Badge>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <a
            href={run.html_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 hover:text-foreground"
          >
            Open in GitHub <ExternalLink className="h-3 w-3" />
          </a>
          <button
            onClick={() => detailQ.refetch()}
            className="inline-flex items-center gap-1 hover:text-foreground"
          >
            <RefreshCw className={`h-3 w-3 ${detailQ.isFetching ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {detailQ.isLoading && !detailQ.data ? (
        <div className="mt-4 text-sm text-muted-foreground">
          <Loader2 className="inline h-4 w-4 animate-spin" /> Loading job…
        </div>
      ) : detailQ.error ? (
        <div className="mt-4 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {(detailQ.error as Error).message}
        </div>
      ) : !job ? (
        <div className="mt-4 text-sm text-muted-foreground">
          Job hasn't started yet. GitHub usually picks it up within 10–20 seconds.
        </div>
      ) : (
        <>
          <HealthCard job={job} isRunning={isRunning} />

          <ol className="mt-5 space-y-1.5">
            {job.steps.map((s) => (
              <StepRow key={`${s.number}-${s.name}`} step={s} />
            ))}
          </ol>

          <div className="mt-5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>SSH stdout / stderr {logsTruncated ? "(tail, truncated)" : ""}</span>
              <label className="inline-flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={stickToBottom}
                  onChange={(e) => setStickToBottom(e.target.checked)}
                  className="h-3 w-3 accent-ember"
                />
                Auto-scroll
              </label>
            </div>
            <pre
              ref={logRef}
              className="mt-2 h-96 overflow-auto rounded-2xl border border-border bg-[#0b0f17] p-4 font-mono text-xs leading-relaxed text-emerald-200"
            >
              {cleanedLogs ||
                (isRunning
                  ? "Waiting for the SSH step to finish before logs are available from GitHub…"
                  : "No logs available.")}
            </pre>
          </div>
        </>
      )}
    </section>
  );
}

function StepRow({ step }: { step: DeployStep }) {
  const meta = stepStatus(step);
  return (
    <li className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/40 px-3 py-2 text-sm">
      <span className={meta.color}>{meta.icon}</span>
      <span className="flex-1 truncate">{step.name}</span>
      <span className="text-xs text-muted-foreground">{meta.label}</span>
    </li>
  );
}

function stepStatus(s: DeployStep) {
  if (s.status === "in_progress") {
    return { icon: <Loader2 className="h-4 w-4 animate-spin" />, color: "text-ember", label: "running" };
  }
  if (s.status === "queued" || s.status === "pending") {
    return { icon: <CircleDot className="h-4 w-4" />, color: "text-muted-foreground", label: "queued" };
  }
  if (s.conclusion === "success") {
    return { icon: <CheckCircle2 className="h-4 w-4" />, color: "text-emerald-500", label: "ok" };
  }
  if (s.conclusion === "skipped") {
    return { icon: <Clock className="h-4 w-4" />, color: "text-muted-foreground", label: "skipped" };
  }
  if (s.conclusion === "failure" || s.conclusion === "timed_out" || s.conclusion === "cancelled") {
    return { icon: <XCircle className="h-4 w-4" />, color: "text-destructive", label: s.conclusion };
  }
  return { icon: <Clock className="h-4 w-4" />, color: "text-muted-foreground", label: s.status ?? "—" };
}

// GitHub job logs prefix every line with an ISO timestamp; strip it for readability.
function stripGhTimestamps(text: string): string {
  if (!text) return "";
  return text
    .split("\n")
    .map((line) => line.replace(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z\s?/, ""))
    .join("\n");
}

function statusFor(r: DeployRun) {
  if (r.status === "in_progress" || r.status === "queued" || r.status === "waiting") {
    return {
      icon: <Loader2 className="h-4 w-4 animate-spin" />,
      color: "text-ember",
      label: r.status,
    };
  }
  if (r.conclusion === "success") {
    return { icon: <CheckCircle2 className="h-4 w-4" />, color: "text-emerald-500", label: "success" };
  }
  if (r.conclusion === "failure" || r.conclusion === "timed_out") {
    return { icon: <XCircle className="h-4 w-4" />, color: "text-destructive", label: r.conclusion };
  }
  return { icon: <Clock className="h-4 w-4" />, color: "text-muted-foreground", label: r.conclusion ?? r.status ?? "unknown" };
}

type HealthCheckKind = "pm2" | "port" | "local" | "public";
const HEALTH_CHECKS: { kind: HealthCheckKind; label: string; match: RegExp }[] = [
  { kind: "pm2", label: "PM2 process online", match: /pm2 process up/i },
  { kind: "port", label: "Port 3000 listening", match: /port 3000 listening/i },
  { kind: "local", label: "Local smoke request", match: /local smoke request/i },
  { kind: "public", label: "Public smoke request", match: /public smoke request/i },
];

type LiveHealth =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "ok"; latencyMs: number; uptimeSeconds?: number | null; commit?: string | null }
  | { state: "error"; message: string };

function HealthCard({ job, isRunning }: { job: DeployJob; isRunning: boolean }) {
  const [live, setLive] = useState<LiveHealth>({ state: "idle" });

  const runHealthPing = async () => {
    setLive({ state: "loading" });
    const started = performance.now();
    try {
      const res = await fetch("/api/public/health", { cache: "no-store" });
      const latencyMs = Math.round(performance.now() - started);
      if (!res.ok) {
        setLive({ state: "error", message: `HTTP ${res.status}` });
        return;
      }
      const body = await res.json();
      setLive({
        state: "ok",
        latencyMs,
        uptimeSeconds: body?.uptimeSeconds ?? null,
        commit: body?.commit ?? null,
      });
    } catch (e: any) {
      setLive({ state: "error", message: e?.message ?? "Network error" });
    }
  };

  // Auto-ping once the workflow finishes, then let the user re-ping manually.
  useEffect(() => {
    if (!isRunning && live.state === "idle") {
      void runHealthPing();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning]);

  const summary = HEALTH_CHECKS.map((hc) => {
    const step = job.steps.find((s) => hc.match.test(s.name));
    return { ...hc, step };
  });

  const overall = summary.every(
    (s) => s.step?.conclusion === "success" || s.step?.conclusion === "skipped",
  )
    ? "ok"
    : summary.some((s) => s.step?.conclusion === "failure" || s.step?.conclusion === "timed_out")
      ? "fail"
      : "pending";

  return (
    <div className="mt-5 rounded-2xl border border-border bg-background/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <HeartPulse
            className={`h-4 w-4 ${
              overall === "ok" ? "text-emerald-500" : overall === "fail" ? "text-destructive" : "text-ember"
            }`}
          />
          <h3 className="font-display text-sm font-semibold">Post-deploy health</h3>
          <Badge variant="outline" className="text-xs">
            {overall === "ok" ? "all checks passed" : overall === "fail" ? "failures detected" : "pending"}
          </Badge>
        </div>
        <button
          onClick={runHealthPing}
          disabled={live.state === "loading"}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${live.state === "loading" ? "animate-spin" : ""}`} />
          Re-ping /api/public/health
        </button>
      </div>

      <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
        {summary.map((s) => {
          const meta = s.step
            ? stepStatus(s.step)
            : { icon: <CircleDot className="h-4 w-4" />, color: "text-muted-foreground", label: "skipped" };
          return (
            <li
              key={s.kind}
              className="flex items-center gap-2 rounded-lg border border-border/50 bg-card/40 px-3 py-1.5 text-xs"
            >
              <span className={meta.color}>{meta.icon}</span>
              <span className="flex-1 truncate">{s.label}</span>
              <span className="text-muted-foreground">{meta.label}</span>
            </li>
          );
        })}
      </ul>

      <div className="mt-3 rounded-lg border border-border/50 bg-card/40 px-3 py-2 text-xs">
        <span className="font-medium">Live ping from your browser: </span>
        {live.state === "idle" ? (
          <span className="text-muted-foreground">not run yet</span>
        ) : live.state === "loading" ? (
          <span className="inline-flex items-center gap-1 text-ember">
            <Loader2 className="h-3 w-3 animate-spin" /> calling…
          </span>
        ) : live.state === "ok" ? (
          <span className="inline-flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-emerald-500">
              <CheckCircle2 className="h-3 w-3" /> 200 OK
            </span>
            <span className="text-muted-foreground">
              {live.latencyMs}ms
              {typeof live.uptimeSeconds === "number" ? ` · uptime ${live.uptimeSeconds}s` : ""}
              {live.commit ? ` · ${live.commit.slice(0, 7)}` : ""}
            </span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-destructive">
            <XCircle className="h-3 w-3" /> {live.message}
          </span>
        )}
      </div>
    </div>
  );
}

