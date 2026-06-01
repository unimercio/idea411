import { motion } from "motion/react";
import {
  ScanSearch,
  LineChart,
  ScrollText,
  Rocket,
} from "lucide-react";

const steps = [
  {
    icon: ScanSearch,
    title: "Vet & Analyze",
    body: "Compliance flags, market viability, demand scoring — surfaced as clear risk and opportunity scores.",
    meta: "Step 01 · Intelligence",
  },
  {
    icon: ScrollText,
    title: "Patent Draft",
    body: "A US provisional patent draft — claims, abstract, description, drawings — with filing guidance.",
    meta: "Step 02 · IP",
  },
  {
    icon: Rocket,
    title: "Crowdfund Kit",
    body: "Campaign copy, reward tiers, narrative arc, and an AI-generated explainer video script.",
    meta: "Step 03 · Launch",
  },
  {
    icon: LineChart,
    title: "Track & Iterate",
    body: "A unified dashboard tracks every concept from spark to shipping, with AI suggestions inline.",
    meta: "Always-on · Insight",
  },
];

export function Flow() {
  return (
    <section id="flow" className="relative py-32">
      <div className="mx-auto max-w-7xl px-6">
        <div className="max-w-2xl">
          <p className="text-xs uppercase tracking-[0.2em] text-ember">The IdeaForge flow</p>
          <h2 className="mt-3 font-display text-4xl sm:text-5xl font-semibold text-balance">
            Four refined stages. One uninterrupted journey.
          </h2>
          <p className="mt-4 text-muted-foreground text-balance">
            Each stage is a self-contained surface — beautiful, focused, and instantly editable.
            Skip nothing. Repeat anything.
          </p>
        </div>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px overflow-hidden rounded-3xl border border-border bg-border/60">
          {steps.map((s, i) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
              className="group relative bg-card p-8 transition hover:bg-accent/40"
            >
              <div className="flex items-center justify-between">
                <span className="grid h-11 w-11 place-items-center rounded-xl border border-border bg-background/60 text-ember transition group-hover:border-ember/40 group-hover:shadow-ember">
                  <s.icon className="h-5 w-5" />
                </span>
                <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  {s.meta}
                </span>
              </div>
              <h3 className="mt-6 font-display text-xl font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{s.body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
