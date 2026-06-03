export const SKILL_COMPONENTS = [
  "vetting_strategic",
  "vetting_compliance",
  "vetting_market",
  "vetting_sales",
  "chat",
  "market_research",
  "intake_refine",
] as const;
export type SkillComponent = (typeof SKILL_COMPONENTS)[number];

export const COMPONENT_LABEL: Record<SkillComponent, string> = {
  vetting_strategic: "Vetting · Strategic",
  vetting_compliance: "Vetting · Compliance",
  vetting_market: "Vetting · Market",
  vetting_sales: "Vetting · Sales & GTM",
  chat: "Chat (post-report Q&A)",
  market_research: "Market research (Perplexity)",
  intake_refine: "Intake refine",
};

/**
 * Catalog of models admins can pick. Most components hit the Lovable AI
 * Gateway; `market_research` hits Perplexity, so its valid models differ.
 */
export const GATEWAY_MODELS = [
  "google/gemini-3-flash-preview",
  "google/gemini-3.5-flash",
  "google/gemini-2.5-pro",
  "google/gemini-2.5-flash",
  "google/gemini-2.5-flash-lite",
  "openai/gpt-5",
  "openai/gpt-5-mini",
  "openai/gpt-5-nano",
  "openai/gpt-5.4",
  "openai/gpt-5.4-mini",
] as const;

export const PERPLEXITY_MODELS = ["sonar-pro", "sonar"] as const;

export function modelsForComponent(component: SkillComponent): readonly string[] {
  return component === "market_research" ? PERPLEXITY_MODELS : GATEWAY_MODELS;
}
