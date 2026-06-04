import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowRight,
  ChevronDown,
  Flame,
  Gauge,
  Loader2,
  RefreshCcw,
  Send,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
  AlertTriangle,
  CheckCircle2,
  ArrowUpRight,
  Minus,
  ArrowDownRight,
  MessageSquare,
  UsersRound,
} from "lucide-react";
import { z } from "zod";
import { analyzeIdea, type Analysis } from "@/lib/api/vetting.functions";
import { chatAboutIdea } from "@/lib/api/vetting-chat.functions";
import { runFocusGroup } from "@/lib/api/focus-group.functions";
import { researchMarketSize } from "@/lib/api/market-research.functions";
import { listPromptTemplates } from "@/lib/api/prompt-templates.functions";
import {
  createProject,
  getProject,
  updateProject,
  type ChatMessage,
} from "@/lib/projects";

const search = z.object({
  idea: z.string().trim().min(1).max(4000).optional().catch(undefined),
  id: z.string().trim().min(1).max(64).optional().catch(undefined),
});

export const Route = createFileRoute("/vetting")({
  validateSearch: search,
  head: () => ({
    meta: [
      { title: "Vetting analysis — IdeaForge" },
      {
        name: "description",
        content:
          "A deep, AI-driven analysis of your concept across compliance, market viability and sales potential.",
      },
    ],
  }),
  component: VettingPage,
});

/* ─────────────────────────────── Page ─────────────────────────────── */

function VettingPage() {
  const { idea: ideaParam, id: idParam } = Route.useSearch();
  const navigate = useNavigate();
  const runAnalysis = useServerFn(analyzeIdea);
  const runSizing = useServerFn(researchMarketSize);

  // Resolve / create project once.
  const projectRef = useRef<{ id: string; idea: string; sketchName?: string } | null>(null);
  if (!projectRef.current) {
    if (idParam) {
      const existing = getProject(idParam);
      if (existing) {
        projectRef.current = {
          id: existing.id,
          idea: existing.idea,
          sketchName: existing.sketchName,
        };
      }
    }
    if (!projectRef.current && ideaParam) {
      const p = createProject({ idea: ideaParam });
      projectRef.current = { id: p.id, idea: p.idea };
    }
  }

  const projectId = projectRef.current?.id;
  const idea = projectRef.current?.idea ?? "";
  const sketchName = projectRef.current?.sketchName;

  const cachedAnalysis = useMemo<Analysis | undefined>(() => {
    if (!projectId) return undefined;
    return getProject(projectId)?.analysis;
  }, [projectId]);

  const [analysis, setAnalysis] = useState<Analysis | undefined>(cachedAnalysis);
  const [loading, setLoading] = useState(!cachedAnalysis);
  const [error, setError] = useState<string | null>(null);

  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current) return;
    if (!projectId || !idea) return;
    if (cachedAnalysis) return;
    startedRef.current = true;
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, idea, cachedAnalysis]);

  async function run() {
    if (!projectId || !idea) return;
    setLoading(true);
    setError(null);
    try {
      const [result, sizingResult] = await Promise.all([
        runAnalysis({ data: { idea, sketchName } }),
        runSizing({ data: { idea } }).catch((err) => {
          console.warn("Sourced market sizing failed:", err);
          return null;
        }),
      ]);
      if (sizingResult) {
        result.market.sourcedSizing = sizingResult;
        result.market.tam = sizingResult.tam.value;
        result.market.sam = sizingResult.sam.value;
        result.market.som = sizingResult.som.value;
      }
      setAnalysis(result);
      const scores = {
        compliance: Math.round(result.compliance.score * 10),
        market: Math.round(result.market.score * 10),
        demand: Math.round(result.sales.score * 10),
      };
      const existing = getProject(projectId);
      const iterations = existing?.iterations ?? [];
      iterations.push({
        at: Date.now(),
        idea,
        scores,
        overall: Math.round(result.overallScore),
        thesis: result.oneLineThesis,
      });
      updateProject(projectId, {
        analysis: result,
        scores,
        iterations,
        status: "ready",
      });
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Vetting failed. Please try again.");
      updateProject(projectId, { status: "error" });
    } finally {
      setLoading(false);
    }
  }

  if (!projectId || !idea) {
    return (
      <Shell>
        <div className="mx-auto max-w-2xl px-6 py-32 text-center">
          <h1 className="font-display text-3xl font-semibold">No idea to vet.</h1>
          <p className="mt-3 text-muted-foreground">
            Start from intake to drop a new concept into the forge.
          </p>
          <Link
            to="/intake"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-gradient-ember px-5 py-2.5 text-sm font-medium text-ember-foreground shadow-ember hover:brightness-110 transition"
          >
            New idea <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <section className="mx-auto max-w-6xl px-6 pt-14 pb-24">
        <Header idea={idea} />

        {loading && <AnalyzingState />}
        {!loading && error && <ErrorState message={error} onRetry={run} />}
        {!loading && !error && analysis && (
          <ResultsView
            idea={idea}
            analysis={analysis}
            projectId={projectId}
            onRefine={() => navigate({ to: "/intake", search: { refine: projectId } })}
            onRerun={() => {
              startedRef.current = false;
              setAnalysis(undefined);
              run();
            }}
          />
        )}
      </section>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
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
      {children}
    </main>
  );
}

function Header({ idea }: { idea: string }) {
  return (
    <div>
      <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5 text-ember" /> AI vetting & analysis
      </span>
      <h1 className="mt-5 font-display text-4xl sm:text-5xl font-semibold text-balance leading-[1.05]">
        Your opportunity report.
      </h1>
      <p className="mt-4 max-w-2xl text-sm text-muted-foreground line-clamp-3">
        "{idea}"
      </p>
    </div>
  );
}

