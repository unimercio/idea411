import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listHermesTasks, deleteHermesTask, type HermesTask } from "@/lib/api/hermes.functions";
import { ArrowRight, Bot, Loader2, ScrollText, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/hermes/")({
  component: HermesTasksPage,
});

function HermesTasksPage() {
  const listFn = useServerFn(listHermesTasks);
  const delFn = useServerFn(deleteHermesTask);
  const q = useQuery({ queryKey: ["hermesTasks"], queryFn: () => listFn() });

  return (
    <section className="mx-auto max-w-7xl px-6 py-10">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-ember">Hermes</p>
          <h1 className="mt-2 font-display text-3xl sm:text-4xl font-semibold">Goal-driven tasks</h1>
          <p className="mt-2 text-muted-foreground">
            Submit a goal, Hermes spawns planner/worker/critic agents using your chosen OpenRouter model.
          </p>
        </div>
        <Link
          to="/hermes/agents"
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-4 py-2 text-sm text-foreground hover:border-ember/40 hover:text-ember transition"
        >
          <ScrollText className="h-3.5 w-3.5" /> Log
        </Link>
      </div>

      {q.isLoading && (
        <div className="mt-12 grid place-items-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}
      {q.error && <p className="mt-8 text-destructive">{(q.error as Error).message}</p>}

      {q.data && q.data.length === 0 && (
        <div className="mt-12 grid place-items-center rounded-3xl border border-dashed border-border bg-card/40 px-6 py-24 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-2xl border border-border bg-background/80 text-ember">
            <Bot className="h-5 w-5" />
          </span>
          <p className="mt-5 max-w-md text-sm text-muted-foreground">
            No tasks yet. Give Hermes a goal and it will assemble an agent team.
          </p>
          <Link
            to="/hermes/new"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-gradient-ember px-5 py-2.5 text-sm font-medium text-ember-foreground shadow-ember hover:brightness-110 transition"
          >
            Start your first task
          </Link>
        </div>
      )}

      {q.data && q.data.length > 0 && (
        <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {q.data.map((t) => (
            <TaskCard
              key={t.id}
              task={t}
              onDelete={async () => {
                if (!confirm("Delete this Hermes task?")) return;
                try {
                  await delFn({ data: { id: t.id } });
                  toast.success("Task deleted");
                  q.refetch();
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Failed to delete");
                }
              }}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function statusColor(s: HermesTask["status"]) {
  switch (s) {
    case "completed":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
    case "running":
    case "planning":
      return "border-ember/40 bg-ember/10 text-ember animate-pulse";
    case "failed":
      return "border-destructive/40 bg-destructive/10 text-destructive";
    case "cancelled":
      return "border-border bg-muted/40 text-muted-foreground";
    default:
      return "border-border bg-card/60 text-muted-foreground";
  }
}

function TaskCard({ task, onDelete }: { task: HermesTask; onDelete: () => void }) {
  return (
    <article className="group relative rounded-3xl border border-border bg-card/80 p-6 shadow-elegant hover:border-ember/40 transition">
      <div className="flex items-start justify-between gap-3">
        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${statusColor(task.status)}`}>
          {task.status}
        </span>
        <button
          onClick={onDelete}
          aria-label="Delete task"
          className="opacity-0 group-hover:opacity-100 transition text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <p className="mt-3 line-clamp-3 text-sm font-medium">{task.goal}</p>
      {task.result_summary && (
        <p className="mt-3 text-xs text-muted-foreground line-clamp-3">{task.result_summary}</p>
      )}
      <p className="mt-4 text-[10px] uppercase tracking-wider text-muted-foreground truncate">
        Model: {task.model}
      </p>
      <Link
        to="/hermes/$taskId"
        params={{ taskId: task.id }}
        className="mt-4 inline-flex items-center gap-1.5 text-sm text-ember hover:brightness-110"
      >
        Open <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </article>
  );
}
