import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion } from "motion/react";
import {
  ArrowRight,
  Box,
  Download,
  FileText,
  Flame,
  Globe,
  Lock,
  Megaphone,
  Sparkles,
} from "lucide-react";
import { useMemo } from "react";
import { z } from "zod";
import { clearActivePlan, planUnlocks, useActivePlan, PLANS } from "@/lib/plan";
import { listProjects, getProject, type Project } from "@/lib/projects";
import { downloadDeliverable } from "@/lib/deliverables";

const searchSchema = z.object({ id: z.string().optional() });

export const Route = createFileRoute("/deliverables")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Deliverables — IdeaForge" },
      {
        name: "description",
        content: "Renders, patent draft, crowdfund kit, and pre-order page for your concept.",
      },
    ],
  }),
  component: DeliverablesPage,
});

type Item = {
  key: string;
  title: string;
  blurb: string;
  icon: typeof Box;
  preview: string;
};

const ITEMS: Item[] = [
  {
    key: "renders",
    title: "Studio renders",
    blurb: "12 photoreal product shots in your brand environment.",
    icon: Box,
    preview: "4K · PNG · CMYK-ready",
  },
  {
    key: "patent",
    title: "Provisional patent draft",
    blurb: "USPTO-ready claims, abstract, and figure descriptions.",
    icon: FileText,
    preview: "18 pages · attorney-reviewable",
  },
  {
    key: "crowdfund",
    title: "Crowdfund campaign kit",
    blurb: "Pitch video script, reward tiers, and launch sequence.",
    icon: Megaphone,
    preview: "Kickstarter + Indiegogo ready",
  },
  {
    key: "preorder",
    title: "Pre-order landing page",
    blurb: "Live, hosted page with email capture and Stripe checkout.",
    icon: Globe,
    preview: "Hosted on ideaforge.app",
  },
];

function DeliverablesPage() {
  const plan = useActivePlan();
  const unlocks = planUnlocks(plan);
  const planName = PLANS.find((p) => p.id === plan)?.name;
  const { id } = Route.useSearch();
  const project = useMemo<Project | undefined>(() => {
    if (id) return getProject(id);
    return listProjects().find((p) => p.status === "ready") ?? listProjects()[0];
  }, [id]);

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
          <div className="flex items-center gap-4 text-xs">
            {plan ? (
              <>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-ember/30 bg-ember/10 px-2.5 py-1 text-ember">
                  <Sparkles className="h-3 w-3" /> {planName} active
                </span>
                <button
                  onClick={() => clearActivePlan()}
                  className="text-muted-foreground hover:text-foreground transition"
                >
                  End plan
                </button>
              </>
            ) : (
              <Link to="/checkout" className="text-muted-foreground hover:text-foreground transition">
                Unlock →
              </Link>
            )}
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 pt-16 pb-24">
        <p className="text-xs uppercase tracking-[0.2em] text-ember">Deliverables</p>
        <h1 className="mt-3 font-display text-4xl sm:text-5xl font-semibold text-balance">
          {project ? project.title : "Your forged assets."}
        </h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          {project
            ? project.idea
            : "Everything you need to take this concept to market — renders, IP, campaign, and a live pre-order page."}
        </p>

        <div className="mt-12 grid gap-5 md:grid-cols-2">
          {ITEMS.map((item, i) => (
            <DeliverableCard
              key={item.key}
              item={item}
              index={i}
              locked={!unlocks.has(item.key)}
              project={project}
            />
          ))}
        </div>

        {!plan && <UnlockScreen />}
      </section>
    </main>
  );
}

function DeliverableCard({
  item,
  index,
  locked,
  project,
}: {
  item: Item;
  index: number;
  locked: boolean;
  project?: Project;
}) {
  const Icon = item.icon;
  const canDownload = !locked && !!project;
  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.05 + index * 0.07, ease: [0.22, 1, 0.36, 1] }}
      className={
        "relative overflow-hidden rounded-3xl border bg-card/80 p-7 transition " +
        (locked ? "border-border/60" : "border-border shadow-elegant")
      }
    >
      <div className="flex items-center justify-between">
        <span className="grid h-10 w-10 place-items-center rounded-xl border border-border bg-background/80 text-ember">
          <Icon className="h-4 w-4" />
        </span>
        {locked ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background/40 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
            <Lock className="h-3 w-3" /> Locked
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-emerald-400">
            Ready
          </span>
        )}
      </div>
      <h3 className="mt-5 font-display text-xl font-semibold">{item.title}</h3>
      <p className="mt-1.5 text-sm text-muted-foreground">{item.blurb}</p>
      <p className="mt-5 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        {item.preview}
      </p>

      {!locked && (
        <button
          onClick={() => project && downloadDeliverable(item.key, project)}
          disabled={!canDownload}
          className="mt-5 inline-flex items-center gap-1.5 text-sm text-ember hover:brightness-110 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {canDownload ? (
            <>
              Download <Download className="h-3.5 w-3.5" />
            </>
          ) : (
            <>
              No project yet <ArrowRight className="h-3.5 w-3.5" />
            </>
          )}
        </button>
      )}

      {locked && (
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/95 via-background/60 to-transparent" />
      )}
    </motion.article>
  );
}


function UnlockScreen() {
  const navigate = useNavigate();
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.3 }}
      className="mt-10 relative overflow-hidden rounded-3xl border border-ember/30 bg-gradient-surface p-10 shadow-ember"
    >
      <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-ember/40 bg-ember/10 px-2.5 py-1 text-[11px] uppercase tracking-wider text-ember">
            <Lock className="h-3 w-3" /> Locked
          </span>
          <h2 className="mt-4 font-display text-3xl font-semibold text-balance">
            Unlock the full launch kit.
          </h2>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Your vetting is free forever. Upgrade to Forge to unlock studio renders, a provisional
            patent draft, your crowdfund kit, and a live pre-order page.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row md:flex-col">
          <button
            onClick={() => navigate({ to: "/checkout", search: { plan: "forge" } })}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-ember px-5 py-2.5 text-sm font-medium text-ember-foreground shadow-ember hover:brightness-110 transition"
          >
            Unlock with Forge
            <ArrowRight className="h-4 w-4" />
          </button>
          <Link
            to="/checkout"
            className="inline-flex items-center justify-center rounded-full border border-border bg-background/60 px-5 py-2.5 text-sm hover:bg-accent transition"
          >
            Compare plans
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