/* ─────────────────────────────── States ─────────────────────────────── */

const PROGRESS_STEPS = [
  { icon: ShieldCheck, label: "Scanning compliance, regulations & prior art" },
  { icon: TrendingUp, label: "Mapping market, competitors & whitespace" },
  { icon: Users, label: "Modeling demand, pricing & revenue paths" },
];

function AnalyzingState() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setStep((s) => (s + 1) % PROGRESS_STEPS.length), 1800);
    return () => clearInterval(id);
  }, []);
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="mt-12 rounded-3xl border border-border bg-card/60 p-10 shadow-elegant"
    >
      <div className="flex items-center gap-3 text-ember">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-xs uppercase tracking-[0.2em]">Analyzing</span>
      </div>
      <h2 className="mt-4 font-display text-2xl font-semibold">
        Consulting our innovation desk…
      </h2>
      <p className="mt-2 max-w-xl text-sm text-muted-foreground">
        We're running your concept through compliance, market and demand models.
        This usually takes 15–30 seconds.
      </p>
      <ul className="mt-8 space-y-3">
        {PROGRESS_STEPS.map((s, i) => {
          const Icon = s.icon;
          const active = i === step;
          const done = i < step;
          return (
            <li
              key={s.label}
              className={
                "flex items-center gap-3 rounded-2xl border px-4 py-3 transition " +
                (active
                  ? "border-ember/40 bg-ember/5 text-foreground"
                  : done
                    ? "border-border/60 bg-background/40 text-muted-foreground"
                    : "border-border/40 bg-background/20 text-muted-foreground/70")
              }
            >
              <Icon className={"h-4 w-4 " + (active ? "text-ember" : "")} />
              <span className="text-sm">{s.label}</span>
              {active && <Loader2 className="ml-auto h-3.5 w-3.5 animate-spin text-ember" />}
              {done && <CheckCircle2 className="ml-auto h-3.5 w-3.5 text-emerald-400" />}
            </li>
          );
        })}
      </ul>
    </motion.div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="mt-12 rounded-3xl border border-destructive/30 bg-destructive/5 p-8">
      <div className="flex items-center gap-2 text-destructive">
        <AlertTriangle className="h-5 w-5" />
        <span className="text-sm font-medium">Vetting failed</span>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{message}</p>
      <button
        onClick={onRetry}
        className="mt-5 inline-flex items-center gap-2 rounded-full bg-gradient-ember px-4 py-2 text-sm font-medium text-ember-foreground shadow-ember hover:brightness-110 transition"
      >
        <RefreshCcw className="h-4 w-4" /> Try again
      </button>
    </div>
  );
}

/* ─────────────────────────────── Results ─────────────────────────────── */

function ResultsView({
  idea,
  analysis,
  projectId,
  onRefine,
  onRerun,
}: {
  idea: string;
  analysis: Analysis;
  projectId: string;
  onRefine: () => void;
  onRerun: () => void;
}) {
  return (
    <div className="mt-12 space-y-8">
      <OverallCard analysis={analysis} onRefine={onRefine} onRerun={onRerun} />

      <div className="grid gap-5 lg:grid-cols-3">
        <CompliancePillar data={analysis.compliance} />
        <MarketPillar data={analysis.market} />
        <SalesPillar data={analysis.sales} />
      </div>

      <FocusGroupPanel idea={idea} analysis={analysis} projectId={projectId} />

      <ChatPanel idea={idea} analysis={analysis} projectId={projectId} />

    </div>
  );
}

function OverallCard({
  analysis,
  onRefine,
  onRerun,
}: {
  analysis: Analysis;
  onRefine: () => void;
  onRerun: () => void;
}) {
  const o = Math.round(analysis.overallScore);
  const tone = scoreTone(o, 100);
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-3xl border border-ember/30 bg-gradient-surface p-8 sm:p-10 shadow-ember"
    >
      <div className="grid gap-10 lg:grid-cols-[auto_1fr_auto] lg:items-center">
        <ScoreGauge value={o} max={100} tone={tone} large />
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-ember">Overall idea health</p>
          <h2 className="mt-3 font-display text-3xl sm:text-4xl font-semibold text-balance leading-tight">
            {analysis.healthVerdict}
          </h2>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
            {analysis.oneLineThesis}
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <PillarChip
              icon={ShieldCheck}
              label="Compliance"
              score={analysis.compliance.score}
            />
            <PillarChip icon={TrendingUp} label="Market" score={analysis.market.score} />
            <PillarChip icon={Users} label="Sales" score={analysis.sales.score} />
          </div>
        </div>
        <div className="flex lg:flex-col gap-2 lg:items-stretch">
          <button
            onClick={onRefine}
            className="group inline-flex items-center justify-center gap-2 rounded-full bg-gradient-ember px-5 py-2.5 text-sm font-medium text-ember-foreground shadow-ember hover:brightness-110 transition whitespace-nowrap"
          >
            Refine my idea
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </button>
          <button
            onClick={onRerun}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-background/60 px-5 py-2.5 text-sm hover:bg-accent transition whitespace-nowrap"
          >
            <RefreshCcw className="h-3.5 w-3.5" /> Re-run
          </button>
        </div>
      </div>
    </motion.section>
  );
}

function PillarChip({
  icon: Icon,
  label,
  score,
}: {
  icon: typeof ShieldCheck;
  label: string;
  score: number;
}) {
  const tone = scoreTone(score, 10);
  return (
    <span
      className={
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs " +
        toneClasses(tone)
      }
    >
      <Icon className="h-3.5 w-3.5" />
      {label} · <strong className="font-display">{score.toFixed(1)}</strong>
      <span className="opacity-60">/10</span>
    </span>
  );
}

