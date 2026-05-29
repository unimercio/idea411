import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowRight,
  CheckCircle2,
  Flame,
  Loader2,
  ShieldCheck,
  TrendingUp,
  Users,
  Sparkles,
} from "lucide-react";
import { z } from "zod";
import { createProject, getProject, updateProject } from "@/lib/projects";

const search = z.object({
  idea: z.string().trim().min(1).max(2000).optional().catch(undefined),
  id: z.string().trim().min(1).max(64).optional().catch(undefined),
});

export const Route = createFileRoute("/vetting")({
  validateSearch: search,
  head: () => ({
    meta: [
      { title: "Vetting in progress — IdeaForge" },
      {
        name: "description",
        content:
          "IdeaForge runs compliance, market viability and demand scoring across your concept.",
      },
    ],
  }),
  component: VettingPage,
});

type StageKey = "compliance" | "market" | "demand";
type Status = "pending" | "running" | "done";

type Stage = {
  key: StageKey;
  title: string;
  blurb: string;
  icon: typeof ShieldCheck;
  durationMs: number;
};

const STAGES: Stage[] = [
  {
    key: "compliance",
    title: "Compliance & IP",
    blurb: "Scanning regulations, safety standards, and prior art.",
    icon: ShieldCheck,
    durationMs: 2200,
  },
  {
    key: "market",
    title: "Market viability",
    blurb: "Mapping competitive landscape, TAM, and category whitespace.",
    icon: TrendingUp,
    durationMs: 2600,
  },
  {
    key: "demand",
    title: "Demand scoring",
    blurb: "Modeling buyer intent, willingness to pay, and channel fit.",
    icon: Users,
    durationMs: 2400,
  },
];

