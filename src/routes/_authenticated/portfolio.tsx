import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { OSShell } from "@/components/os/OSShell";
import { Briefcase, MessageSquare, Plus, X, Trash2, AlertOctagon, Lightbulb, ArrowRight, CircleDot } from "lucide-react";
import {
  countVentureFeedback,
  createVentureFeedback,
  deleteVentureFeedback,
  listMyProjects,
  listVentureFeedback,
  ventureFeedbackTypes,
  type VentureFeedbackType,
} from "@/lib/api/venture-feedback.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/portfolio")({
  head: () => ({ meta: [{ title: "Portfolio — Seven Day Ventures" }] }),
  component: PortfolioPage,
});

const TYPE_META: Record<VentureFeedbackType, { label: string; icon: typeof MessageSquare; classes: string }> = {
  general: { label: "General", icon: MessageSquare, classes: "text-muted-foreground bg-surface-2" },
  risk: { label: "Risk", icon: AlertOctagon, classes: "text-rose-300 bg-rose-500/10" },
  opportunity: { label: "Opportunity", icon: Lightbulb, classes: "text-emerald-300 bg-emerald-500/10" },
  next_step: { label: "Next step", icon: ArrowRight, classes: "text-indigo bg-indigo/10" },
};

function PortfolioPage() {
  const listFn = useServerFn(listMyProjects);
  const countFn = useServerFn(countVentureFeedback);
  const projectsQuery = useQuery({ queryKey: ["projects"], queryFn: () => listFn() });
  const projects = projectsQuery.data ?? [];

  const countsQuery = useQuery({
    queryKey: ["venture-feedback", "counts", projects.map((p) => p.id)],
    queryFn: () => countFn({ data: { projectIds: projects.map((p) => p.id) } }),
    enabled: projects.length > 0,
  });

  const [active, setActive] = useState<string | null>(null);

  return (
    <OSShell
      eyebrow="Portfolio"
      title="Active Ventures"
      description="Every venture in the incubator with status, score, and threaded feedback."
      actions={
        <Link
          to="/intake"
          className="inline-flex items-center gap-1.5 rounded-md bg-gradient-indigo px-3 py-1.5 text-xs font-medium text-ember-foreground shadow-indigo hover:brightness-110 transition"
        >
          <Plus className="h-3.5 w-3.5" /> New venture
        </Link>
      }
    >
      {projectsQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading ventures…</p>
      ) : projects.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <Briefcase className="mx-auto h-6 w-6 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            No ventures yet. Capture your first idea to start the pipeline.
          </p>
          <Link
            to="/intake"
            className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-gradient-indigo px-3 py-1.5 text-xs font-medium text-ember-foreground shadow-indigo hover:brightness-110 transition"
          >
            <Plus className="h-3.5 w-3.5" /> New venture
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((p) => {
            const score = (p.data as { overallScore?: number } | null)?.overallScore;
            const count = countsQuery.data?.[p.id] ?? 0;
            return (
              <button
                key={p.id}
                onClick={() => setActive(p.id)}
                className="group flex flex-col rounded-2xl border border-border bg-surface-1/40 p-4 text-left transition hover:border-indigo/50 hover:bg-surface-1/70"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="line-clamp-2 font-display text-base font-semibold">{p.title}</p>
                  <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                    {p.status}
                  </span>
                </div>
                <p className="mt-2 line-clamp-3 text-xs text-muted-foreground">{p.idea}</p>
                <div className="mt-4 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <CircleDot className="h-3 w-3 text-indigo" />
                    Score {score != null ? `${score}/100` : "—"}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" /> {count}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {active && (
        <FeedbackDrawer
          projectId={active}
          title={projects.find((p) => p.id === active)?.title ?? "Venture"}
          onClose={() => setActive(null)}
        />
      )}
    </OSShell>
  );
}

function FeedbackDrawer({
  projectId,
  title,
  onClose,
}: {
  projectId: string;
  title: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const listFn = useServerFn(listVentureFeedback);
  const createFn = useServerFn(createVentureFeedback);
  const deleteFn = useServerFn(deleteVentureFeedback);

  const q = useQuery({
    queryKey: ["venture-feedback", projectId],
    queryFn: () => listFn({ data: { projectId } }),
  });

  const [body, setBody] = useState("");
  const [type, setType] = useState<VentureFeedbackType>("general");

  const createMut = useMutation({
    mutationFn: () => createFn({ data: { projectId, body: body.trim(), type } }),
    onSuccess: () => {
      setBody("");
      qc.invalidateQueries({ queryKey: ["venture-feedback", projectId] });
      qc.invalidateQueries({ queryKey: ["venture-feedback", "counts"] });
      toast.success("Feedback added");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to add feedback"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["venture-feedback", projectId] });
      qc.invalidateQueries({ queryKey: ["venture-feedback", "counts"] });
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-background/70 backdrop-blur-sm" onClick={onClose} />
      <aside className="flex h-full w-full max-w-md flex-col border-l border-border bg-surface-1">
        <header className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Feedback</p>
            <p className="line-clamp-1 font-display text-sm font-semibold">{title}</p>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-surface-2 hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {q.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {q.data?.length === 0 && (
            <p className="text-sm text-muted-foreground">Be the first to leave feedback.</p>
          )}
          {q.data?.map((f) => {
            const meta = TYPE_META[f.type];
            const Icon = meta.icon;
            return (
              <div key={f.id} className="rounded-xl border border-border bg-background/40 p-3">
                <div className="flex items-center justify-between">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] ${meta.classes}`}>
                    <Icon className="h-3 w-3" /> {meta.label}
                  </span>
                  <button
                    onClick={() => deleteMut.mutate(f.id)}
                    className="text-muted-foreground hover:text-rose-300"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-foreground/90">{f.body}</p>
                <p className="mt-2 text-[10px] text-muted-foreground">
                  {f.author_email || "Member"} · {new Date(f.created_at).toLocaleString()}
                </p>
              </div>
            );
          })}
        </div>

        <div className="border-t border-border p-4 space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {ventureFeedbackTypes.map((t) => {
              const meta = TYPE_META[t];
              return (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] transition ${
                    type === t ? meta.classes : "bg-surface-2 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {meta.label}
                </button>
              );
            })}
          </div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            placeholder="Share insight, risk, opportunity, or next step…"
            className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/60 focus:border-indigo/60 focus:outline-none"
          />
          <button
            onClick={() => body.trim() && createMut.mutate()}
            disabled={createMut.isPending || !body.trim()}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-gradient-indigo px-3 py-2 text-sm font-medium text-ember-foreground shadow-indigo transition hover:brightness-110 disabled:opacity-60"
          >
            <Plus className="h-3.5 w-3.5" /> Post feedback
          </button>
        </div>
      </aside>
    </div>
  );
}
