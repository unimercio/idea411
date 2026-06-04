import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  ArrowRight,
  Flame,
  Plus,
  Settings,
  ShieldCheck,
  ShieldQuestion,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import {
  deleteProject,
  overallScore,
  timeAgo,
  useProjects,
  type Iteration,
  type Project,
} from "@/lib/projects";
import { supabase } from "@/integrations/supabase/client";
import { checkAdmin } from "@/lib/api/prompt-templates.functions";
import { claimFirstSysadmin } from "@/lib/api/admin-users.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Projects — IdeaForge" },
      { name: "description", content: "All your IdeaForge concepts in one place." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { t } = useTranslation();
  const projects = useProjects();
  const navigate = useNavigate();
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (mounted) setIsAuthed(!!session);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setIsAuthed(!!data.session);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const checkAdminFn = useServerFn(checkAdmin);
  const adminQuery = useQuery({
    queryKey: ["isAdmin"],
    queryFn: () => checkAdminFn(),
    enabled: isAuthed === true,
  });
  const isAdmin = isAuthed === true && adminQuery.data?.isAdmin === true;
  const adminExists = adminQuery.data?.adminExists === true;
  const sysadminExists = adminQuery.data?.sysadminExists === true;
  const claimFn = useServerFn(claimFirstSysadmin);
  const [claiming, setClaiming] = useState(false);
  const handleClaimAdmin = async () => {
    setClaiming(true);
    try {
      const res = await claimFn();
      if (res.claimed) {
        toast.success(t("dashboard.becameAdmin"));
        adminQuery.refetch();
      } else {
        toast.error(t("dashboard.adminExists"));
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("dashboard.claimFailed"));
    } finally {
      setClaiming(false);
    }
  };

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t("dashboard.signedOut"));
    navigate({ to: "/", replace: true });
  };


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
          <div className="flex items-center gap-2">
            {isAdmin && (
              <>
                <Link
                  to="/admin/prompt-templates"
                  className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground px-3 py-2"
                  title={t("dashboard.managePrompts")}
                >
                  <Settings className="h-4 w-4" /> {t("dashboard.prompts")}
                </Link>
                <Link
                  to="/admin/skills"
                  className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground px-3 py-2"
                  title={t("dashboard.manageSkills")}
                >
                  <Sparkles className="h-4 w-4" /> {t("dashboard.skills")}
                </Link>
                <Link
                  to="/admin/users"
                  className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground px-3 py-2"
                  title={t("dashboard.manageUsers")}
                >
                  <Users className="h-4 w-4" /> {t("dashboard.users")}
                </Link>
              </>
            )}
            {isAuthed === true && !isAdmin && !adminExists && adminQuery.isFetched && (
              <button
                onClick={handleClaimAdmin}
                disabled={claiming}
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground px-3 py-2 disabled:opacity-50"
                title={t("dashboard.claimAdminTitle")}
              >
                <Sparkles className="h-4 w-4" /> {claiming ? t("dashboard.claiming") : t("dashboard.claimAdmin")}
              </button>
            )}
            {isAuthed === true && (
              <Link
                to="/settings"
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground px-3 py-2"
                title={t("dashboard.accountSettings")}
              >
                <Settings className="h-4 w-4" /> {t("dashboard.settings")}
              </Link>
            )}
            {isAuthed === true ? (
              <button
                onClick={handleSignOut}
                className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground px-3 py-2"
              >
                {t("dashboard.signOut")}
              </button>
            ) : isAuthed === false ? (
              <Link
                to="/auth"
                className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground px-3 py-2"
              >
                {t("dashboard.signIn")}
              </Link>
            ) : (
              <span className="inline-flex w-16" aria-hidden />
            )}
            <Link
              to="/intake"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-ember px-4 py-2 text-sm font-medium text-ember-foreground shadow-ember hover:brightness-110 transition"
            >
              <Plus className="h-4 w-4" /> {t("dashboard.newIdea")}
            </Link>
          </div>
        </div>
      </header>

      {isAuthed === true && adminQuery.isFetched && (
        <div className="mx-auto max-w-7xl px-6 pt-6">
          {(() => {
            const err = adminQuery.error instanceof Error ? adminQuery.error.message : null;
            if (!err && !isAdmin) return null;
            const status: "admin" | "error" = err ? "error" : "admin";
            const styles = {
              admin: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
              error: "border-destructive/40 bg-destructive/10 text-destructive",
            }[status];
            return (
              <div
                className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm ${styles}`}
                role="status"
              >
                <ShieldIcon status={status} />
                <div className="min-w-0 flex-1">
                  {status === "admin" && (
                    <p className="font-medium text-foreground">{t("dashboard.youAreAdmin")}</p>
                  )}
                  {status === "error" && (
                    <>
                      <p className="font-medium text-foreground">
                        {t("dashboard.verifyFailed")}
                      </p>
                      <p className="text-muted-foreground break-words">
                        {err ?? "Unknown error"}.{" "}
                        <button
                          onClick={() => adminQuery.refetch()}
                          className="underline underline-offset-2 hover:text-foreground"
                        >
                          {t("common.retry")}
                        </button>
                      </p>
                    </>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      )}



      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-ember">{t("dashboard.eyebrow")}</p>
            <h1 className="mt-3 font-display text-4xl sm:text-5xl font-semibold">{t("dashboard.title")}</h1>
            <p className="mt-2 text-muted-foreground">
              {projects.length === 0
                ? t("dashboard.emptyCount")
                : projects.length === 1
                  ? t("dashboard.countOne", { count: projects.length })
                  : t("dashboard.countMany", { count: projects.length })}
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

function ShieldIcon({ status }: { status: "admin" | "not-admin" | "error" }) {
  if (status === "admin") return <ShieldCheck className="h-5 w-5 mt-0.5 shrink-0" />;
  if (status === "error") return <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" />;
  return <ShieldQuestion className="h-5 w-5 mt-0.5 shrink-0" />;
}

function ProjectCard({ project, index }: { project: Project; index: number }) {
  const { t } = useTranslation();
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
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{t("dashboard.forgeScore")}</p>
          {score !== null ? (
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="font-display text-3xl font-semibold">{score}</span>
              <span className="text-xs text-muted-foreground">/100</span>
              {project.iterations && project.iterations.length > 1 && (
                <span className="ml-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                  · {t("dashboard.itersShort", { n: project.iterations.length })}
                </span>
              )}
            </div>
          ) : (
            <div className="mt-1 flex items-center gap-1.5 text-xs text-ember">
              <Sparkles className="h-3.5 w-3.5" /> {t("dashboard.vettingDots")}
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
          {t("dashboard.reopen")} <ArrowRight className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => {
            if (confirm(t("dashboard.deleteConfirm", { title: project.title }))) {
              deleteProject(project.id);
            }
          }}
          aria-label={t("dashboard.deleteAria")}
          className="ml-auto inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background/60 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground transition"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </motion.article>
  );
}

function StatusChip({ project }: { project: Project }) {
  const { t } = useTranslation();
  if (project.scores) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-emerald-400">
        {t("dashboard.ready")}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-ember/40 bg-ember/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-ember">
      {t("dashboard.vetting")}
    </span>
  );
}

function EmptyState() {
  const { t } = useTranslation();
  return (
    <div className="mt-12 grid place-items-center rounded-3xl border border-dashed border-border bg-card/40 px-6 py-24 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-2xl border border-border bg-background/80 text-ember">
        <Sparkles className="h-5 w-5" />
      </span>
      <p className="mt-5 max-w-md text-sm text-muted-foreground">
        {t("dashboard.emptyMsg")}
      </p>
      <Link
        to="/intake"
        className="mt-6 inline-flex items-center gap-2 rounded-full bg-gradient-ember px-5 py-2.5 text-sm font-medium text-ember-foreground shadow-ember hover:brightness-110 transition"
      >
        <Plus className="h-4 w-4" /> {t("dashboard.startProject")}
      </Link>
    </div>
  );
}

function IterationSparkline({ iterations }: { iterations?: Iteration[] }) {
  const { t } = useTranslation();
  if (!iterations || iterations.length === 0) return null;
  const w = 120;
  const h = 44;
  const pad = 4;
  const data = iterations.map((it) => it.overall);
  const last = data[data.length - 1];
  const prev = data.length > 1 ? data[data.length - 2] : null;
  const delta = prev !== null ? last - prev : 0;
  const min = Math.min(...data, 0);
  const max = Math.max(...data, 100);
  const range = Math.max(1, max - min);
  const pts =
    data.length === 1
      ? [
          [pad, h / 2] as const,
          [w - pad, h / 2] as const,
        ]
      : data.map(
          (v, i) =>
            [
              pad + (i * (w - pad * 2)) / (data.length - 1),
              h - pad - ((v - min) / range) * (h - pad * 2),
            ] as const,
        );
  const path = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${path} L${(w - pad).toFixed(1)},${h - pad} L${pad},${h - pad} Z`;
  const trendColor =
    delta > 0 ? "oklch(0.74 0.16 155)" : delta < 0 ? "oklch(0.68 0.19 38)" : "oklch(0.7 0 0)";
  return (
    <div className="flex flex-col items-end gap-1">
      <svg width={w} height={h} className="overflow-visible" aria-label={t("dashboard.scoreTrend")}>
        <defs>
          <linearGradient id={`spark-${iterations[0].at}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={trendColor} stopOpacity="0.35" />
            <stop offset="100%" stopColor={trendColor} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#spark-${iterations[0].at})`} />
        <path d={path} fill="none" stroke={trendColor} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
        {pts.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={i === pts.length - 1 ? 2.5 : 1.5} fill={trendColor} />
        ))}
      </svg>
      {prev !== null && (
        <span
          className="text-[10px] tabular-nums"
          style={{ color: trendColor }}
        >
          {delta > 0 ? "▲" : delta < 0 ? "▼" : "—"} {Math.abs(delta)} {t("dashboard.pts")}
        </span>
      )}
    </div>
  );
}
