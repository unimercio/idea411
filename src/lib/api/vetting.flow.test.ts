import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock the admin Supabase client BEFORE importing modules that use it.
// `resolveSkill` calls `supabaseAdmin.from('model_skills').select(...).eq(...).eq(...).eq(...).maybeSingle()`.
const skillRows: Record<string, { id: string; name: string; model: string; system_preamble: string }> = {
  vetting_strategic: {
    id: "s1",
    name: "Default Strategic Analyst",
    model: "google/gemini-2.5-pro",
    system_preamble: "STRATEGIC_PREAMBLE_MARKER",
  },
  vetting_compliance: {
    id: "s2",
    name: "Default Compliance Reviewer",
    model: "openai/gpt-5-mini",
    system_preamble: "COMPLIANCE_PREAMBLE_MARKER",
  },
  vetting_market: {
    id: "s3",
    name: "Default Market Analyst",
    model: "google/gemini-2.5-pro",
    system_preamble: "MARKET_PREAMBLE_MARKER",
  },
  vetting_sales: {
    id: "s4",
    name: "Default GTM & Sales Strategist",
    model: "openai/gpt-5-mini",
    system_preamble: "SALES_PREAMBLE_MARKER",
  },
  intake_refine: {
    id: "s5",
    name: "Default Intake Refiner",
    model: "google/gemini-2.5-flash",
    system_preamble: "INTAKE_PREAMBLE_MARKER",
  },
};

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      expect(table).toBe("model_skills");
      let component: string | null = null;
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: (col: string, val: string) => {
          if (col === "component") component = val;
          return chain;
        },
        maybeSingle: async () => ({
          data: component ? (skillRows[component] ?? null) : null,
          error: null,
        }),
      };
      return chain;
    },
  },
}));

// Fixture responses keyed by tool name. The handlers call the Lovable AI
// gateway with a tool_choice; we route the response based on which tool
// was requested so each pillar parses successfully.
type GatewayRequest = { model: string; system: string; tool: string };
const captured: GatewayRequest[] = [];

const toolResponse: Record<string, unknown> = {
  submit_strategic_summary: {
    overallScore: 72,
    healthVerdict: "Solid premise with a clear wedge.",
    oneLineThesis: "Heat-retention cookware for serious home cooks.",
  },
  submit_compliance_review: {
    score: 8,
    summary: "Few blockers.",
    risks: [{ title: "Prop 65", severity: "low", detail: "Ceramic glazes." }],
    regulations: ["FDA 21 CFR 175"],
    ipConcerns: ["Le Creuset trade dress"],
  },
  submit_market_analysis: {
    score: 7,
    summary: "Premium cookware is crowded but growing.",
    tam: "$8B",
    sam: "$1.2B",
    som: "$30M",
    competitors: [{ name: "Le Creuset", type: "direct", note: "Brand moat." }],
    trends: [{ title: "Heat retention", direction: "up", note: "Searches rising." }],
    barriers: ["Manufacturing capex"],
    differentiation: ["Modular system"],
  },
  submit_sales_analysis: {
    score: 7,
    summary: "DTC + specialty retail.",
    demand: "moderate",
    pricing: { low: "$120", mid: "$220", premium: "$380", recommended: "$220" },
    revenue: { conservative: "$200k", moderate: "$800k", optimistic: "$2M" },
    targetCustomer: "Home cooks 30-55, HHI $120k+.",
    gtm: ["Kickstarter", "Williams-Sonoma pilot"],
  },
  submit_refined_idea: {
    refined: "A modular ceramic cookware set that retains heat 3x longer than cast iron, for serious home cooks.",
    question: "What price point are you targeting?",
  },
};

beforeEach(() => {
  captured.length = 0;
  process.env.LOVABLE_API_KEY = "test-key";

  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string) as {
        model: string;
        messages: { role: string; content: string }[];
        tool_choice: { function: { name: string } };
      };
      const toolName = body.tool_choice.function.name;
      const system = body.messages.find((m) => m.role === "system")?.content ?? "";
      captured.push({ model: body.model, system, tool: toolName });

      const fixture = toolResponse[toolName];
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                tool_calls: [
                  { function: { name: toolName, arguments: JSON.stringify(fixture) } },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }),
  );
});

describe("concept-to-market flow: seeded skills are exercised end-to-end", () => {
  it("analyzeIdea fans out 4 calls — one per pillar — each using its skill's model + preamble", async () => {
    const { analyzeIdea } = await import("./vetting.functions");

    await analyzeIdea({
      data: { idea: "Modular ceramic cookware that retains heat 3x longer than cast iron." },
    });

    // 4 pillar calls dispatched in parallel
    expect(captured).toHaveLength(4);

    const byTool = Object.fromEntries(captured.map((c) => [c.tool, c]));

    // Strategic → vetting_strategic skill
    expect(byTool.submit_strategic_summary).toBeDefined();
    expect(byTool.submit_strategic_summary.model).toBe("google/gemini-2.5-pro");
    expect(byTool.submit_strategic_summary.system).toContain("STRATEGIC_PREAMBLE_MARKER");

    // Compliance → vetting_compliance skill
    expect(byTool.submit_compliance_review).toBeDefined();
    expect(byTool.submit_compliance_review.model).toBe("openai/gpt-5-mini");
    expect(byTool.submit_compliance_review.system).toContain("COMPLIANCE_PREAMBLE_MARKER");

    // Market → vetting_market skill
    expect(byTool.submit_market_analysis).toBeDefined();
    expect(byTool.submit_market_analysis.model).toBe("google/gemini-2.5-pro");
    expect(byTool.submit_market_analysis.system).toContain("MARKET_PREAMBLE_MARKER");

    // Sales → vetting_sales skill
    expect(byTool.submit_sales_analysis).toBeDefined();
    expect(byTool.submit_sales_analysis.model).toBe("openai/gpt-5-mini");
    expect(byTool.submit_sales_analysis.system).toContain("SALES_PREAMBLE_MARKER");
  });

  it("refineIdea uses the intake_refine skill", async () => {
    const { refineIdea } = await import("./vetting.functions");

    await refineIdea({
      data: { idea: "Modular ceramic cookware that retains heat longer than cast iron." },
    });

    expect(captured).toHaveLength(1);
    expect(captured[0].tool).toBe("submit_refined_idea");
    expect(captured[0].model).toBe("google/gemini-2.5-flash");
    expect(captured[0].system).toContain("INTAKE_PREAMBLE_MARKER");
  });
});

