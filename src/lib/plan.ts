// Lightweight client-side plan store. Swap for a real subscription lookup
// (Stripe customer → subscription status) once Lovable Cloud + payments are enabled.
import { useEffect, useState } from "react";

export type PlanId = "spark" | "forge" | "atelier";

export type Plan = {
  id: PlanId;
  name: string;
  price: string;
  period?: string;
  blurb: string;
  features: string[];
  unlocks: string[];
  featured?: boolean;
};

export const PLANS: Plan[] = [
  {
    id: "spark",
    name: "Spark",
    price: "Free",
    blurb: "Vet your concept. No commitment.",
    features: ["Unlimited idea intake", "Compliance & market scan", "Opportunity score"],
    unlocks: ["vetting"],
  },
  {
    id: "forge",
    name: "Forge",
    price: "$49",
    period: "/mo",
    blurb: "The full concept-to-market toolkit.",
    features: [
      "Everything in Spark",
      "Provisional patent draft",
      "Crowdfund campaign kit",
    ],
    unlocks: ["vetting", "patent", "crowdfund"],
    featured: true,
  },
  {
    id: "atelier",
    name: "Atelier",
    price: "Custom",
    blurb: "For studios shipping a portfolio of ideas.",
    features: [
      "Unlimited projects & seats",
      "White-label exports",
      "Dedicated launch strategist",
      "API access",
    ],
    unlocks: ["vetting", "patent", "crowdfund", "api", "whitelabel"],
  },
];

const KEY = "ideaforge:plan";

export function getActivePlan(): PlanId | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(KEY);
  return v === "spark" || v === "forge" || v === "atelier" ? v : null;
}

export function setActivePlan(plan: PlanId) {
  window.localStorage.setItem(KEY, plan);
  window.dispatchEvent(new StorageEvent("storage", { key: KEY }));
}

export function clearActivePlan() {
  window.localStorage.removeItem(KEY);
  window.dispatchEvent(new StorageEvent("storage", { key: KEY }));
}

export function planUnlocks(plan: PlanId | null): Set<string> {
  if (!plan) return new Set(["vetting"]); // free tier: vetting is always visible
  return new Set(PLANS.find((p) => p.id === plan)?.unlocks ?? ["vetting"]);
}

/** Reactive hook — re-renders when the plan changes (incl. cross-tab). */
export function useActivePlan() {
  const [plan, setPlan] = useState<PlanId | null>(null);
  useEffect(() => {
    setPlan(getActivePlan()); // sync on mount (SSR can't read localStorage)
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY || e.key === null) setPlan(getActivePlan());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  return plan;
}
