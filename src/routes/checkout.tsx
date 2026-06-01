import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "motion/react";
import { ArrowRight, Check, Flame, Lock, ShieldCheck } from "lucide-react";
import { z } from "zod";
import { PLANS, setActivePlan, type PlanId } from "@/lib/plan";

const search = z.object({
  plan: z.enum(["spark", "forge", "atelier"]).optional().catch(undefined),
  next: z.string().max(200).optional().catch(undefined),
});

export const Route = createFileRoute("/checkout")({
  validateSearch: search,
  head: () => ({
    meta: [
      { title: "Checkout — IdeaForge" },
      { name: "description", content: "Unlock provisional patent drafts and crowdfund campaign kits." },
    ],
  }),
  component: CheckoutPage,
});

function CheckoutPage() {
  const { plan: preselect, next } = Route.useSearch();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<PlanId>(preselect ?? "forge");
  const [submitting, setSubmitting] = useState(false);

  const plan = PLANS.find((p) => p.id === selected)!;

  const confirm = async () => {
    setSubmitting(true);
    // Placeholder — wire to a Stripe Checkout session once payments are enabled.
    await new Promise((r) => setTimeout(r, 700));
    setActivePlan(selected);
    navigate({ to: next ?? "/deliverables" });
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
          <span className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-ember" /> Secure checkout
          </span>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-16 grid gap-10 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-ember">Choose your plan</p>
          <h1 className="mt-3 font-display text-4xl sm:text-5xl font-semibold text-balance">
            Unlock the full forge.
          </h1>
          <p className="mt-3 max-w-xl text-muted-foreground">
            Pick a tier to unlock renders, provisional patent drafts, crowdfund kits, and a live
            pre-order page for every project you ship.
          </p>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {PLANS.map((p) => {
              const active = selected === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelected(p.id)}
                  className={
                    "relative text-left rounded-3xl border p-6 transition " +
                    (active
                      ? "border-ember/50 bg-gradient-surface shadow-ember"
                      : "border-border bg-card hover:border-border/80")
                  }
                >
                  {p.featured && (
                    <span className="absolute -top-3 left-6 rounded-full bg-gradient-ember px-3 py-1 text-[10px] font-medium uppercase tracking-[0.15em] text-ember-foreground">
                      Most chosen
                    </span>
                  )}
                  <p className="font-display text-lg font-semibold">{p.name}</p>
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="font-display text-3xl font-semibold">{p.price}</span>
                    {p.period && <span className="text-xs text-muted-foreground">{p.period}</span>}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{p.blurb}</p>
                  <ul className="mt-4 space-y-1.5 text-xs">
                    {p.features.slice(0, 4).map((f) => (
                      <li key={f} className="flex items-start gap-2 text-muted-foreground">
                        <Check className="mt-0.5 h-3.5 w-3.5 text-ember shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <span
                    className={
                      "mt-5 inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider " +
                      (active ? "text-ember" : "text-muted-foreground")
                    }
                  >
                    {active ? "Selected" : "Select"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <motion.aside
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="lg:sticky lg:top-10 h-fit rounded-3xl border border-border bg-card/80 p-7 shadow-elegant"
        >
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Order summary</p>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="font-display text-lg font-semibold">{plan.name}</span>
            <span className="font-display text-2xl font-semibold">
              {plan.price}
              <span className="ml-1 text-xs text-muted-foreground">{plan.period}</span>
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{plan.blurb}</p>

          <div className="my-6 h-px bg-border" />

          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">You unlock</p>
          <ul className="mt-3 space-y-2 text-sm">
            {plan.features.map((f) => (
              <li key={f} className="flex items-start gap-2.5">
                <Check className="mt-0.5 h-4 w-4 text-ember shrink-0" />
                <span className="text-muted-foreground">{f}</span>
              </li>
            ))}
          </ul>

          <button
            onClick={confirm}
            disabled={submitting}
            className="mt-7 w-full inline-flex items-center justify-center gap-2 rounded-full bg-gradient-ember px-5 py-3 text-sm font-medium text-ember-foreground shadow-ember hover:brightness-110 transition disabled:opacity-60"
          >
            {submitting ? "Activating…" : plan.id === "atelier" ? "Talk to sales" : `Start ${plan.name} plan`}
            <ArrowRight className="h-4 w-4" />
          </button>
          <p className="mt-3 text-center text-[11px] text-muted-foreground inline-flex items-center justify-center gap-1.5 w-full">
            <Lock className="h-3 w-3" /> Mock checkout · enable Stripe to charge real cards
          </p>
        </motion.aside>
      </section>
    </main>
  );
}
