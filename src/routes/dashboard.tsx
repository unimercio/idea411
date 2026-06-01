import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowRight,
  Flame,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  deleteProject,
  overallScore,
  timeAgo,
  useProjects,
  type Iteration,
  type Project,
} from "@/lib/projects";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Projects — IdeaForge" },
      { name: "description", content: "All your IdeaForge concepts in one place." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const projects = useProjects();

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto max-w-7xl px-6 py-5 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-display font-semibold">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-gradient-ember text-ember-foreground shadow-ember">
              <Flame className="h-4 w-4" />
            </span>
            IdeaForge
          </Link>
          <Link
            to="/intake"
            className="inline-flex items-center gap-2 rounded-full bg-gradient-ember px-4 py-2 text-sm font-medium text-ember-foreground shadow-ember hover:brightness-110 transition"
          >
            <Plus className="h-4 w-4" /> New idea
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-ember">Your forge</p>
            <h1 className="mt-3 font-display text-4xl sm:text-5xl font-semibold">Projects</h1>
            <p className="mt-2 text-muted-foreground">
              {projects.length === 0
                ? "No projects yet — drop your first idea to get started."
                : `${projects.length} ${projects.length === 1 ? "project" : "projects"} in motion.`}
            </p>
          </div>
        </div>

        {projects.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            <AnimatePresence initial={false}>
              {projects.map((p, i) => (
                <ProjectCard key={p.id} project={p} index={i} />
              ))}
            </AnimatePresence>
          </div>
        )}
      </section>
    </main>
  );
}

function ProjectCard({ project, index }: { project: Project; index: number }) {
  const navigate = useNavigate();
  const score = overallScore(project.scores);

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.45, delay: 0.04 * index, ease: [0.22, 1, 0.36, 1] }}
      className="group relative rounded-3xl border border-border bg-card/80 p-6 shadow-elegant hover:border-ember/40 transition"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            {timeAgo(project.updatedAt)}
          </p>
          <h3 className="mt-2 font-display text-lg font-semibold leading-tight truncate">
            {project.title}
          </h3>
        </div>
        <StatusChip project={project} />
      </div>

      <p className="mt-4 text-sm text-muted-foreground line-clamp-3 min-h-[60px]">
        {project.idea}
      </p>

      <div className="mt-6 flex items-end justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Forge score</p>
          {score !== null ? (
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="font-display text-3xl font-semibold">{score}</span>
              <span className="text-xs text-muted-foreground">/100</span>
              {project.iterations && project.iterations.length > 1 && (
                <span className="ml-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                  · {project.iterations.length} iters
                </span>
              )}
            </div>
          ) : (
            <div className="mt-1 flex items-center gap-1.5 text-xs text-ember">
              <Sparkles className="h-3.5 w-3.5" /> Vetting…
            </div>
          )}
        </div>
        <IterationSparkline iterations={project.iterations} />
      </div>

      <div className="mt-6 flex items-center gap-2">
        <button
          onClick={() => navigate({ to: "/vetting", search: { id: project.id } })}
          className="inline-flex items-center gap-1.5 rounded-full bg-gradient-ember px-4 py-2 text-sm font-medium text-ember-foreground shadow-ember hover:brightness-110 transition"
        >
          Reopen <ArrowRight className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => {
            if (confirm(`Delete "${project.title}"? This can't be undone.`)) {
              deleteProject(project.id);
            }
          }}
          aria-label="Delete project"
          className="ml-auto inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background/60 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground transition"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </motion.article>
  );
}

function StatusChip({ project }: { project: Project }) {
  if (project.scores) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-emerald-400">
        Ready
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-ember/40 bg-ember/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-ember">
      Vetting
    </span>
  );
}

function EmptyState() {
  return (
    <div className="mt-12 grid place-items-center rounded-3xl border border-dashed border-border bg-card/40 px-6 py-24 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-2xl border border-border bg-background/80 text-ember">
        <Sparkles className="h-5 w-5" />
      </span>
      <p className="mt-5 max-w-md text-sm text-muted-foreground">
        Drop your first concept to see vetting, IP protection, and a launch plan appear here.
      </p>
      <Link
        to="/intake"
        className="mt-6 inline-flex items-center gap-2 rounded-full bg-gradient-ember px-5 py-2.5 text-sm font-medium text-ember-foreground shadow-ember hover:brightness-110 transition"
      >
        <Plus className="h-4 w-4" /> Start a project
      </Link>
    </div>
  );
}
