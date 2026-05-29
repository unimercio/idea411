import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useServerFn } from "@tanstack/react-start";
import ReactMarkdown from "react-markdown";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Copy,
  Crown,
  Download,
  Edit3,
  Film,
  Flame,
  Heart,
  Loader2,
  MessageSquare,
  RefreshCcw,
  Send,
  Sparkles,
  Tag,
  Target,
  Wand2,
  X,
  Zap,
} from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import {
  generateCampaign,
  type Campaign,
  type CampaignTier,
} from "@/lib/api/campaign.functions";
import { coachCampaign } from "@/lib/api/campaign-coach.functions";
import {
  getProject,
  updateProject,
  type ChatMessage,
  type Project,
} from "@/lib/projects";

const search = z.object({
  id: z.string().trim().min(1).max(64).optional().catch(undefined),
});

export const Route = createFileRoute("/campaign")({
  validateSearch: search,
  head: () => ({
    meta: [
      { title: "Crowdfunding campaign — IdeaForge" },
      {
        name: "description",
        content:
          "An AI-generated, conversion-optimized Kickstarter/Indiegogo campaign for your concept.",
      },
    ],
  }),
  component: CampaignPage,
});

/* ───────────────────────── Page ───────────────────────── */

function CampaignPage() {
  const { id } = Route.useSearch();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | undefined>(undefined);
  const [tone, setTone] = useState<"balanced" | "emotional" | "technical" | "playful">("balanced");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coachOpen, setCoachOpen] = useState(false);

  const run = useServerFn(generateCampaign);

  // Resolve project after mount (SSR has no localStorage).
  useEffect(() => {
    if (!id) return;
    setProject(getProject(id));
  }, [id]);

  const campaign = project?.campaign;

  const generate = async () => {
    if (!project) return;
    setError(null);
    setGenerating(true);
    try {
      const result = await run({
        data: {
          idea: project.idea,
          title: project.title,
          tone,
          analysisJson: project.analysis ? JSON.stringify(project.analysis) : undefined,
        },
      });
      const updated = updateProject(project.id, { campaign: result });
      if (updated) setProject(updated);
      toast.success("Campaign generated.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Generation failed.";
      setError(msg);
      toast.error(msg);
    } finally {
      setGenerating(false);
    }
  };

  if (!id) return <EmptyState message="No project selected. Open a vetted idea from the dashboard." />;
  if (!project) return <EmptyState message="Loading project…" />;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Header
        project={project}
        onOpenCoach={() => setCoachOpen(true)}
        coachEnabled={!!campaign}
      />

      <section className="mx-auto max-w-6xl px-6 pt-14 pb-24">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-ember">
          <Sparkles className="h-3.5 w-3.5" />
          Crowdfunding campaign
        </div>
        <h1 className="mt-3 font-display text-4xl sm:text-5xl font-semibold text-balance">
          {campaign ? campaign.recommendedTitle : project.title}
        </h1>
        <p className="mt-3 max-w-2xl text-muted-foreground text-balance">
          {campaign ? campaign.tagline : project.idea}
        </p>

        {!campaign && (
          <GeneratePanel
            tone={tone}
            setTone={setTone}
            generating={generating}
            onGenerate={generate}
            error={error}
          />
        )}

        {campaign && (
          <CampaignDashboard
            project={project}
            campaign={campaign}
            tone={tone}
            setTone={setTone}
            generating={generating}
            onRegenerate={generate}
            onUpdate={(patch) => {
              const next: Campaign = { ...campaign, ...patch };
              const updated = updateProject(project.id, { campaign: next });
              if (updated) setProject(updated);
            }}
            error={error}
          />
        )}
      </section>

      <AnimatePresence>
        {coachOpen && campaign && (
          <CoachPanel
            project={project}
            campaign={campaign}
            onClose={() => setCoachOpen(false)}
            onPersistChat={(messages) => {
              const updated = updateProject(project.id, { campaignChat: messages });
              if (updated) setProject(updated);
            }}
          />
        )}
      </AnimatePresence>
    </main>
  );
}