function VettingPage() {
  const { idea: ideaParam, id: idParam } = Route.useSearch();
  const navigate = useNavigate();

  // Resolve or create a project once on mount.
  const projectRef = useRef<{ id: string; idea: string; hadScores: boolean } | null>(null);
  if (!projectRef.current) {
    if (idParam) {
      const existing = getProject(idParam);
      if (existing) {
        projectRef.current = {
          id: existing.id,
          idea: existing.idea,
          hadScores: !!existing.scores,
        };
      }
    }
    if (!projectRef.current && ideaParam) {
      const p = createProject({ idea: ideaParam });
      projectRef.current = { id: p.id, idea: p.idea, hadScores: false };
    }
  }
  const idea = projectRef.current?.idea ?? ideaParam ?? "";
  const projectId = projectRef.current?.id;
  const hadScores = projectRef.current?.hadScores ?? false;

  // Deterministic scores keyed off the project id (or idea fallback) so reopens match.
  const scores = useMemo(
    () => synthesize(projectId ?? idea ?? "concept"),
    [projectId, idea],
  );

  // If reopening a project that already has scores, skip the animation.
  const initial: Status = hadScores ? "done" : "pending";
  const [statuses, setStatuses] = useState<Record<StageKey, Status>>({
    compliance: initial,
    market: initial,
    demand: initial,
  });

  useEffect(() => {
    if (hadScores) return;
    let cancelled = false;
    (async () => {
      for (const stage of STAGES) {
        if (cancelled) return;
        setStatuses((s) => ({ ...s, [stage.key]: "running" }));
        await wait(stage.durationMs);
        if (cancelled) return;
        setStatuses((s) => ({ ...s, [stage.key]: "done" }));
      }
      if (projectId) {
        updateProject(projectId, { scores, status: "ready" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hadScores, projectId, scores]);

  const allDone = STAGES.every((s) => statuses[s.key] === "done");
  const completed = STAGES.filter((s) => statuses[s.key] === "done").length;
  const progress = Math.round((completed / STAGES.length) * 100);

  const overall = Math.round(
    scores.compliance * 0.3 + scores.market * 0.35 + scores.demand * 0.35,
  );


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
          <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground transition">
            Dashboard →
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-6 pt-16 pb-24">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-ember" />
              Vetting in progress
            </span>
            <h1 className="mt-4 font-display text-3xl sm:text-4xl font-semibold text-balance">
              {allDone ? "Your opportunity report" : "Forging your opportunity report"}
            </h1>
            {idea && (
              <p className="mt-3 max-w-2xl text-sm text-muted-foreground line-clamp-2">
                "{idea}"
              </p>
            )}
          </div>
          <div className="min-w-[200px]">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Progress</span>
              <span>{progress}%</span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
              <motion.div
                className="h-full bg-gradient-ember"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
          </div>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {STAGES.map((stage, i) => (
            <StageCard
              key={stage.key}
              index={i}
              stage={stage}
              status={statuses[stage.key]}
              score={scores[stage.key]}
              details={DETAILS[stage.key]}
            />
          ))}
        </div>

        <AnimatePresence>
          {allDone && (
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="mt-10 overflow-hidden rounded-3xl border border-ember/30 bg-gradient-surface p-8 shadow-ember"
            >
              <div className="flex items-start justify-between flex-wrap gap-6">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-ember">Forge score</p>
                  <div className="mt-3 flex items-end gap-3">
                    <span className="font-display text-6xl font-semibold">{overall}</span>
                    <span className="mb-2 text-sm text-muted-foreground">/ 100</span>
                  </div>
                  <p className="mt-3 max-w-md text-sm text-muted-foreground">
                    {overall >= 75
                      ? "Strong signal. This concept is ready for visualization and patent drafting."
                      : overall >= 55
                        ? "Promising. A few refinements will unlock a launch-ready position."
                        : "Early. Tighten the wedge before investing in renders or IP."}
                  </p>
                </div>
                <button
                  onClick={() => navigate({ to: "/deliverables" })}
                  className="group inline-flex items-center gap-2 rounded-full bg-gradient-ember px-5 py-2.5 text-sm font-medium text-ember-foreground shadow-ember hover:brightness-110 transition"
                >
                  Continue to renders
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </main>
  );
}

function StageCard({
  index,
  stage,
  status,
  score,
  details,
}: {
  index: number;
  stage: Stage;
  status: Status;
  score: number;
  details: { label: string; value: string }[];
}) {
  const Icon = stage.icon;
  const verdict = score >= 75 ? "Strong" : score >= 55 ? "Promising" : "Watch";
  const verdictColor =
    score >= 75 ? "text-emerald-400" : score >= 55 ? "text-ember" : "text-amber-400";

  return (
    <motion.article
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 + index * 0.08, ease: [0.22, 1, 0.36, 1] }}
      className={
        "relative overflow-hidden rounded-3xl border bg-card/80 p-6 transition " +
        (status === "done"
          ? "border-border shadow-elegant"
          : status === "running"
            ? "border-ember/40"
            : "border-border/60 opacity-80")
      }
    >
      <div className="flex items-center justify-between">
        <span
          className={
            "grid h-9 w-9 place-items-center rounded-xl border border-border " +
            (status === "pending" ? "bg-background/40 text-muted-foreground" : "bg-background/80 text-ember")
          }
        >
          <Icon className="h-4 w-4" />
        </span>
        <StatusBadge status={status} />
      </div>

      <h3 className="mt-5 font-display text-lg font-semibold">{stage.title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{stage.blurb}</p>

      <div className="mt-6 h-[140px]">
        <AnimatePresence mode="wait">
          {status !== "done" ? (
            <motion.div
              key="placeholder"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full space-y-2"
            >
              <SkeletonRow w="80%" />
              <SkeletonRow w="62%" />
              <SkeletonRow w="70%" />
              <SkeletonRow w="48%" />
            </motion.div>
          ) : (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="flex items-baseline justify-between">
                <span className="font-display text-4xl font-semibold">{score}</span>
                <span className={"text-xs font-medium uppercase tracking-wider " + verdictColor}>
                  {verdict}
                </span>
              </div>
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${score}%` }}
                  transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                  className="h-full bg-gradient-ember"
                />
              </div>
              <ul className="mt-4 space-y-1.5 text-xs">
                {details.map((d) => (
                  <li key={d.label} className="flex justify-between text-muted-foreground">
                    <span>{d.label}</span>
                    <span className="text-foreground">{d.value}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.article>
  );
}

function StatusBadge({ status }: { status: Status }) {
  if (status === "done") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-emerald-400">
        <CheckCircle2 className="h-3 w-3" /> Complete
      </span>
    );
  }
  if (status === "running") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-ember/40 bg-ember/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-ember">
        <Loader2 className="h-3 w-3 animate-spin" /> Analyzing
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background/40 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
      Queued
    </span>
  );
}

function SkeletonRow({ w }: { w: string }) {
  return (
    <div
      className="h-3 rounded-full bg-secondary animate-pulse"
      style={{ width: w }}
    />
  );
}

function wait(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

// Deterministic pseudo-scores so the same idea always lands in the same place.
function synthesize(seed: string): Record<StageKey, number> {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const rand = (salt: number) => {
    const x = Math.sin(h + salt) * 10000;
    return x - Math.floor(x);
  };
  return {
    compliance: 60 + Math.floor(rand(1) * 35),
    market: 55 + Math.floor(rand(2) * 40),
    demand: 50 + Math.floor(rand(3) * 45),
  };
}

const DETAILS: Record<StageKey, { label: string; value: string }[]> = {
  compliance: [
    { label: "Regulatory risk", value: "Low" },
    { label: "Prior art hits", value: "3 adjacent" },
    { label: "Freedom to operate", value: "Likely" },
  ],
  market: [
    { label: "TAM", value: "$4.2B" },
    { label: "Growth (5y CAGR)", value: "+11.4%" },
    { label: "Whitespace", value: "Mid-premium" },
  ],
  demand: [
    { label: "Buyer intent", value: "High" },
    { label: "Suggested price", value: "$129" },
    { label: "Best channel", value: "DTC + Kickstarter" },
  ],
};
