import { Check } from "lucide-react";
import { Link } from "@tanstack/react-router";

const tiers = [
  {
    name: "Spark",
    price: "Free",
    blurb: "Vet your concept. No commitment.",
    features: ["Unlimited idea intake", "Compliance & market scan", "Opportunity score"],
    cta: "Start free",
    to: "/intake",
    featured: true,
  },
  {
    name: "Atelier",
    price: "Custom",
    blurb: "For studios shipping a portfolio of ideas.",
    features: ["Unlimited projects & seats", "Dedicated launch strategist", "API access", "Priority support"],
    cta: "Talk to us",
    to: "/contact",
    featured: false,
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="relative py-32">
      <div className="mx-auto max-w-7xl px-6">
        <div className="max-w-2xl">
          <p className="text-xs uppercase tracking-[0.2em] text-ember">Pricing</p>
          <h2 className="mt-3 font-display text-4xl sm:text-5xl font-semibold text-balance">
            Built to scale with every spark.
          </h2>
        </div>
        <div className="mt-14 grid md:grid-cols-2 gap-4">
          {tiers.map((t) => (
            <div
              key={t.name}
              className={
                "relative rounded-3xl border p-8 transition " +
                (t.featured
                  ? "border-ember/40 bg-gradient-surface shadow-ember"
                  : "border-border bg-card hover:border-border/80")
              }
            >
              {t.featured && (
                <span className="absolute -top-3 left-8 rounded-full bg-gradient-ember px-3 py-1 text-[10px] font-medium uppercase tracking-[0.15em] text-ember-foreground">
                  Most chosen
                </span>
              )}
              <p className="font-display text-lg font-semibold">{t.name}</p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="font-display text-4xl font-semibold">{t.price}</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{t.blurb}</p>
              <ul className="mt-6 space-y-3 text-sm">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    <Check className="mt-0.5 h-4 w-4 text-ember shrink-0" />
                    <span className="text-muted-foreground">{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                to={t.to}
                search={(t as { search?: Record<string, string> }).search}
                className={
                  "mt-8 block text-center w-full rounded-full px-4 py-2.5 text-sm font-medium transition " +
                  (t.featured
                    ? "bg-gradient-ember text-ember-foreground shadow-ember hover:brightness-110"
                    : "border border-border bg-background/60 hover:bg-accent")
                }
              >
                {t.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
