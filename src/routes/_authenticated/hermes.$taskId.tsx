import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  getHermesTask,
  cancelHermesTask,
  type HermesAgent,
  type HermesStep,
  type HermesTask,
} from "@/lib/api/hermes.functions";
import { Bot, Loader2, Play, Square, User2, Wrench, Sparkles, AlertCircle, CheckCircle2, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

export const Route = createFileRoute("/_authenticated/hermes/$taskId")({
  component: HermesTaskPage,
});

type EngineEvent =
  | { type: "task_status"; status: string }
  | { type: "agent_created"; agent: { id: string; role: string; name: string; model: string; objective: string | null } }
  | { type: "agent_status"; agentId: string; status: string; iteration_count?: number }
  | { type: "step"; step: { id: string; agent_id: string; step_type: string; content: any; created_at: string } }
  | { type: "task_completed"; summary: string; final_output: any }
  | { type: "task_failed"; error: string }
  | { type: "done" };

function HermesTaskPage() {
  const { taskId } = Route.useParams();
  const getFn = useServerFn(getHermesTask);
  const cancelFn = useServerFn(cancelHermesTask);

  const initialQ = useQuery({
    queryKey: ["hermesTask", taskId],
    queryFn: () => getFn({ data: { id: taskId } }),
  });

  const [task, setTask] = useState<HermesTask | null>(null);
  const [agents, setAgents] = useState<HermesAgent[]>([]);
  const [steps, setSteps] = useState<HermesStep[]>([]);
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (initialQ.data) {
      setTask(initialQ.data.task);
      setAgents(initialQ.data.agents);
      setSteps(initialQ.data.steps);
    }
  }, [initialQ.data]);

  const startRun = useCallback(async () => {
    if (!task) return;
    if (task.status === "completed" || task.status === "failed" || task.status === "cancelled") {
      toast.info("Task already finished. Reset by creating a new one.");
      return;
    }
    setStreaming(true);
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    if (!token) {
      setStreaming(false);
      toast.error("Not authenticated");
      return;
    }
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const res = await fetch("/api/hermes-run", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ taskId: task.id }),
        signal: ac.signal,
      });
      if (!res.ok || !res.body) {
        const t = await res.text().catch(() => "");
        throw new Error(`Run failed (${res.status}): ${t}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";
        for (const chunk of parts) {
          const line = chunk.trim();
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload) continue;
          try {
            const evt = JSON.parse(payload) as EngineEvent;
            applyEvent(evt);
          } catch {
            // skip
          }
        }
      }
    } catch (err) {
      if ((err as any)?.name !== "AbortError") {
        toast.error(err instanceof Error ? err.message : "Stream error");
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
      initialQ.refetch();
    }
  }, [task, initialQ]);

  const applyEvent = (evt: EngineEvent) => {
    if (evt.type === "task_status") setTask((t) => (t ? { ...t, status: evt.status as any } : t));
    else if (evt.type === "agent_created")
      setAgents((a) => [
        ...a,
        {
          id: evt.agent.id,
          task_id: taskId,
          role: evt.agent.role as any,
          name: evt.agent.name,
          model: evt.agent.model,
          system_prompt: "",
          objective: evt.agent.objective,
          status: "running",
          iteration_count: 0,
          output: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]);
    else if (evt.type === "agent_status")
      setAgents((a) =>
        a.map((x) =>
          x.id === evt.agentId
            ? { ...x, status: evt.status as any, iteration_count: evt.iteration_count ?? x.iteration_count }
            : x,
        ),
      );
    else if (evt.type === "step")
      setSteps((s) => [
        ...s,
        {
          id: evt.step.id,
          agent_id: evt.step.agent_id,
          task_id: taskId,
          step_type: evt.step.step_type as any,
          content: evt.step.content ?? {},
          tokens_used: 0,
          created_at: evt.step.created_at,
        },
      ]);
    else if (evt.type === "task_completed")
      setTask((t) => (t ? { ...t, status: "completed", result_summary: evt.summary, final_output: evt.final_output } : t));
    else if (evt.type === "task_failed")
      setTask((t) => (t ? { ...t, status: "failed", error: evt.error } : t));
  };

  const cancel = async () => {
    if (!task) return;
    try {
      await cancelFn({ data: { id: task.id } });
      abortRef.current?.abort();
      toast.success("Cancelled");
      initialQ.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  if (initialQ.isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-6 py-16 grid place-items-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }
  if (!task) return <p className="mx-auto max-w-7xl px-6 py-16 text-destructive">Task not found.</p>;

  const finalReport = (task.final_output as any)?.report as string | undefined;

  return (
    <section className="mx-auto max-w-7xl px-6 py-10">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-[0.2em] text-ember">Hermes task</p>
          <h1 className="mt-2 font-display text-2xl sm:text-3xl font-semibold">{task.goal}</h1>
          <p className="mt-2 text-xs text-muted-foreground">
            Model: <span className="font-mono">{task.model}</span> · Status:{" "}
            <span className="uppercase tracking-wider">{task.status}</span>
          </p>
          {task.error && (
            <p className="mt-2 inline-flex items-center gap-1 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" /> {task.error}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {(task.status === "queued" || task.status === "planning" || task.status === "running") && (
            <>
              {!streaming ? (
                <button
                  onClick={startRun}
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-ember px-4 py-2 text-sm font-medium text-ember-foreground shadow-ember hover:brightness-110 transition"
                >
                  <Play className="h-3.5 w-3.5" /> {task.status === "queued" ? "Start" : "Resume stream"}
                </button>
              ) : (
                <button
                  onClick={cancel}
                  className="inline-flex items-center gap-2 rounded-full border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/20 transition"
                >
                  <Square className="h-3.5 w-3.5" /> Cancel
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {agents.map((a) => (
          <AgentColumn
            key={a.id}
            agent={a}
            steps={steps.filter((s) => s.agent_id === a.id)}
          />
        ))}
        {agents.length === 0 && (
          <div className="md:col-span-2 xl:col-span-3 rounded-3xl border border-dashed border-border bg-card/40 p-12 text-center text-muted-foreground">
            <Bot className="mx-auto h-6 w-6 text-ember" />
            <p className="mt-3 text-sm">No agents yet. Hit Start to spawn the team.</p>
          </div>
        )}
      </div>

      {finalReport && (
        <div className="mt-10 rounded-3xl border border-emerald-500/30 bg-emerald-500/5 p-6">
          <div className="flex items-center gap-2 text-emerald-400">
            <CheckCircle2 className="h-4 w-4" />
            <p className="text-xs uppercase tracking-wider">Final report</p>
          </div>
          <div className="prose prose-invert prose-sm mt-4 max-w-none">
            <ReactMarkdown>{finalReport}</ReactMarkdown>
          </div>
        </div>
      )}
    </section>
  );
}

function AgentColumn({ agent, steps }: { agent: HermesAgent; steps: HermesStep[] }) {
  const Icon = agent.role === "planner" ? Sparkles : agent.role === "critic" ? User2 : Bot;
  const statusStyle =
    agent.status === "completed"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
      : agent.status === "failed"
      ? "border-destructive/40 bg-destructive/10 text-destructive"
      : agent.status === "cancelled"
      ? "border-border bg-muted/40 text-muted-foreground"
      : "border-ember/40 bg-ember/10 text-ember animate-pulse";
  return (
    <article className="rounded-3xl border border-border bg-card/80 p-5 shadow-elegant">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-background/60 text-ember border border-border">
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{agent.role}</p>
            <p className="text-sm font-medium truncate">{agent.name}</p>
          </div>
        </div>
        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${statusStyle}`}>
          {agent.status}
        </span>
      </div>
      {agent.objective && (
        <p className="mt-3 text-xs text-muted-foreground line-clamp-3">{agent.objective}</p>
      )}
      <div className="mt-4 space-y-2 max-h-[420px] overflow-y-auto pr-1">
        {steps.length === 0 && <p className="text-xs text-muted-foreground italic">Waiting…</p>}
        {steps.map((s) => (
          <StepCard key={s.id} step={s} />
        ))}
      </div>
    </article>
  );
}