/* ───────────────────────── Header ───────────────────────── */

function Header({
  project,
  onOpenCoach,
  coachEnabled,
}: {
  project: Project;
  onOpenCoach: () => void;
  coachEnabled: boolean;
}) {
  return (
    <header className="border-b border-border">
      <div className="mx-auto max-w-7xl px-6 py-5 flex items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-2 font-display font-semibold">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-gradient-ember text-ember-foreground shadow-ember">
            <Flame className="h-4 w-4" />
          </span>
          IdeaForge
        </Link>
        <div className="flex items-center gap-2 text-xs">
          <Link
            to="/vetting"
            search={{ id: project.id }}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-3 py-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition"
          >
            <ArrowLeft className="h-3 w-3" />
            Vetting
          </Link>
          <button
            onClick={onOpenCoach}
            disabled={!coachEnabled}
            className="inline-flex items-center gap-1.5 rounded-full bg-gradient-ember px-3 py-1.5 text-ember-foreground shadow-ember hover:brightness-110 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <MessageSquare className="h-3 w-3" />
            Campaign Coach
          </button>
        </div>
      </div>
    </header>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <main className="min-h-screen grid place-items-center bg-background text-foreground">
      <div className="text-center px-6">
        <p className="text-muted-foreground">{message}</p>
        <Link
          to="/dashboard"
          className="mt-4 inline-flex items-center gap-1.5 text-sm text-ember hover:brightness-110"
        >
          Back to dashboard
        </Link>
      </div>
    </main>
  );
}

/* ───────────────────────── Generate panel ───────────────────────── */

const TONES: { id: "balanced" | "emotional" | "technical" | "playful"; label: string; hint: string }[] = [
  { id: "balanced", label: "Balanced", hint: "Default — credible & persuasive" },
  { id: "emotional", label: "Emotional", hint: "Lean into story & feeling" },
  { id: "technical", label: "Technical", hint: "Specs, proof, precision" },
  { id: "playful", label: "Playful", hint: "Energetic, fun, irreverent" },
];

