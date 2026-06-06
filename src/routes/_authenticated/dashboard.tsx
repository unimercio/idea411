import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { HeaderBrand } from "@/components/site/HeaderBrand";
import { Input } from "@/components/ui/input";
import {
  AlertTriangle,
  ArrowRight,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  ShieldQuestion,
  Sparkles,
  Trash2,
  Users,
  Trophy,
  Clock,
  GitCompare,
  X,
} from "lucide-react";
import {
  deleteProject,
  overallScore,
  refreshProjects,
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

  // Hydrate a guest-saved idea once the user is authenticated.
  useEffect(() => {
    if (isAuthed !== true) return;
    let cancelled = false;
    (async () => {
      let raw: string | null = null;
      try {
        raw =
          localStorage.getItem("ideaforge:pending-project") ??
          sessionStorage.getItem("ideaforge:pending-project");
      } catch {
        return;
      }
      if (!raw) return;
      let pending: {
        idea?: string;
        sketchName?: string;
        analysis?: import("@/lib/projects").Project["analysis"];
      };
      try {
        pending = JSON.parse(raw);
      } catch {
        localStorage.removeItem("ideaforge:pending-project");
        return;
      }
      if (!pending.idea) {
        localStorage.removeItem("ideaforge:pending-project");
        return;
      }
      const { data: userData } = await supabase.auth.getUser();
      if (cancelled || !userData.user) return;
      const userId = userData.user.id;
      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const title =
        pending.idea.trim().split(/\s+/).slice(0, 7).join(" ").slice(0, 80) || "Saved idea";
      const a = pending.analysis;
      const scores = a
        ? {
            compliance: Math.round(a.compliance.score * 10),
            market: Math.round(a.market.score * 10),
            demand: Math.round(a.sales.score * 10),
          }
        : undefined;
      const data: Record<string, unknown> = {
        sketchName: pending.sketchName,
        analysis: a,
        scores,
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await supabase.from("projects").insert({
        id,
        user_id: userId,
        title,
        idea: pending.idea,
        status: a ? "ready" : "vetting",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: data as any,
      } as any);
      try {
        localStorage.removeItem("ideaforge:pending-project");
        sessionStorage.removeItem("ideaforge:pending-project");
      } catch {
        /* ignore */
      }
      if (error) {
        console.error("[dashboard] failed to save pending idea", error);
        toast.error("Couldn't save your idea", {
          description: error.message,
        });
        return;
      }
      toast.success("Your idea was saved to your account");
      await refreshProjects();


    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthed]);

  const checkAdminFn = useServerFn(checkAdmin);
  const adminQuery = useQuery({
    queryKey: ["isAdmin"],
    queryFn: () => checkAdminFn(),
    enabled: isAuthed === true,
  });
  const isAdmin = isAuthed === true && adminQuery.data?.isAdmin === true;
  const isSysadmin = isAuthed === true && adminQuery.data?.isSysadmin === true;
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
          <HeaderBrand to={isSysadmin ? "/sysadmin" : isAdmin ? "/admin" : "/dashboard"} />
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
            {isAuthed === true && !sysadminExists && !adminExists && adminQuery.isFetched && (
              <button
                onClick={handleClaimAdmin}
                disabled={claiming}
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground px-3 py-2 disabled:opacity-50"
                title={t("dashboard.claimAdminTitle")}
              >
                <Sparkles className="h-4 w-4" /> {claiming ? t("dashboard.claiming") : (adminExists ? "Claim sysadmin" : t("dashboard.claimAdmin"))}
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
                    <p className="font-medium text-foreground">
                      {isSysadmin ? "You are a Sysadmin" : t("dashboard.youAreAdmin")}
                    </p>
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



      <DashboardBody projects={projects} />
    </main>
  );
}

function DashboardBody({ projects }: { projects: Project[] }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "ready" | "vetting">("all");
  const [sort, setSort] = useState<"recent" | "score" | "title">("recent");
  const [compareMode, setCompareMode] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);

  const stats = useMemo(() => {
    const ready = projects.filter((p) => !!p.scores).length;
    const vetting = projects.length - ready;
    const scores = projects
      .map((p) => overallScore(p.scores))
      .filter((s): s is number => s !== null);
    const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const thisMonth = projects.filter((p) => p.createdAt >= monthStart).length;
    return { total: projects.length, ready, vetting, avg, thisMonth };
  }, [projects]);

  const spotlight = useMemo(() => {
    let best: { project: Project; score: number } | null = null;
    for (const p of projects) {
      const s = overallScore(p.scores);
      if (s !== null && (!best || s > best.score)) best = { project: p, score: s };
    }
    return best;
  }, [projects]);

  const continueProject = useMemo(() => {
    const sorted = [...projects].sort((a, b) => b.updatedAt - a.updatedAt);
    return sorted.find((p) => p.id !== spotlight?.project.id) ?? sorted[0] ?? null;
  }, [projects, spotlight]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = projects.filter((p) => {
      if (status === "ready" && !p.scores) return false;
      if (status === "vetting" && p.scores) return false;
      if (q && !`${p.title} ${p.idea}`.toLowerCase().includes(q)) return false;
      return true;
    });
    list = [...list];
    if (sort === "title") list.sort((a, b) => a.title.localeCompare(b.title));
    else if (sort === "score")
      list.sort((a, b) => (overallScore(b.scores) ?? -1) - (overallScore(a.scores) ?? -1));
    else list.sort((a, b) => b.updatedAt - a.updatedAt);
    return list;
  }, [projects, query, status, sort]);

  const toggleSelected = (id: string) => {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 3) return prev;
      return [...prev, id];
    });
  };

  const compareProjects = projects.filter((p) => selected.includes(p.id));

  return (
    <section className="mx-auto max-w-7xl px-6 py-12 space-y-10">
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
        <>
          <StatsStrip stats={stats} />

          <div className="grid gap-4 md:grid-cols-2">
            {continueProject && (
              <HighlightCard
                icon={Clock}
                eyebrow="Continue where you left off"
                project={continueProject}
                onOpen={() => navigate({ to: "/vetting", search: { id: continueProject.id } })}
              />
            )}
            {spotlight && spotlight.project.id !== continueProject?.id && (
              <HighlightCard
                icon={Trophy}
                eyebrow={`Top idea · ${spotlight.score}/100`}
                project={spotlight.project}
                onOpen={() => navigate({ to: "/vetting", search: { id: spotlight.project.id } })}
                accent
              />
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px] max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search ideas…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <FilterChip label="All" active={status === "all"} onClick={() => setStatus("all")} />
            <FilterChip label="Ready" active={status === "ready"} onClick={() => setStatus("ready")} />
            <FilterChip label="Vetting" active={status === "vetting"} onClick={() => setStatus("vetting")} />
            <div className="h-5 w-px bg-border mx-1" />
            <FilterChip label="Recent" active={sort === "recent"} onClick={() => setSort("recent")} />
            <FilterChip label="Score" active={sort === "score"} onClick={() => setSort("score")} />
            <FilterChip label="Title" active={sort === "title"} onClick={() => setSort("title")} />
            <button
              onClick={() => {
                setCompareMode((v) => !v);
                setSelected([]);
              }}
              className={`ml-auto inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition ${
                compareMode
                  ? "border-ember/50 bg-ember/10 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              <GitCompare className="h-3.5 w-3.5" /> {compareMode ? "Exit compare" : "Compare"}
            </button>
          </div>

          {compareMode && compareProjects.length >= 2 && (
            <CompareTable projects={compareProjects} onRemove={toggleSelected} />
          )}
          {compareMode && (
            <p className="text-xs text-muted-foreground">
              Select 2–3 projects to compare side-by-side ({selected.length}/3 selected).
            </p>
          )}

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            <AnimatePresence initial={false}>
              {filtered.map((p, i) => (
                <ProjectCard
                  key={p.id}
                  project={p}
                  index={i}
                  selectable={compareMode}
                  selected={selected.includes(p.id)}
                  onToggle={() => toggleSelected(p.id)}
                />
              ))}
            </AnimatePresence>
          </div>
          {filtered.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-10">
              No ideas match your filters.
            </p>
          )}
        </>
      )}
    </section>
  );
}

function ShieldIcon({ status }: { status: "admin" | "not-admin" | "error" }) {
  if (status === "admin") return <ShieldCheck className="h-5 w-5 mt-0.5 shrink-0" />;
  if (status === "error") return <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" />;
  return <ShieldQuestion className="h-5 w-5 mt-0.5 shrink-0" />;
}

function ProjectCard({
  project,
  index,
  selectable,
  selected,
  onToggle,
}: {
  project: Project;
  index: number;
  selectable?: boolean;
  selected?: boolean;
  onToggle?: () => void;
}) {
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
      onClick={selectable ? onToggle : undefined}
      className={`group relative rounded-3xl border bg-card/80 p-6 shadow-elegant transition ${
        selectable ? "cursor-pointer" : ""
      } ${
        selected
          ? "border-ember ring-2 ring-ember/40"
          : "border-border hover:border-ember/40"
      }`}
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

function StatsStrip({
  stats,
}: {
  stats: { total: number; ready: number; vetting: number; avg: number | null; thisMonth: number };
}) {
  const items: { label: string; value: number | string; suffix?: string }[] = [
    { label: "Total ideas", value: stats.total },
    { label: "Avg ForgeScore", value: stats.avg ?? "—", suffix: stats.avg !== null ? "/100" : "" },
    { label: "Ready", value: stats.ready },
    { label: "Vetting", value: stats.vetting },
    { label: "This month", value: stats.thisMonth },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {items.map((it) => (
        <div key={it.label} className="rounded-2xl border border-border bg-card/60 px-4 py-3 shadow-elegant">
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{it.label}</p>
          <p className="mt-1 font-display text-2xl font-semibold">
            {it.value}
            {it.suffix ? <span className="text-xs text-muted-foreground ml-1">{it.suffix}</span> : null}
          </p>
        </div>
      ))}
    </div>
  );
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs transition ${
        active
          ? "border-ember/50 bg-ember/10 text-foreground"
          : "border-border bg-background/60 text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

function HighlightCard({
  icon: Icon,
  eyebrow,
  project,
  onOpen,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  eyebrow: string;
  project: Project;
  onOpen: () => void;
  accent?: boolean;
}) {
  const score = overallScore(project.scores);
  return (
    <div
      className={`rounded-3xl border p-6 shadow-elegant transition ${
        accent
          ? "border-ember/40 bg-gradient-to-br from-ember/10 via-card/80 to-card/80"
          : "border-border bg-card/80"
      }`}
    >
      <p className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] text-ember">
        <Icon className="h-3.5 w-3.5" /> {eyebrow}
      </p>
      <h3 className="mt-3 font-display text-xl font-semibold truncate">{project.title}</h3>
      <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{project.idea}</p>
      <div className="mt-4 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{timeAgo(project.updatedAt)}</span>
        {score !== null && (
          <span className="font-display text-2xl font-semibold">
            {score}
            <span className="ml-1 text-xs text-muted-foreground">/100</span>
          </span>
        )}
      </div>
      <button
        onClick={onOpen}
        className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-gradient-ember px-4 py-2 text-sm font-medium text-ember-foreground shadow-ember hover:brightness-110 transition"
      >
        Reopen <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function CompareTable({ projects, onRemove }: { projects: Project[]; onRemove: (id: string) => void }) {
  const rows: { label: string; get: (p: Project) => number | string | null }[] = [
    { label: "Overall", get: (p) => overallScore(p.scores) },
    { label: "Compliance", get: (p) => p.scores?.compliance ?? null },
    { label: "Market", get: (p) => p.scores?.market ?? null },
    { label: "Demand", get: (p) => p.scores?.demand ?? null },
    { label: "Iterations", get: (p) => p.iterations?.length ?? 0 },
    { label: "Status", get: (p) => (p.scores ? "Ready" : "Vetting") },
  ];
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card/60">
      <table className="w-full text-sm">
        <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-4 py-3 text-left font-medium">Metric</th>
            {projects.map((p) => (
              <th key={p.id} className="px-4 py-3 text-left font-medium">
                <div className="flex items-center gap-2">
                  <span className="truncate max-w-[180px]">{p.title}</span>
                  <button
                    onClick={() => onRemove(p.id)}
                    className="ml-auto text-muted-foreground hover:text-foreground"
                    aria-label="Remove from compare"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-t border-border">
              <td className="px-4 py-2.5 text-muted-foreground">{r.label}</td>
              {projects.map((p) => (
                <td key={p.id} className="px-4 py-2.5 font-medium">
                  {r.get(p) ?? "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
