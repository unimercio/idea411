import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  ArrowUpRight,
  Briefcase,
  CheckCircle2,
  Clock,
  Gauge,
  Plus,
  Sparkles,
  TrendingUp,
  Workflow,
  Activity,
  MessageSquare,
  Zap,
} from "lucide-react";
import { OSShell } from "@/components/os/OSShell";
import {
  overallScore,
  refreshProjects,
  timeAgo,
  useProjects,
  type Project,
} from "@/lib/projects";
import { supabase } from "@/integrations/supabase/client";
import { claimFirstSysadmin } from "@/lib/api/admin-users.functions";
import { checkAdmin } from "@/lib/api/prompt-templates.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Incubator OS — Seven Day Ventures" },
      {
        name: "description",
        content:
          "Command center for the Seven Day Ventures incubator: ventures, ideas, workflows, and team chat.",
      },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
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

  // Hydrate a guest-saved idea once authenticated (preserved from previous flow).
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
        analysis?: Project["analysis"];
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
        toast.error("Couldn't save your idea", { description: error.message });
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
  const sysadminExists = adminQuery.data?.sysadminExists === true;
  const adminExists = adminQuery.data?.adminExists === true;
  const claimFn = useServerFn(claimFirstSysadmin);
  const [claiming, setClaiming] = useState(false);
  const handleClaimAdmin = async () => {
    setClaiming(true);
    try {
      const res = await claimFn();
      if (res.claimed) {
        toast.success("You're now sysadmin");
        adminQuery.refetch();
      } else {
        toast.error("A sysadmin already exists");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Claim failed");
    } finally {
      setClaiming(false);
    }
  };

  const metrics = useMemo(() => buildMetrics(projects), [projects]);
  const recent = useMemo(
    () => [...projects].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 6),
    [projects],
  );

  return (
    <OSShell
      eyebrow="Incubator OS"
      title="Welcome back, operator."
      description="Seven Day Ventures command center — every active venture, idea, and workflow in one calm surface."
      actions={
        isAuthed === true && !sysadminExists && !adminExists && adminQuery.isFetched ? (
          <button
            onClick={handleClaimAdmin}
            disabled={claiming}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-2 px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition disabled:opacity-50"
          >
            <Sparkles className="h-3.5 w-3.5" /> {claiming ? "Claiming…" : "Claim sysadmin"}
          </button>
        ) : null
      }
    >
      <div className="space-y-8">
        <MetricsGrid metrics={metrics} />

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <QuickActions />
            <ActivityFeed projects={recent} onOpen={(id) => navigate({ to: "/vetting", search: { id } })} />
          </div>
          <div className="space-y-6">
            <SystemHealthCard />
            <ModelRoutingCard />
          </div>
        </div>
      </div>
    </OSShell>
  );
}

/* ───────── Metrics ───────── */

type Metric = {
  label: string;
  value: string;
  delta?: { value: string; positive: boolean };
  icon: typeof Briefcase;
  hint?: string;
};

function buildMetrics(projects: Project[]): Metric[] {
  const ready = projects.filter((p) => !!p.scores);
  const pipeline = projects.length - ready.length;
  const scores = projects.map((p) => overallScore(p.scores)).filter((s): s is number => s !== null);
  const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const successRate = projects.length
    ? Math.round((ready.filter((p) => (overallScore(p.scores) ?? 0) >= 70).length / projects.length) * 100)
    : 0;

  const now = Date.now();
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const newThisWeek = projects.filter((p) => p.createdAt >= weekAgo).length;

  return [
    {
      label: "Active Ventures",
      value: String(ready.length),
      delta: newThisWeek > 0 ? { value: `+${newThisWeek} this week`, positive: true } : undefined,
      icon: Briefcase,
      hint: "Vetted & scored",
    },
    {
      label: "Ideas in Pipeline",
      value: String(pipeline),
      icon: Clock,
      hint: "Awaiting vetting",
    },
    {
      label: "Avg. ForgeScore",
      value: avg ? `${avg}` : "—",
      delta: avg ? { value: `${avg}/100`, positive: avg >= 60 } : undefined,
      icon: Gauge,
      hint: "Across all ventures",
    },
    {
      label: "Success Rate",
      value: `${successRate}%`,
      delta: { value: "≥70 ForgeScore", positive: successRate >= 50 },
      icon: TrendingUp,
      hint: "Ventures meeting bar",
    },
  ];
}