function GeneratePanel({
  tone,
  setTone,
  generating,
  onGenerate,
  error,
}: {
  tone: "balanced" | "emotional" | "technical" | "playful";
  setTone: (t: "balanced" | "emotional" | "technical" | "playful") => void;
  generating: boolean;
  onGenerate: () => void;
  error: string | null;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="mt-12 relative overflow-hidden rounded-3xl border border-ember/30 bg-gradient-surface p-10 shadow-elegant"
    >
      <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <h2 className="font-display text-3xl font-semibold text-balance">
            Forge a launch-ready campaign.
          </h2>
          <p className="mt-3 max-w-xl text-sm text-muted-foreground">
            Titles, story, tiers, and a 60–90s video script — generated from your vetted idea
            and tuned to your tone of voice.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {TONES.map((t) => (
              <button
                key={t.id}
                onClick={() => setTone(t.id)}
                className={
                  "rounded-full border px-3 py-1.5 text-xs transition " +
                  (tone === t.id
                    ? "border-ember bg-ember/15 text-ember"
                    : "border-border bg-background/60 text-muted-foreground hover:text-foreground")
                }
                title={t.hint}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <button
            onClick={onGenerate}
            disabled={generating}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-ember px-6 py-3 text-sm font-medium text-ember-foreground shadow-ember hover:brightness-110 transition disabled:opacity-60"
          >
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Forging campaign…
              </>
            ) : (
              <>
                <Wand2 className="h-4 w-4" />
                Generate campaign
              </>
            )}
          </button>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      </div>
    </motion.div>
  );
}

/* ───────────────────────── Dashboard ───────────────────────── */

function CampaignDashboard({
  project,
  campaign,
  tone,
  setTone,
  generating,
  onRegenerate,
  onUpdate,
  error,
}: {
  project: Project;
  campaign: Campaign;
  tone: "balanced" | "emotional" | "technical" | "playful";
  setTone: (t: "balanced" | "emotional" | "technical" | "playful") => void;
  generating: boolean;
  onRegenerate: () => void;
  onUpdate: (patch: Partial<Campaign>) => void;
  error: string | null;
}) {
  return (
    <div className="mt-12 grid gap-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card/60 px-5 py-3">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Tone:</span>
          {TONES.map((t) => (
            <button
              key={t.id}
              onClick={() => setTone(t.id)}
              className={
                "rounded-full border px-2.5 py-1 transition " +
                (tone === t.id
                  ? "border-ember bg-ember/15 text-ember"
                  : "border-border text-muted-foreground hover:text-foreground")
              }
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onRegenerate}
            disabled={generating}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-3 py-1.5 text-xs hover:bg-accent transition disabled:opacity-50"
          >
            {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCcw className="h-3 w-3" />}
            Regenerate
          </button>
          <ExportMenu project={project} campaign={campaign} />
        </div>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}

      {/* Title options */}
      <Section icon={<Tag className="h-4 w-4" />} title="Campaign titles" subtitle="Pick your hero headline">
        <div className="grid gap-2">
          {campaign.titleOptions.map((t) => {
            const active = t === campaign.recommendedTitle;
            return (
              <button
                key={t}
                onClick={() => onUpdate({ recommendedTitle: t })}
                className={
                  "group flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition " +
                  (active
                    ? "border-ember/60 bg-ember/10"
                    : "border-border bg-background/40 hover:border-border/80 hover:bg-accent/40")
                }
              >
                <span className="font-display text-base">{t}</span>
                {active ? (
                  <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-ember">
                    <CheckCircle2 className="h-3 w-3" />
                    Selected
                  </span>
                ) : (
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground opacity-0 group-hover:opacity-100 transition">
                    Use this
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <EditableField
          label="Tagline"
          value={campaign.tagline}
          onChange={(v) => onUpdate({ tagline: v })}
          multiline
        />
        <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
          <div className="rounded-xl border border-border bg-background/40 p-3">
            <p className="uppercase tracking-wider text-muted-foreground text-[10px]">Category</p>
            <p className="mt-1">{campaign.category}</p>
          </div>
          <div className="rounded-xl border border-border bg-background/40 p-3">
            <p className="uppercase tracking-wider text-muted-foreground text-[10px]">Funding goal</p>
            <p className="mt-1 text-ember font-medium">{campaign.fundingGoal}</p>
          </div>
        </div>
      </Section>

      {/* Description */}
      <Section icon={<Target className="h-4 w-4" />} title="Description" subtitle="Problem → Solution → Why now">
        <div className="grid gap-4">
          <EditableField label="Problem" value={campaign.description.problem} multiline
            onChange={(v) => onUpdate({ description: { ...campaign.description, problem: v } })} />
          <EditableField label="Solution" value={campaign.description.solution} multiline
            onChange={(v) => onUpdate({ description: { ...campaign.description, solution: v } })} />
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Features</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {campaign.description.features.map((f, i) => (
                <div key={i} className="rounded-2xl border border-border bg-background/40 p-4">
                  <p className="font-display text-sm font-medium">{f.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{f.detail}</p>
                </div>
              ))}
            </div>
          </div>
          <EditableField label="Why now" value={campaign.description.whyNow} multiline
            onChange={(v) => onUpdate({ description: { ...campaign.description, whyNow: v } })} />
          {campaign.description.socialImpact && (
            <EditableField label="Social impact" value={campaign.description.socialImpact} multiline
              onChange={(v) => onUpdate({ description: { ...campaign.description, socialImpact: v } })} />
          )}
          {campaign.description.seoKeywords.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {campaign.description.seoKeywords.map((k) => (
                <span key={k} className="rounded-full border border-border bg-background/40 px-2 py-0.5 text-[10px] text-muted-foreground">
                  #{k}
                </span>
              ))}
            </div>
          )}
        </div>
      </Section>

      {/* Tiers */}
      <Section icon={<Crown className="h-4 w-4" />} title="Reward tiers" subtitle="Pricing, scarcity & value">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {campaign.tiers.map((tier, i) => (
            <TierCard key={i} tier={tier} index={i} />
          ))}
        </div>
      </Section>

      {/* Story */}
      <Section icon={<Heart className="h-4 w-4" />} title="Story narrative" subtitle="Founder, journey, vision">
        <div className="grid gap-4">
          <EditableField label="Founder story" value={campaign.story.founderStory} multiline
            onChange={(v) => onUpdate({ story: { ...campaign.story, founderStory: v } })} />
          <EditableField label="Product journey" value={campaign.story.productJourney} multiline
            onChange={(v) => onUpdate({ story: { ...campaign.story, productJourney: v } })} />
          <EditableField label="Vision" value={campaign.story.vision} multiline
            onChange={(v) => onUpdate({ story: { ...campaign.story, vision: v } })} />
        </div>
      </Section>

      {/* Video */}
      <Section icon={<Film className="h-4 w-4" />} title="Explainer video" subtitle="Script · shots · AI prompts">
        <div className="grid gap-3 text-xs sm:grid-cols-3">
          <Pill label="Title" value={campaign.video.title} />
          <Pill label="Duration" value={campaign.video.totalDuration} />
          <Pill label="Tone" value={campaign.video.tone} />
        </div>
        <div className="mt-5">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Scene-by-scene</p>
          <div className="overflow-hidden rounded-2xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-background/60 text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-2 font-normal">Scene</th>
                  <th className="text-left px-4 py-2 font-normal">Visual</th>
                  <th className="text-left px-4 py-2 font-normal">Voiceover</th>
                </tr>
              </thead>
              <tbody>
                {campaign.video.scenes.map((s, i) => (
                  <tr key={i} className="border-t border-border/60">
                    <td className="px-4 py-3 align-top">
                      <p className="font-medium">{s.scene}</p>
                      <p className="text-[11px] text-muted-foreground">{s.duration}</p>
                    </td>
                    <td className="px-4 py-3 align-top text-muted-foreground">{s.visual}</td>
                    <td className="px-4 py-3 align-top italic text-foreground/90">"{s.voiceover}"</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <EditableField label="Full narration" value={campaign.video.fullNarration} multiline
          onChange={(v) => onUpdate({ video: { ...campaign.video, fullNarration: v } })} />
        <ListCollapsible title="Shot list" items={campaign.video.shotList} />
        <ListCollapsible title="AI video prompts (Runway / Kling / Luma)" items={campaign.video.aiPrompts} copyable />
      </Section>

      {/* CTA */}
      <Section icon={<Zap className="h-4 w-4" />} title="Closing CTA">
        <EditableField label="Call to action" value={campaign.cta} multiline
          onChange={(v) => onUpdate({ cta: v })} />
      </Section>
    </div>
  );
}

/* ───────────────────────── Building blocks ───────────────────────── */

function Section({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-3xl border border-border bg-card/60 p-7 shadow-elegant"
    >
      <header className="flex items-center justify-between gap-4 mb-5">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl border border-border bg-background/80 text-ember">
            {icon}
          </span>
          <div>
            <h2 className="font-display text-lg font-semibold">{title}</h2>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
      </header>
      <div className="grid gap-4">{children}</div>
    </motion.section>
  );
}

function Pill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background/40 p-3">
      <p className="uppercase tracking-wider text-muted-foreground text-[10px]">{label}</p>
      <p className="mt-1 text-sm">{value}</p>
    </div>
  );
}

function EditableField({
  label,
  value,
  onChange,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  multiline?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  return (
    <div className="rounded-2xl border border-border bg-background/40 p-4">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
        {onChange && (
          <button
            onClick={() => {
              if (editing) {
                onChange(draft);
                toast.success(`${label} updated.`);
              }
              setEditing(!editing);
            }}
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-ember transition"
          >
            {editing ? <CheckCircle2 className="h-3 w-3" /> : <Edit3 className="h-3 w-3" />}
            {editing ? "Save" : "Edit"}
          </button>
        )}
      </div>
      {editing && onChange ? (
        multiline ? (
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={5}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ember"
          />
        ) : (
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ember"
          />
        )
      ) : (
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{value}</p>
      )}
    </div>
  );
}

function TierCard({ tier, index }: { tier: CampaignTier; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.04 }}
      className={
        "relative overflow-hidden rounded-3xl border p-5 " +
        (tier.earlyBird
          ? "border-ember/50 bg-gradient-to-br from-ember/10 to-transparent"
          : tier.limited
            ? "border-purple-500/30 bg-purple-500/5"
            : "border-border bg-background/40")
      }
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          {tier.earlyBird ? "Early bird" : tier.limited ? "Limited" : "Tier"}
        </span>
        {tier.limited && tier.limitedCount && (
          <span className="text-[10px] text-purple-300">
            {tier.limitedCount} only
          </span>
        )}
      </div>
      <h3 className="mt-2 font-display text-lg font-semibold">{tier.name}</h3>
      <p className="text-xs text-muted-foreground">{tier.tagline}</p>
      <p className="mt-3 font-display text-3xl text-ember">{tier.price}</p>
      <p className="text-[11px] text-muted-foreground">{tier.perceivedValue}</p>
      <ul className="mt-4 space-y-1.5 text-xs">
        {tier.contents.map((c, i) => (
          <li key={i} className="flex gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 text-ember flex-shrink-0" />
            <span>{c}</span>
          </li>
        ))}
      </ul>
      <div className="mt-4 pt-3 border-t border-border/60 grid grid-cols-2 gap-2 text-[10px] text-muted-foreground">
        <span>Ships: {tier.estShipping}</span>
        <span className="text-right">Delivers: {tier.delivery}</span>
      </div>
    </motion.div>
  );
}

function ListCollapsible({
  title,
  items,
  copyable = false,
}: {
  title: string;
  items: string[];
  copyable?: boolean;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="rounded-2xl border border-border bg-background/40">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3"
      >
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{title}</span>
        <ChevronDown className={"h-4 w-4 text-muted-foreground transition " + (open ? "rotate-180" : "")} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <ul className="px-4 pb-4 space-y-2 text-sm">
              {items.map((item, i) => (
                <li key={i} className="flex items-start gap-2 group">
                  <span className="text-ember text-xs mt-1">▸</span>
                  <span className="flex-1">{item}</span>
                  {copyable && (
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(item);
                        toast.success("Copied prompt.");
                      }}
                      className="opacity-0 group-hover:opacity-100 transition text-muted-foreground hover:text-ember"
                      title="Copy"
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ───────────────────────── Export ───────────────────────── */

function ExportMenu({ project, campaign }: { project: Project; campaign: Campaign }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 rounded-full bg-gradient-ember px-3 py-1.5 text-xs text-ember-foreground shadow-ember hover:brightness-110 transition"
      >
        <Download className="h-3 w-3" />
        Export
        <ChevronDown className="h-3 w-3" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute right-0 mt-2 w-52 rounded-2xl border border-border bg-popover shadow-elegant overflow-hidden z-20"
          >
            <ExportItem label="Markdown (.md)" onClick={() => { exportMarkdown(project, campaign); setOpen(false); }} />
            <ExportItem label="JSON (.json)" onClick={() => { exportJson(project, campaign); setOpen(false); }} />
            <ExportItem label="HTML mockup (.html)" onClick={() => { exportHtml(project, campaign); setOpen(false); }} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ExportItem({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-4 py-2.5 text-xs hover:bg-accent transition"
    >
      {label}
    </button>
  );
}

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "campaign";
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportJson(project: Project, c: Campaign) {
  saveBlob(new Blob([JSON.stringify(c, null, 2)], { type: "application/json" }), `${slug(project.title)}-campaign.json`);
}

function exportMarkdown(project: Project, c: Campaign) {
  const md = `# ${c.recommendedTitle}
> ${c.tagline}

**Category:** ${c.category}  ·  **Funding goal:** ${c.fundingGoal}

## Title options
${c.titleOptions.map((t) => `- ${t === c.recommendedTitle ? `**${t}** ★` : t}`).join("\n")}

## Description
### Problem
${c.description.problem}

### Solution
${c.description.solution}

### Features
${c.description.features.map((f) => `- **${f.title}** — ${f.detail}`).join("\n")}

### Why now
${c.description.whyNow}
${c.description.socialImpact ? `\n### Social impact\n${c.description.socialImpact}\n` : ""}
**SEO keywords:** ${c.description.seoKeywords.join(", ")}

## Reward tiers
${c.tiers
  .map(
    (t) => `### ${t.name} — ${t.price}${t.earlyBird ? " (Early bird)" : ""}${t.limited ? ` (Limited${t.limitedCount ? ` · ${t.limitedCount}` : ""})` : ""}
*${t.tagline}*

${t.contents.map((x) => `- ${x}`).join("\n")}

- Perceived value: ${t.perceivedValue}
- Ships: ${t.estShipping}
- Delivers: ${t.delivery}`,
  )
  .join("\n\n")}

## Story
### Founder
${c.story.founderStory}

### Product journey
${c.story.productJourney}

### Vision
${c.story.vision}

## Video — ${c.video.title} (${c.video.totalDuration}, ${c.video.tone})
${c.video.scenes
  .map((s) => `### ${s.scene} · ${s.duration}\n**Visual:** ${s.visual}\n\n**VO:** "${s.voiceover}"`)
  .join("\n\n")}

### Full narration
${c.video.fullNarration}

### Shot list
${c.video.shotList.map((s) => `- ${s}`).join("\n")}

### AI video prompts
${c.video.aiPrompts.map((p) => `- ${p}`).join("\n")}

## Call to action
${c.cta}
`;
  saveBlob(new Blob([md], { type: "text/markdown;charset=utf-8" }), `${slug(project.title)}-campaign.md`);
}

function exportHtml(project: Project, c: Campaign) {
  const esc = (s: string) =>
    s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]!));
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${esc(c.recommendedTitle)}</title>
<style>
:root{color-scheme:dark}*{box-sizing:border-box}
body{margin:0;font-family:Inter,system-ui,sans-serif;background:#1a1a1a;color:#f5f5f5;line-height:1.55}
.wrap{max-width:980px;margin:0 auto;padding:64px 24px}
.badge{display:inline-block;padding:6px 12px;border-radius:999px;background:rgba(232,93,58,.12);color:#e85d3a;font-size:11px;letter-spacing:.2em;text-transform:uppercase}
h1{font-size:clamp(40px,6vw,68px);margin:18px 0 10px;letter-spacing:-.02em}
.lead{font-size:20px;color:#c8c8c8;max-width:680px}
.meta{display:flex;gap:24px;margin-top:24px;color:#a0a0a0;font-size:13px}
h2{margin-top:56px;font-size:28px;letter-spacing:-.01em}
.grid{display:grid;gap:16px;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));margin-top:16px}
.tier{border:1px solid #333;border-radius:18px;padding:20px;background:#222}
.tier.eb{border-color:rgba(232,93,58,.5);background:linear-gradient(135deg,rgba(232,93,58,.1),transparent)}
.tier h3{margin:0 0 4px;font-size:18px}
.tier .price{font-size:30px;color:#e85d3a;margin:10px 0 4px}
.tier ul{padding-left:18px;font-size:13px;color:#c0c0c0}
.scene{border-top:1px solid #2a2a2a;padding:14px 0}
.scene b{color:#e85d3a}
footer{margin-top:80px;color:#707070;font-size:12px}
</style></head><body><main class="wrap">
<span class="badge">Campaign preview</span>
<h1>${esc(c.recommendedTitle)}</h1>
<p class="lead">${esc(c.tagline)}</p>
<div class="meta"><span>📂 ${esc(c.category)}</span><span>🎯 Goal: ${esc(c.fundingGoal)}</span></div>

<h2>The problem</h2><p>${esc(c.description.problem)}</p>
<h2>Our solution</h2><p>${esc(c.description.solution)}</p>

<h2>Reward tiers</h2><div class="grid">
${c.tiers
  .map(
    (t) => `<div class="tier ${t.earlyBird ? "eb" : ""}"><h3>${esc(t.name)}</h3>
<div style="font-size:11px;color:#888">${esc(t.tagline)}</div>
<div class="price">${esc(t.price)}</div>
<div style="font-size:11px;color:#888">${esc(t.perceivedValue)}</div>
<ul>${t.contents.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
<div style="font-size:11px;color:#888;border-top:1px solid #2a2a2a;padding-top:10px;margin-top:10px">Ships ${esc(t.estShipping)} · Delivers ${esc(t.delivery)}</div></div>`,
  )
  .join("")}
</div>

<h2>Our story</h2><p>${esc(c.story.founderStory)}</p><p>${esc(c.story.productJourney)}</p><p><em>${esc(c.story.vision)}</em></p>

<h2>${esc(c.video.title)} — ${esc(c.video.totalDuration)}</h2>
${c.video.scenes.map((s) => `<div class="scene"><b>${esc(s.scene)}</b> · ${esc(s.duration)}<br/><span style="color:#a0a0a0">${esc(s.visual)}</span><br/><em>"${esc(s.voiceover)}"</em></div>`).join("")}

<h2>${esc(c.cta)}</h2>
<footer>Forged with IdeaForge · ${new Date(project.updatedAt).toLocaleDateString()}</footer>
</main></body></html>`;
  saveBlob(new Blob([html], { type: "text/html;charset=utf-8" }), `${slug(project.title)}-campaign.html`);
}

/* ───────────────────────── Coach panel ───────────────────────── */

function CoachPanel({
  project,
  campaign,
  onClose,
  onPersistChat,
}: {
  project: Project;
  campaign: Campaign;
  onClose: () => void;
  onPersistChat: (m: ChatMessage[]) => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(project.campaignChat ?? []);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const ask = useServerFn(coachCampaign);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || pending) return;
    const next: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages(next);
    setInput("");
    setPending(true);
    try {
      const { reply } = await ask({ data: { idea: project.idea, campaign, messages: next } });
      const after: ChatMessage[] = [...next, { role: "assistant", content: reply }];
      setMessages(after);
      onPersistChat(after);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Coach failed.";
      toast.error(msg);
      setMessages(messages);
    } finally {
      setPending(false);
    }
  };

  const suggestions = useMemo(
    () => [
      "Make the story more emotional",
      "Improve the early bird tier",
      "Strengthen the call-to-action",
      "Suggest 3 better video hooks",
    ],
    [],
  );

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm"
      />
      <motion.aside
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 240 }}
        className="fixed right-0 top-0 z-50 h-full w-full max-w-md bg-card border-l border-border shadow-elegant flex flex-col"
      >
        <header className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-gradient-ember text-ember-foreground shadow-ember">
              <MessageSquare className="h-3.5 w-3.5" />
            </span>
            <div>
              <p className="font-display text-sm font-semibold">Campaign Coach</p>
              <p className="text-[10px] text-muted-foreground">Knows your full campaign</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Ask anything about your campaign. I can rewrite, restructure, or A/B test.
              </p>
              <div className="grid gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="text-left text-xs rounded-xl border border-border bg-background/60 px-3 py-2 hover:border-ember/40 hover:bg-accent transition"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={
                "rounded-2xl px-4 py-3 text-sm " +
                (m.role === "user"
                  ? "bg-ember/15 border border-ember/30 ml-6"
                  : "bg-background/60 border border-border mr-6")
              }
            >
              <div className="prose prose-sm prose-invert max-w-none">
                <ReactMarkdown>{m.content}</ReactMarkdown>
              </div>
            </div>
          ))}
          {pending && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Coach is thinking…
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="border-t border-border p-3 flex gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask the coach…"
            className="flex-1 rounded-full border border-border bg-background px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ember"
          />
          <button
            type="submit"
            disabled={pending || !input.trim()}
            className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gradient-ember text-ember-foreground shadow-ember hover:brightness-110 transition disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </form>
      </motion.aside>
    </>
  );
}