function StepCard({ step }: { step: HermesStep }) {
  const c = step.content ?? {};
  const stylesByType: Record<string, string> = {
    thought: "border-border bg-background/40",
    tool_call: "border-blue-500/30 bg-blue-500/10",
    tool_result: "border-blue-500/20 bg-blue-500/5",
    final: "border-emerald-500/30 bg-emerald-500/10",
    error: "border-destructive/40 bg-destructive/10",
  };
  const Icon = step.step_type === "tool_call" || step.step_type === "tool_result" ? Wrench : Sparkles;
  return (
    <div className={`rounded-xl border p-2.5 text-xs ${stylesByType[step.step_type] ?? "border-border"}`}>
      <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
        <Icon className="h-3 w-3" /> {step.step_type}
      </p>
      <div className="text-foreground/90 break-words whitespace-pre-wrap">
        {step.step_type === "tool_call" && `${c.tool}(${c.query ?? ""})`}
        {step.step_type === "tool_result" && String(c.result ?? "").slice(0, 600)}
        {step.step_type === "thought" && String(c.text ?? "").slice(0, 800)}
        {step.step_type === "final" && (c.answer ?? c.report ?? JSON.stringify(c.subtasks ?? c, null, 0)).toString().slice(0, 1200)}
        {step.step_type === "error" && (c.reason ?? "Error")}
      </div>
    </div>
  );
}