/* ─────────────────────────────── Pillars ─────────────────────────────── */

/**
 * Render pillar body text with light formatting:
 * - splits on blank lines into paragraphs
 * - lines starting with "- ", "* ", "• " or "1. " become list items
 * - inline **bold** → <strong>
 * - "Label: value" at the start of a line bolds the label
 */
function FormattedBody({ text, className = "" }: { text: string; className?: string }) {
  const blocks = text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);

  const renderInline = (s: string, keyPrefix: string) => {
    const parts = s.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((p, i) =>
      p.startsWith("**") && p.endsWith("**") ? (
        <strong key={`${keyPrefix}-${i}`} className="text-foreground font-medium">
          {p.slice(2, -2)}
        </strong>
      ) : (
        <span key={`${keyPrefix}-${i}`}>{p}</span>
      ),
    );
  };

  const renderLine = (line: string, keyPrefix: string) => {
    const labelMatch = line.match(/^([A-Z][A-Za-z0-9 /&'-]{1,40}):\s+(.*)$/);
    if (labelMatch) {
      return (
        <>
          <strong className="text-foreground font-medium">{labelMatch[1]}:</strong>{" "}
          {renderInline(labelMatch[2], keyPrefix)}
        </>
      );
    }
    return renderInline(line, keyPrefix);
  };

  return (
    <div className={`space-y-2 text-sm text-muted-foreground leading-relaxed ${className}`}>
      {blocks.map((block, bi) => {
        const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
        const isList = lines.every((l) => /^([-*•]|\d+\.)\s+/.test(l));
        if (isList && lines.length > 1) {
          const ordered = /^\d+\.\s+/.test(lines[0]);
          const items = lines.map((l) => l.replace(/^([-*•]|\d+\.)\s+/, ""));
          return ordered ? (
            <ol key={bi} className="ml-1 space-y-1.5">
              {items.map((it, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-ember font-medium shrink-0">{i + 1}.</span>
                  <span>{renderLine(it, `b${bi}-i${i}`)}</span>
                </li>
              ))}
            </ol>
          ) : (
            <ul key={bi} className="ml-1 space-y-1.5">
              {items.map((it, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-ember shrink-0">•</span>
                  <span>{renderLine(it, `b${bi}-i${i}`)}</span>
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={bi}>
            {lines.map((l, i) => (
              <span key={i}>
                {renderLine(l, `b${bi}-l${i}`)}
                {i < lines.length - 1 ? " " : null}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}



function PillarCard({
  index,
  icon: Icon,
  title,
  score,
  summary,
  children,
}: {
  index: number;
  icon: typeof ShieldCheck;
  title: string;
  score: number;
  summary: string;
  children: React.ReactNode;
}) {
  const tone = scoreTone(score, 10);
  return (
    <motion.article
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 + index * 0.08, ease: [0.22, 1, 0.36, 1] }}
      className="relative rounded-3xl border border-border bg-card/80 p-6 shadow-elegant flex flex-col"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl border border-border bg-background/80 text-ember">
          <Icon className="h-4 w-4" />
        </span>
        <ScoreGauge value={score} max={10} tone={tone} />
      </div>
      <h3 className="mt-5 font-display text-xl font-semibold">{title}</h3>
      <FormattedBody text={summary} className="mt-2" />

      <div className="mt-5 flex-1">{children}</div>
    </motion.article>
  );
}

function CompliancePillar({ data }: { data: Analysis["compliance"] }) {
  return (
    <PillarCard
      index={0}
      icon={ShieldCheck}
      title="Compliance & IP"
      score={data.score}
      summary={data.summary}
    >
      <div className="space-y-3">
        {data.risks.slice(0, 3).map((r) => (
          <div
            key={r.title}
            className="rounded-2xl border border-border bg-background/40 p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">{r.title}</span>
              <SeverityChip severity={r.severity} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{r.detail}</p>
          </div>
        ))}
      </div>
      <Expandable label={`See ${data.risks.length - 3 > 0 ? "all risks + " : ""}regulations & IP`}>
        {data.risks.length > 3 && (
          <Section title="Additional risks">
            <ul className="space-y-2 text-xs text-muted-foreground">
              {data.risks.slice(3).map((r) => (
                <li key={r.title} className="flex justify-between gap-2">
                  <span className="text-foreground">{r.title}</span>
                  <SeverityChip severity={r.severity} />
                </li>
              ))}
            </ul>
          </Section>
        )}
        <Section title="Applicable regulations">
          <TagRow items={data.regulations} />
        </Section>
        <Section title="IP concerns">
          <ul className="space-y-1.5 text-xs text-muted-foreground">
            {data.ipConcerns.map((c) => (
              <li key={c} className="flex gap-2">
                <span className="text-ember">•</span>
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </Section>
      </Expandable>
    </PillarCard>
  );
}

function MarketPillar({ data }: { data: Analysis["market"] }) {
  return (
    <PillarCard
      index={1}
      icon={TrendingUp}
      title="Market viability"
      score={data.score}
      summary={data.summary}
    >
      <div className="grid grid-cols-3 gap-2">
        <Stat label="TAM" value={data.tam} />
        <Stat label="SAM" value={data.sam} />
        <Stat label="SOM" value={data.som} />
      </div>
      {data.sourcedSizing ? (
        <div className="mt-3 space-y-2 rounded-xl border border-border bg-background/40 p-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Sourced sizing
            </span>
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-400">
              Web-grounded · Perplexity
            </span>
          </div>
          <dl className="space-y-1.5 text-[11px]">
            {(["tam", "sam", "som"] as const).map((k) => (
              <div key={k}>
                <dt className="font-medium uppercase tracking-wider text-foreground">
                  {k.toUpperCase()} · {data.sourcedSizing![k].value}
                </dt>
                <dd className="text-muted-foreground">{data.sourcedSizing![k].methodology}</dd>
              </div>
            ))}
          </dl>
          {data.sourcedSizing.assumptions.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                Assumptions
              </div>
              <ul className="space-y-1 text-[11px] text-muted-foreground">
                {data.sourcedSizing.assumptions.map((a) => (
                  <li key={a} className="flex gap-2">
                    <span className="text-ember">•</span>
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {data.sourcedSizing.sources.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                Sources
              </div>
              <ol className="space-y-1 text-[11px]">
                {data.sourcedSizing.sources.map((s, i) => (
                  <li key={s.url} className="flex gap-2">
                    <span className="text-muted-foreground">[{i + 1}]</span>
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-ember hover:underline truncate"
                    >
                      {s.title}
                    </a>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      ) : null}
      <Expandable label="See competitors, trends & differentiation">
        <Section title="Competitor grid">
          <ul className="space-y-2">
            {data.competitors.map((c) => (
              <li
                key={c.name}
                className="flex items-start justify-between gap-3 rounded-xl border border-border bg-background/40 p-2.5"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{c.name}</div>
                  <div className="text-[11px] text-muted-foreground line-clamp-2">{c.note}</div>
                </div>
                <span
                  className={
                    "shrink-0 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider " +
                    (c.type === "direct"
                      ? "border-ember/40 bg-ember/10 text-ember"
                      : "border-border bg-background/40 text-muted-foreground")
                  }
                >
                  {c.type}
                </span>
              </li>
            ))}
          </ul>
        </Section>
        <Section title="Trend timeline">
          <ul className="space-y-2">
            {data.trends.map((t) => (
              <li key={t.title} className="flex items-start gap-2 text-xs">
                <TrendArrow direction={t.direction} />
                <div>
                  <span className="text-foreground font-medium">{t.title}</span>
                  <span className="text-muted-foreground"> — {t.note}</span>
                </div>
              </li>
            ))}
          </ul>
        </Section>
        <Section title="Differentiation">
          <TagRow items={data.differentiation} />
        </Section>
        <Section title="Barriers to entry">
          <TagRow items={data.barriers} muted />
        </Section>
      </Expandable>
    </PillarCard>
  );
}

function SalesPillar({ data }: { data: Analysis["sales"] }) {
  return (
    <PillarCard
      index={2}
      icon={Users}
      title="Sales potential"
      score={data.score}
      summary={data.summary}
    >
      <div className="rounded-2xl border border-border bg-background/40 p-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Recommended price
          </span>
          <DemandBadge demand={data.demand} />
        </div>
        <div className="mt-1 font-display text-2xl font-semibold text-ember">
          {data.pricing.recommended}
        </div>
        <div className="mt-2 grid grid-cols-3 gap-1.5 text-[11px] text-muted-foreground">
          <span>Low {data.pricing.low}</span>
          <span>Mid {data.pricing.mid}</span>
          <span>Premium {data.pricing.premium}</span>
        </div>
      </div>
      <Expandable label="See revenue, target customer & GTM">
        <Section title="Year-1 revenue scenarios">
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Conservative" value={data.revenue.conservative} />
            <Stat label="Moderate" value={data.revenue.moderate} highlight />
            <Stat label="Optimistic" value={data.revenue.optimistic} />
          </div>
        </Section>
        <Section title="Target customer">
          <p className="text-xs text-muted-foreground">{data.targetCustomer}</p>
        </Section>
        <Section title="Go-to-market">
          <ol className="space-y-1.5 text-xs text-muted-foreground">
            {data.gtm.map((g, i) => (
              <li key={g} className="flex gap-2">
                <span className="text-ember font-medium">{i + 1}.</span>
                <span>{g}</span>
              </li>
            ))}
          </ol>
        </Section>
      </Expandable>
    </PillarCard>
  );
}

/* ─────────────────────────────── Chat ─────────────────────────────── */

function FocusGroupPanel({
  idea,
  analysis,
  projectId,
}: {
  idea: string;
  analysis: Analysis;
  projectId: string;
}) {
  const runFn = useServerFn(runFocusGroup);
  void runFn; // kept for type compat; streaming uses fetch below
  const [transcript, setTranscript] = useState<string | undefined>(
    () => getProject(projectId)?.focusGroup,
  );
  const [streaming, setStreaming] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  async function run() {
    setLoading(true);
    setErr(null);
    setStreaming("");
    setOpen(true);
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    try {
      const res = await fetch("/api/focus-group-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea, analysis }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const msg = (await res.text().catch(() => "")) || `Request failed (${res.status})`;
        throw new Error(msg);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setStreaming(acc);
      }
      acc += decoder.decode();
      const formatted = formatFocusGroupTranscript(acc);
      setTranscript(formatted);
      setStreaming("");
      updateProject(projectId, { focusGroup: formatted });
    } catch (e) {
      if ((e as { name?: string })?.name === "AbortError") return;
      console.error(e);
      setErr(e instanceof Error ? e.message : "Focus group failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-3xl border border-border bg-card/80 shadow-elegant overflow-hidden"
    >
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-6 py-4">
        <span className="grid h-9 w-9 place-items-center rounded-xl border border-border bg-background/80 text-ember">
          <UsersRound className="h-4 w-4" />
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="font-display text-lg font-semibold leading-tight">
            AI Focus Group
          </h3>
          <p className="text-xs text-muted-foreground">
            Simulate 8 diverse personas debating your concept across 3 strategic questions.
          </p>
        </div>
        <button
          onClick={run}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-full bg-gradient-ember px-4 py-2 text-sm font-medium text-ember-foreground shadow-ember hover:brightness-110 transition disabled:opacity-60"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Convening…
            </>
          ) : transcript ? (
            <>
              <RefreshCcw className="h-4 w-4" /> Re-run
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" /> Run focus group
            </>
          )}
        </button>
      </div>

      {err && (
        <div className="px-6 py-4 text-sm text-destructive border-b border-destructive/20 bg-destructive/5">
          {err}
        </div>
      )}

      {!transcript && !loading && !err && !streaming && (
        <div className="px-6 py-8 text-sm text-muted-foreground">
          Click <strong className="text-foreground">Run focus group</strong> to generate
          8 AI personas tuned to your target customer and watch them discuss your idea
          live as it streams in.
        </div>
      )}

      {(streaming || transcript) && (
        <div className="px-6 py-5">
          <button
            onClick={() => setOpen((v) => !v)}
            className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition"
          >
            <ChevronDown
              className={`h-3.5 w-3.5 transition ${open ? "" : "-rotate-90"}`}
            />
            {open
              ? streaming
                ? "Hide live transcript"
                : "Hide transcript"
              : streaming
                ? "Show live transcript"
                : "Show transcript"}
            {streaming && (
              <Loader2 className="h-3 w-3 animate-spin text-ember ml-1" />
            )}
          </button>
          <AnimatePresence initial={false}>
            {open && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <article className="prose prose-invert prose-sm max-w-none prose-headings:font-display prose-headings:text-foreground prose-strong:text-foreground prose-p:text-muted-foreground prose-li:text-muted-foreground prose-ol:text-muted-foreground prose-ul:text-muted-foreground prose-hr:border-border/60 prose-h2:mt-8 prose-h2:mb-3 prose-h2:pb-2 prose-h2:border-b prose-h2:border-border/60 prose-h2:text-ember prose-h2:uppercase prose-h2:tracking-wide prose-h2:text-xs prose-h3:mt-5 prose-h3:mb-2 prose-h3:text-foreground prose-h3:text-sm prose-h3:font-semibold prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 prose-p:my-2">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {streaming
                      ? formatFocusGroupTranscript(streaming)
                      : (transcript ?? "")}
                  </ReactMarkdown>
                  {streaming && (
                    <span className="inline-block w-2 h-4 align-middle bg-ember/70 animate-pulse rounded-sm ml-0.5" />
                  )}
                </article>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </motion.section>
  );
}

function formatFocusGroupTranscript(raw: string): string {
  if (!raw) return "";
  let t = raw.replace(/\r\n/g, "\n").trim();
  // Strip leading code fences if the model wrapped output
  t = t.replace(/^```(?:markdown|md)?\n/, "").replace(/\n```$/, "");
  // Ensure a blank line before every ## / ### heading
  t = t.replace(/([^\n])\n(#{2,3} )/g, "$1\n\n$2");
  // Ensure blank line before numbered list items at top-level
  t = t.replace(/([^\n])\n(\d+\.\s+\*\*)/g, "$1\n\n$2");
  // Make "Name — details" persona lines bold if not already, inside Composition block
  t = t.replace(
    /(## Focus Group Composition\n[\s\S]*?)(?=\n## |\n*$)/,
    (block) =>
      block.replace(
        /^(\s*\d+\.\s+)(?!\*\*)([^\n*][^\n]*?)( [—-] )/gm,
        "$1**$2**$3",
      ),
  );
  // Bold speaker labels like "Name:" at the start of a paragraph in the discussion
  t = t.replace(
    /(## Focus Group Discussion\n[\s\S]*?)(?=\n## |\n*$)/,
    (block) =>
      block.replace(
        /^([A-Z][A-Za-z .'-]{1,40}):\s/gm,
        "**$1:** ",
      ),
  );
  // Collapse 3+ blank lines
  t = t.replace(/\n{3,}/g, "\n\n");
  return t.trim();
}

function ChatPanel({
  idea,
  analysis,
  projectId,
}: {
  idea: string;
  analysis: Analysis;
  projectId: string;
}) {
  const chat = useServerFn(chatAboutIdea);
  const [messages, setMessages] = useState<ChatMessage[]>(
    () => getProject(projectId)?.chat ?? [],
  );
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  async function send(text: string) {
    if (!text.trim() || sending) return;
    const next: ChatMessage[] = [...messages, { role: "user", content: text.trim() }];
    setMessages(next);
    setInput("");
    setSending(true);
    setErr(null);
    try {
      const res = await chat({ data: { idea, analysis, messages: next } });
      const withReply: ChatMessage[] = [...next, { role: "assistant", content: res.reply }];
      setMessages(withReply);
      updateProject(projectId, { chat: withReply });
    } catch (e) {
      console.error(e);
      setErr(e instanceof Error ? e.message : "Chat failed.");
      setMessages(messages); // rollback user msg from local view
    } finally {
      setSending(false);
    }
  }

  const listTemplatesFn = useServerFn(listPromptTemplates);
  const templatesQuery = useQuery({
    queryKey: ["promptTemplates", "vetting"],
    queryFn: () => listTemplatesFn(),
    staleTime: 5 * 60 * 1000,
  });
  const dbTemplates = useMemo(
    () =>
      (templatesQuery.data?.templates ?? [])
        .filter((t) => t.enabled)
        .map((t) => ({
          id: t.slug,
          category: t.category,
          template: t.template,
          requires: t.requires as (keyof TemplateVars)[],
        })),
    [templatesQuery.data],
  );

  const suggestionGroups = useMemo(
    () => buildSuggestions(analysis, dbTemplates.length > 0 ? dbTemplates : undefined),
    [analysis, dbTemplates],
  );
  const quickSuggestions = useMemo(
    () => suggestionGroups.flatMap((g) => g.items).slice(0, 3),
    [suggestionGroups],
  );

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-3xl border border-border bg-card/80 shadow-elegant overflow-hidden"
    >
      <div className="flex items-center gap-3 border-b border-border px-6 py-4">
        <span className="grid h-9 w-9 place-items-center rounded-xl border border-border bg-background/80 text-ember">
          <MessageSquare className="h-4 w-4" />
        </span>
        <div>
          <h3 className="font-display text-lg font-semibold leading-tight">Ask the analyst</h3>
          <p className="text-xs text-muted-foreground">
            Full context of your idea and this report. Ask anything to sharpen the concept.
          </p>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="max-h-[420px] min-h-[140px] overflow-y-auto px-6 py-5 space-y-4"
      >
        {messages.length === 0 && (
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Suggested prompts · tailored to your report
            </p>
            {suggestionGroups.map((group) => (
              <div key={group.label} className="space-y-1.5">
                <p className="text-[11px] font-semibold text-foreground/70">{group.label}</p>
                <div className="flex flex-wrap gap-2">
                  {group.items.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="rounded-full border border-border bg-background/60 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-ember/40 hover:bg-background transition text-left"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        {messages.length > 0 && !sending && quickSuggestions.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2">
            <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground self-center">
              Try
            </span>
            {quickSuggestions.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="rounded-full border border-border/60 bg-background/40 px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground hover:border-ember/40 transition"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        {messages.map((m, i) => (
          <Bubble key={i} role={m.role} content={m.content} />
        ))}
        {sending && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-ember" /> Thinking…
          </div>
        )}
        {err && <p className="text-xs text-destructive">{err}</p>}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-end gap-2 border-t border-border bg-background/40 px-4 py-3"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          rows={1}
          placeholder="Ask a follow-up about your report…"
          className="flex-1 resize-none bg-transparent text-sm placeholder:text-muted-foreground/60 focus:outline-none px-2 py-2 min-h-[40px] max-h-32"
        />
        <button
          type="submit"
          disabled={!input.trim() || sending}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gradient-ember text-ember-foreground shadow-ember hover:brightness-110 transition disabled:opacity-50"
          aria-label="Send"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </motion.section>
  );
}

function Bubble({ role, content }: { role: "user" | "assistant"; content: string }) {
  const isUser = role === "user";
  return (
    <div className={"flex " + (isUser ? "justify-end" : "justify-start")}>
      <div
        className={
          "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm " +
          (isUser
            ? "bg-gradient-ember text-ember-foreground shadow-ember"
            : "bg-background/70 border border-border")
        }
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{content}</p>
        ) : (
          <div className="max-w-none text-sm leading-relaxed text-foreground/90 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}



const markdownComponents: Components = {
  p: ({ children }) => <p className="my-2 first:mt-0 last:mb-0">{children}</p>,
  h1: ({ children }) => (
    <h3 className="font-display text-base font-semibold mt-3 mb-1.5 first:mt-0">{children}</h3>
  ),
  h2: ({ children }) => (
    <h3 className="font-display text-base font-semibold mt-3 mb-1.5 first:mt-0">{children}</h3>
  ),
  h3: ({ children }) => (
    <h4 className="font-display text-sm font-semibold mt-3 mb-1 first:mt-0">{children}</h4>
  ),
  h4: ({ children }) => (
    <h4 className="font-display text-sm font-semibold mt-2 mb-1 first:mt-0">{children}</h4>
  ),
  ul: ({ children }) => <ul className="my-2 ml-4 list-disc space-y-1 marker:text-ember/70">{children}</ul>,
  ol: ({ children }) => <ol className="my-2 ml-4 list-decimal space-y-1 marker:text-ember/70">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-ember underline underline-offset-2 hover:text-ember/80"
    >
      {children}
    </a>
  ),
  code: ({ children }) => (
    <code className="rounded bg-muted/60 px-1 py-0.5 font-mono text-[0.85em]">{children}</code>
  ),
  pre: ({ children }) => (
    <pre className="my-2 overflow-x-auto rounded-lg border border-border bg-muted/40 p-3 text-xs font-mono">
      {children}
    </pre>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 border-ember/50 pl-3 italic text-foreground/80">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-3 border-border" />,
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto">
      <table className="w-full border-collapse text-xs">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-border bg-muted/40 px-2 py-1 text-left font-semibold">{children}</th>
  ),
  td: ({ children }) => <td className="border border-border px-2 py-1">{children}</td>,
};

/* ─────────────────────────────── Bits ─────────────────────────────── */

function ScoreGauge({
  value,
  max,
  tone,
  large,
}: {
  value: number;
  max: number;
  tone: Tone;
  large?: boolean;
}) {
  const pct = Math.max(0, Math.min(1, value / max));
  const size = large ? 160 : 64;
  const stroke = large ? 12 : 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = c * pct;
  const color = toneStroke(tone);
  return (
    <div
      className="relative grid place-items-center"
      style={{ width: size, height: size }}
      aria-label={`Score ${value} out of ${max}`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="oklch(1 0 0 / 8%)"
          strokeWidth={stroke}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - dash }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <div className="text-center">
          <div
            className={
              "font-display font-semibold leading-none " + (large ? "text-5xl" : "text-base")
            }
          >
            {max === 10 ? value.toFixed(1) : Math.round(value)}
          </div>
          {large && (
            <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              / {max}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Expandable({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-5 border-t border-border pt-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground transition"
      >
        <span className="flex items-center gap-1.5">
          <Gauge className="h-3.5 w-3.5" /> {label}
        </span>
        <ChevronDown
          className={"h-3.5 w-3.5 transition " + (open ? "rotate-180" : "")}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="pt-4 space-y-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-2">
        {title}
      </p>
      {children}
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={
        "rounded-xl border px-2.5 py-2 " +
        (highlight
          ? "border-ember/40 bg-ember/5"
          : "border-border bg-background/40")
      }
    >
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium truncate">{value}</p>
    </div>
  );
}

function TagRow({ items, muted }: { items: string[]; muted?: boolean }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((it) => (
        <span
          key={it}
          className={
            "rounded-full border px-2.5 py-0.5 text-[11px] " +
            (muted
              ? "border-border bg-background/40 text-muted-foreground"
              : "border-ember/30 bg-ember/5 text-ember")
          }
        >
          {it}
        </span>
      ))}
    </div>
  );
}

function SeverityChip({ severity }: { severity: "low" | "medium" | "high" }) {
  const map = {
    low: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
    medium: "border-amber-500/30 bg-amber-500/10 text-amber-400",
    high: "border-destructive/40 bg-destructive/10 text-destructive",
  } as const;
  return (
    <span
      className={
        "shrink-0 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider " +
        map[severity]
      }
    >
      {severity}
    </span>
  );
}

function DemandBadge({ demand }: { demand: "low" | "moderate" | "strong" }) {
  const map = {
    low: "border-destructive/40 bg-destructive/10 text-destructive",
    moderate: "border-amber-500/30 bg-amber-500/10 text-amber-400",
    strong: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  } as const;
  return (
    <span
      className={
        "rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider " + map[demand]
      }
    >
      {demand} demand
    </span>
  );
}

function TrendArrow({ direction }: { direction: "up" | "flat" | "down" }) {
  if (direction === "up") return <ArrowUpRight className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />;
  if (direction === "down") return <ArrowDownRight className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />;
}

/* ─────────────────────────────── Tone helpers ─────────────────────────────── */

type Tone = "green" | "amber" | "red";

function scoreTone(value: number, max: number): Tone {
  const pct = value / max;
  if (pct >= 0.7) return "green";
  if (pct >= 0.45) return "amber";
  return "red";
}

function toneClasses(t: Tone) {
  return t === "green"
    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
    : t === "amber"
      ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
      : "border-destructive/40 bg-destructive/10 text-destructive";
}

function toneStroke(t: Tone): string {
  if (t === "green") return "oklch(0.74 0.16 155)";
  if (t === "amber") return "oklch(0.78 0.16 75)";
  return "oklch(0.68 0.19 38)";
}

/* ─────────────────────────────── Suggested prompts ─────────────────────────────── */
/*
 * Reusable prompt templates. Each template is a single string with {variable}
 * placeholders that get resolved against the analysis. Templates declare which
 * variables they REQUIRE — if any required variable is missing for a given
 * report, the template is skipped automatically. This keeps the prompt library
 * easy to extend: add a new entry to PROMPT_TEMPLATES and it shows up wherever
 * its category renders, personalized to the user's report.
 */

type PromptCategory = "strategic" | "compliance" | "market" | "sales";

type TemplateVars = {
  overallScore?: string;
  weakestPillar?: string;
  topRisk?: string;
  regulation?: string;
  ipConcern?: string;
  competitor?: string;
  indirectCompetitor?: string;
  upTrend?: string;
  downTrend?: string;
  differentiator?: string;
  barrier?: string;
  targetCustomer?: string;
  recommendedPrice?: string;
  topGtm?: string;
};

type PromptTemplate = {
  id: string;
  category: PromptCategory;
  template: string;
  requires?: (keyof TemplateVars)[];
};

export const PROMPT_TEMPLATES: PromptTemplate[] = [
  // Strategic / synthesis
  {
    id: "strat-leverage",
    category: "strategic",
    template:
      "What's the single highest-leverage change to raise the {overallScore}/100 score?",
    requires: ["overallScore"],
  },
  { id: "strat-steelman", category: "strategic", template: "Steelman the case AGAINST this idea in 5 bullets." },
  { id: "strat-budget", category: "strategic", template: "If I had $25k and 90 days, what would you do first?" },
  {
    id: "strat-kill",
    category: "strategic",
    template: "What would a competitor do to kill this in 12 months?",
  },
  {
    id: "strat-weakest",
    category: "strategic",
    template: "Why is {weakestPillar} my weakest pillar — and what fixes it fastest?",
    requires: ["weakestPillar"],
  },

  // Compliance
  {
    id: "comp-derisk",
    category: "compliance",
    template: 'How do I de-risk "{topRisk}" before launch?',
    requires: ["topRisk"],
  },
  {
    id: "comp-cheapest",
    category: "compliance",
    template: "What's the cheapest path to {regulation} compliance?",
    requires: ["regulation"],
  },
  {
    id: "comp-clearance",
    category: "compliance",
    template: "Draft a clearance plan for: {ipConcern}",
    requires: ["ipConcern"],
  },
  {
    id: "comp-checklist",
    category: "compliance",
    template: "Build a pre-launch {regulation} checklist with owners and dates.",
    requires: ["regulation"],
  },
  {
    id: "comp-defer",
    category: "compliance",
    template: "Which risks could I defer past MVP without regret?",
  },

  // Market
  {
    id: "mkt-exposed",
    category: "market",
    template: "Where am I most exposed against {competitor}?",
    requires: ["competitor"],
  },
  {
    id: "mkt-wedge",
    category: "market",
    template:
      "What wedge could I take against {competitor} without starting a price war?",
    requires: ["competitor"],
  },
  {
    id: "mkt-indirect",
    category: "market",
    template: "How worried should I be about {indirectCompetitor} as an indirect substitute?",
    requires: ["indirectCompetitor"],
  },
  {
    id: "mkt-tail",
    category: "market",
    template: 'How do I ride the "{upTrend}" tailwind?',
    requires: ["upTrend"],
  },
  {
    id: "mkt-down",
    category: "market",
    template: 'What if "{downTrend}" accelerates?',
    requires: ["downTrend"],
  },
  {
    id: "mkt-moat",
    category: "market",
    template: 'How do I make "{differentiator}" defensible?',
    requires: ["differentiator"],
  },
  {
    id: "mkt-barrier",
    category: "market",
    template: 'What\'s the fastest way past the "{barrier}" barrier?',
    requires: ["barrier"],
  },
  {
    id: "mkt-bottoms",
    category: "market",
    template: "Stress-test my TAM/SAM/SOM with a bottoms-up build.",
  },

  // Sales & GTM
  {
    id: "sales-price",
    category: "sales",
    template: "Justify the {recommendedPrice} price point — or argue against it.",
    requires: ["recommendedPrice"],
  },
  {
    id: "sales-outreach",
    category: "sales",
    template: "Write 5 cold-outreach messages for {targetCustomer}.",
    requires: ["targetCustomer"],
  },
  {
    id: "sales-objections",
    category: "sales",
    template: "What objections will {targetCustomer} raise — and how do I handle each?",
    requires: ["targetCustomer"],
  },
  {
    id: "sales-plan",
    category: "sales",
    template: 'Turn "{topGtm}" into a 30-day execution plan.',
    requires: ["topGtm"],
  },
  {
    id: "sales-interviews",
    category: "sales",
    template: "Who should I talk to in my first 10 customer interviews?",
  },
  {
    id: "sales-signals",
    category: "sales",
    template: "What signals would tell me to pivot vs. push?",
  },
];

const CATEGORY_LABEL: Record<PromptCategory, string> = {
  strategic: "🎯 Strategic",
  compliance: "⚖️ Compliance",
  market: "📊 Market",
  sales: "💸 Sales & GTM",
};

export function extractTemplateVars(analysis: Analysis): TemplateVars {
  const pillars = [
    { key: "compliance", score: analysis.compliance.score, label: "Compliance" },
    { key: "market", score: analysis.market.score, label: "Market" },
    { key: "sales", score: analysis.sales.score, label: "Sales & GTM" },
  ] as const;
  const weakest = [...pillars].sort((a, b) => a.score - b.score)[0];

  const directComp = analysis.market.competitors.find((c) => c.type === "direct");
  const indirectComp = analysis.market.competitors.find((c) => c.type === "indirect");
  const upTrend = analysis.market.trends.find((t) => t.direction === "up");
  const downTrend = analysis.market.trends.find((t) => t.direction === "down");

  return {
    overallScore: String(analysis.overallScore),
    weakestPillar: weakest.label,
    topRisk: analysis.compliance.risks[0]?.title,
    regulation: analysis.compliance.regulations[0],
    ipConcern: analysis.compliance.ipConcerns[0],
    competitor: directComp?.name,
    indirectCompetitor: indirectComp?.name,
    upTrend: upTrend?.title,
    downTrend: downTrend?.title,
    differentiator: analysis.market.differentiation[0],
    barrier: analysis.market.barriers[0],
    targetCustomer: analysis.sales.targetCustomer,
    recommendedPrice: analysis.sales.pricing.recommended,
    topGtm: analysis.sales.gtm[0],
  };
}

export function renderTemplate(template: string, vars: TemplateVars): string | null {
  let missing = false;
  const out = template.replace(/\{(\w+)\}/g, (_, key: keyof TemplateVars) => {
    const v = vars[key];
    if (!v) {
      missing = true;
      return "";
    }
    return v;
  });
  return missing ? null : out;
}

type SuggestionGroup = { label: string; category: PromptCategory; items: string[] };

function buildSuggestions(
  analysis: Analysis,
  templatesOverride?: PromptTemplate[],
): SuggestionGroup[] {
  const templates = templatesOverride ?? PROMPT_TEMPLATES;
  const vars = extractTemplateVars(analysis);

  const byCategory: Record<PromptCategory, string[]> = {
    strategic: [],
    compliance: [],
    market: [],
    sales: [],
  };

  for (const t of templates) {
    const required = t.requires ?? [];
    if (required.some((k) => !vars[k])) continue;
    const filled = renderTemplate(t.template, vars);
    if (filled) byCategory[t.category].push(filled);
  }

  const order: PromptCategory[] = ["strategic", "compliance", "market", "sales"];

  // Boost the weakest pillar (after Strategic) to the top.
  const pillars: { cat: PromptCategory; score: number }[] = [
    { cat: "compliance", score: analysis.compliance.score },
    { cat: "market", score: analysis.market.score },
    { cat: "sales", score: analysis.sales.score },
  ];
  const weakest = [...pillars].sort((a, b) => a.score - b.score)[0]?.cat;
  if (weakest) {
    const idx = order.indexOf(weakest);
    if (idx > 1) {
      order.splice(idx, 1);
      order.splice(1, 0, weakest);
    }
  }

  return order
    .map((cat) => ({
      label: CATEGORY_LABEL[cat],
      category: cat,
      items: byCategory[cat].slice(0, 3),
    }))
    .filter((g) => g.items.length > 0);
}
