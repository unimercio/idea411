import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { OSShell } from "@/components/os/OSShell";
import { Workflow, Play, Loader2, CheckCircle2, AlertTriangle, Clock } from "lucide-react";
import { toast } from "sonner";
import {
  listLangflowFlows,
  triggerLangflowWorkflow,
  type LangflowRunResult,
} from "@/lib/api/trigger-langflow-workflow.functions";

export const Route = createFileRoute("/_authenticated/workflows")({
  head: () => ({ meta: [{ title: "Workflows — Seven Day Ventures" }] }),
  component: WorkflowsPage,
});

function WorkflowsPage() {
  const listFn = useServerFn(listLangflowFlows);
  const triggerFn = useServerFn(triggerLangflowWorkflow);
  const flowsQuery = useQuery({
    queryKey: ["langflow", "flows"],
    queryFn: () => listFn(),
  });

  const [flowId, setFlowId] = useState<string>("");
  const [idea, setIdea] = useState<string>("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<LangflowRunResult | null>(null);

  const flows = flowsQuery.data?.flows ?? [];
  const selectedId = flowId || flows[0]?.id || "";

  const launch = async () => {
    if (!idea.trim()) return toast.error("Add a venture idea to pass into the workflow.");
    setRunning(true);
    setResult(null);
    try {
      const res = await triggerFn({ data: { idea: idea.trim(), flowId: selectedId } });
      setResult(res);
      if (res.ok) toast.success(`Workflow returned in ${(res.durationMs / 1000).toFixed(1)}s`);
      else toast.error(res.error ?? "Workflow failed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to launch workflow");
    } finally {
      setRunning(false);
    }
  };

  return (
    <OSShell
      eyebrow="Workflows"
      title="Workflow Launcher"
      description="Launch Langflow pipelines and stream the resulting venture reports."
    >
      <div className="grid gap-6 lg:grid-cols-[1.05fr,1fr]">
        <section className="rounded-2xl border border-border bg-surface-1/40 p-5">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
            <Workflow className="h-3.5 w-3.5 text-indigo" /> Pipeline
          </div>
          <div className="mt-3 space-y-3">
            <label className="block text-xs text-muted-foreground">Flow</label>
            <select
              value={selectedId}
              onChange={(e) => setFlowId(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              disabled={flowsQuery.isLoading}
            >
              {flows.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
            {flows[0]?.description && (
              <p className="text-xs text-muted-foreground">{flows[0].description}</p>
            )}

            <label className="block pt-3 text-xs text-muted-foreground">Venture idea</label>
            <textarea
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              rows={6}
              placeholder="Paste or describe the venture idea to evaluate…"
              className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/60 focus:border-indigo/60 focus:outline-none"
            />

            <button
              onClick={launch}
              disabled={running || !selectedId}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-indigo px-4 py-2.5 text-sm font-medium text-ember-foreground shadow-indigo transition hover:brightness-110 disabled:opacity-60"
            >
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {running ? "Running workflow…" : "Launch Workflow"}
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-surface-1/40 p-5">
          <div className="flex items-center justify-between text-xs uppercase tracking-[0.18em] text-muted-foreground">
            <span>Run output</span>
            {result?.durationMs ? (
              <span className="inline-flex items-center gap-1 text-[10px] normal-case tracking-normal">
                <Clock className="h-3 w-3" /> {(result.durationMs / 1000).toFixed(2)}s
              </span>
            ) : null}
          </div>

          {!result && !running && (
            <div className="mt-8 flex flex-col items-center gap-2 text-center text-sm text-muted-foreground">
              <Workflow className="h-6 w-6 text-muted-foreground/60" />
              <p>Launch a workflow to see the report here.</p>
            </div>
          )}

          {running && (
            <div className="mt-8 flex flex-col items-center gap-2 text-center text-sm text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin text-indigo" />
              <p>Workflow running… this may take 30s–2m depending on flow length.</p>
            </div>
          )}

          {result && !result.ok && (
            <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
              <div className="flex items-center gap-2 font-medium text-amber-200">
                <AlertTriangle className="h-4 w-4" /> Workflow failed
              </div>
              <p className="mt-1 text-xs text-amber-100/80">{result.error}</p>
              <p className="mt-2 text-[11px] text-amber-100/60">
                If Langflow runs on localhost, expose it via a tunnel (ngrok, cloudflared) and set
                LANGFLOW_BASE_URL to the public HTTPS URL.
              </p>
            </div>
          )}

          {result?.ok && (
            <div className="mt-4 space-y-3">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-300">
                <CheckCircle2 className="h-3 w-3" /> Report ready
              </div>
              <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-background/60 p-3 text-xs leading-relaxed text-foreground/90">
                {result.report || "(empty)"}
              </pre>
            </div>
          )}
        </section>
      </div>
    </OSShell>
  );
}