function MetricsGrid({ metrics }: { metrics: Metric[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {metrics.map((m, i) => {
        const Icon = m.icon;
        return (
          <motion.div
            key={m.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
            className="group relative overflow-hidden rounded-xl border border-border bg-card/70 p-5 shadow-elegant transition hover:border-indigo/40"
          >
            <div className="flex items-start justify-between">
              <div className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-surface-2 text-indigo">
                <Icon className="h-4 w-4" />
              </div>
              {m.delta && (
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    m.delta.positive
                      ? "bg-success/10 text-[oklch(0.78_0.16_155)]"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <ArrowUpRight className="h-3 w-3" /> {m.delta.value}
                </span>
              )}
            </div>
            <p className="mt-5 text-xs uppercase tracking-[0.18em] text-muted-foreground">
              {m.label}
            </p>
            <p className="mt-1 font-display text-3xl font-semibold tabular-nums">{m.value}</p>
            {m.hint && <p className="mt-1 text-xs text-muted-foreground">{m.hint}</p>}
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-12 -right-12 h-32 w-32 rounded-full bg-indigo/10 blur-3xl opacity-0 group-hover:opacity-100 transition duration-500"
            />
          </motion.div>
        );
      })}
    </div>
  );
}

/* ───────── Quick actions ───────── */

const QUICK = [
  {
    to: "/intake" as const,
    label: "Capture a new idea",
    body: "Quick capture or detailed intake with AI-assisted enhancement.",
    icon: Sparkles,
  },
  {
    to: "/portfolio" as const,
    label: "Open the portfolio",
    body: "Kanban + table view of every active venture with scores and KPIs.",
    icon: Briefcase,
  },
  {
    to: "/workflows" as const,
    label: "Run a workflow",
    body: "Launch Venture Incubator v3 and other Langflow pipelines.",
    icon: Workflow,
  },
  {
    to: "/chat" as const,
    label: "Team chat & feedback",
    body: "Threaded comments on ideas and ventures via the Hermes Gateway.",
    icon: MessageSquare,
  },
];

function QuickActions() {
  return (
    <section className="rounded-xl border border-border bg-card/50 p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Quick actions
        </h2>
        <Link
          to="/intake"
          className="inline-flex items-center gap-1 text-xs text-indigo hover:underline"
        >
          <Plus className="h-3 w-3" /> New idea
        </Link>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {QUICK.map((q) => {
          const Icon = q.icon;
          return (
            <Link
              key={q.to}
              to={q.to}
              className="group flex items-start gap-3 rounded-lg border border-border bg-surface-1/60 p-4 transition hover:border-indigo/40 hover:bg-surface-2/60"
            >
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-surface-2 text-indigo">
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{q.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{q.body}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground" />
            </Link>
          );
        })}
      </div>
    </section>
  );
}

/* ───────── Activity feed ───────── */

function ActivityFeed({ projects, onOpen }: { projects: Project[]; onOpen: (id: string) => void }) {
  return (
    <section className="rounded-xl border border-border bg-card/50">
      <header className="flex items-center justify-between border-b border-border px-5 py-4">
        <h2 className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Recent activity
        </h2>
        <Link to="/portfolio" className="text-xs text-indigo hover:underline">
          View all
        </Link>
      </header>
      {projects.length === 0 ? (
        <div className="px-5 py-12 text-center">
          <p className="text-sm text-muted-foreground">No ventures yet.</p>
          <Link
            to="/intake"
            className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-gradient-indigo px-3.5 py-2 text-xs font-medium text-ember-foreground shadow-indigo hover:brightness-110 transition"
          >
            <Plus className="h-3.5 w-3.5" /> Capture your first idea
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {projects.map((p, i) => {
            const score = overallScore(p.scores);
            const ready = !!p.scores;
            return (
              <motion.li
                key={p.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: i * 0.04 }}
              >
                <button
                  onClick={() => onOpen(p.id)}
                  className="flex w-full items-center gap-4 px-5 py-3.5 text-left transition hover:bg-surface-2/40"
                >
                  <div
                    className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${
                      ready ? "bg-success/15 text-[oklch(0.78_0.16_155)]" : "bg-indigo/15 text-indigo"
                    }`}
                  >
                    {ready ? <CheckCircle2 className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{p.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{p.idea}</p>
                  </div>
                  <div className="hidden sm:flex items-center gap-3 shrink-0">
                    {score !== null ? (
                      <span className="font-display text-sm font-semibold tabular-nums">
                        {score}
                        <span className="ml-0.5 text-xs text-muted-foreground">/100</span>
                      </span>
                    ) : (
                      <span className="rounded-full border border-indigo/30 bg-indigo/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-indigo">
                        Vetting
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground tabular-nums w-20 text-right">
                      {timeAgo(p.updatedAt)}
                    </span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </button>
              </motion.li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/* ───────── System cards ───────── */

function SystemHealthCard() {
  const services = [
    { name: "Langflow", status: "pending" as const },
    { name: "LiteLLM", status: "pending" as const },
    { name: "Ollama", status: "pending" as const },
    { name: "Hermes Gateway", status: "pending" as const },
  ];
  return (
    <section className="rounded-xl border border-border bg-card/50 p-5">
      <header className="flex items-center justify-between">
        <h2 className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          System health
        </h2>
        <Link to="/system" className="text-xs text-indigo hover:underline">
          Details
        </Link>
      </header>
      <ul className="mt-4 space-y-2.5">
        {services.map((s) => (
          <li
            key={s.name}
            className="flex items-center justify-between rounded-lg border border-border bg-surface-1/40 px-3 py-2.5"
          >
            <div className="flex items-center gap-2.5">
              <span className="relative grid h-6 w-6 place-items-center rounded-full bg-surface-2">
                <Activity className="h-3 w-3 text-muted-foreground" />
              </span>
              <span className="text-sm">{s.name}</span>
            </div>
            <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-warning animate-pulse" />
              Awaiting endpoint
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ModelRoutingCard() {
  return (
    <section className="relative overflow-hidden rounded-xl border border-border bg-gradient-to-br from-indigo/10 via-card/60 to-card/60 p-5 shadow-elegant">
      <div className="absolute inset-0 grid-bg opacity-[0.1]" aria-hidden />
      <div className="relative">
        <div className="flex items-center gap-2 text-indigo">
          <Zap className="h-4 w-4" />
          <p className="text-[11px] font-medium uppercase tracking-[0.18em]">Model routing</p>
        </div>
        <p className="mt-3 font-display text-lg font-semibold leading-snug">
          Grok-4.3 for reasoning, Ollama for local privacy.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Adaptive routing keeps premium tokens for high-leverage steps and offloads bulk work to your local stack.
        </p>
        <Link
          to="/system"
          className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-2/70 px-3 py-1.5 text-xs hover:bg-surface-3 transition"
        >
          Configure routing <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </section>
  );
}
