import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useServerFn } from "@tanstack/react-start";
import ReactMarkdown from "react-markdown";
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
} from "lucide-react";
import { z } from "zod";
import { analyzeIdea, type Analysis } from "@/lib/api/vetting.functions";
import { chatAboutIdea } from "@/lib/api/vetting-chat.functions";
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

export const Route = createFileRoute("/_authenticated/vetting")({
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
      const result = await runAnalysis({ data: { idea, sketchName } });
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
      <p className="mt-1.5 text-sm text-muted-foreground">{summary}</p>
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

  const suggestions = [
    "Why is the compliance risk where it is?",
    "How can I improve market viability?",
    "What changes would lift sales potential?",
    "Who should I talk to in the first 10 customer interviews?",
  ];

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
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="rounded-full border border-border bg-background/60 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-ember/40 transition"
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
          <div className="prose prose-sm prose-invert max-w-none prose-p:my-1.5 prose-ul:my-1.5 prose-li:my-0 prose-headings:font-display prose-strong:text-foreground">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}

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
