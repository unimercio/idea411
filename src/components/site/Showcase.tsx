import { motion } from "motion/react";
import { Check, AlertTriangle, TrendingUp } from "lucide-react";

export function Showcase() {
  return (
    <section id="showcase" className="relative py-32">
      <div className="mx-auto max-w-7xl px-6 grid lg:grid-cols-2 gap-16 items-center">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-ember">Live vetting dashboard</p>
          <h2 className="mt-3 font-display text-4xl sm:text-5xl font-semibold text-balance">
            See your idea, scored and refined — in seconds.
          </h2>
          <p className="mt-4 text-muted-foreground text-balance">
            Risk, opportunity, pricing, and competitive position — distilled into a single,
            actionable surface. Iterate inline. Re-score instantly.
          </p>
          <ul className="mt-8 space-y-3 text-sm">
            {[
              "Regulatory red flags surfaced before you spend a dollar",
              "Competitor landscape mapped against your differentiation",
              "Suggested price bands tied to elasticity modeling",
            ].map((t) => (
              <li key={t} className="flex items-start gap-3">
                <span className="mt-0.5 grid h-5 w-5 place-items-center rounded-full bg-ember/15 text-ember">
                  <Check className="h-3 w-3" />
                </span>
                <span className="text-muted-foreground">{t}</span>
              </li>
            ))}
          </ul>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="relative rounded-3xl border border-border bg-gradient-surface p-6 shadow-elegant"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Project · Helios Cookware</p>
              <h3 className="font-display text-xl font-semibold mt-1">Vetting summary</h3>
            </div>
            <span className="rounded-full bg-ember/15 px-3 py-1 text-xs text-ember">Promising</span>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-3">
            <ScoreCard label="Compliance" value={82} tone="ok" />
            <ScoreCard label="Market fit" value={74} tone="ok" />
            <ScoreCard label="Demand" value={91} tone="hot" />
          </div>

          <div className="mt-6 space-y-3">
            <Insight
              icon={<TrendingUp className="h-4 w-4 text-ember" />}
              title="Demand signal is strong in NA + EU"
              body="Search interest up 38% YoY in the heat-retention cookware category."
            />
            <Insight
              icon={<AlertTriangle className="h-4 w-4 text-ember" />}
              title="Material disclosure required"
              body="Lead-free ceramic glaze certification needed before US retail launch."
            />
          </div>

          <div className="mt-6 flex items-center justify-between rounded-2xl border border-border bg-background/50 p-4">
            <div>
              <p className="text-xs text-muted-foreground">Suggested launch price</p>
              <p className="font-display text-2xl font-semibold">$189 – $229</p>
            </div>
            <button className="rounded-full bg-gradient-ember px-4 py-2 text-sm font-medium text-ember-foreground shadow-ember hover:brightness-110 transition">
              Unlock full package
            </button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function ScoreCard({ label, value, tone }: { label: string; value: number; tone: "ok" | "hot" }) {
  return (
    <div className="rounded-2xl border border-border bg-background/50 p-4">
      <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-2xl font-semibold">{value}</p>
      <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-border">
        <div
          className={tone === "hot" ? "h-full bg-gradient-ember" : "h-full bg-foreground/70"}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

function Insight({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-border bg-background/40 p-4">
      <span className="mt-0.5">{icon}</span>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{body}</p>
      </div>
    </div>
  );
}
