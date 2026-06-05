import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getHermesSettings, upsertHermesSettings } from "@/lib/api/hermes.functions";
import { listOpenRouterModels } from "@/lib/api/openrouter.functions";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";

const ALL_TOOLS = ["web_search", "summarize", "finish"];

export const Route = createFileRoute("/_authenticated/hermes/settings")({
  component: HermesSettingsPage,
});

function HermesSettingsPage() {
  const getFn = useServerFn(getHermesSettings);
  const saveFn = useServerFn(upsertHermesSettings);
  const modelsFn = useServerFn(listOpenRouterModels);

  const q = useQuery({ queryKey: ["hermesSettings"], queryFn: () => getFn() });
  const modelsQ = useQuery({ queryKey: ["openrouterModels"], queryFn: () => modelsFn() });

  const [model, setModel] = useState("openrouter/openai/gpt-4o-mini");
  const [maxAgents, setMaxAgents] = useState(3);
  const [maxIter, setMaxIter] = useState(8);
  const [tools, setTools] = useState<string[]>(["web_search", "summarize", "finish"]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (q.data) {
      setModel(q.data.default_model);
      setMaxAgents(q.data.max_agents);
      setMaxIter(q.data.max_iterations);
      setTools(q.data.allowed_tools);
    }
  }, [q.data]);

  const save = async () => {
    setSaving(true);
    try {
      await saveFn({
        data: { default_model: model, max_agents: maxAgents, max_iterations: maxIter, allowed_tools: tools },
      });
      toast.success("Settings saved");
      q.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mx-auto max-w-2xl px-6 py-10">
      <p className="text-xs uppercase tracking-[0.2em] text-ember">Hermes</p>
      <h1 className="mt-2 font-display text-3xl font-semibold">Settings</h1>
      <p className="mt-2 text-muted-foreground text-sm">Per-user defaults for new Hermes tasks.</p>

      {q.isLoading ? (
        <Loader2 className="mt-8 h-5 w-5 animate-spin text-muted-foreground" />
      ) : (
        <div className="mt-8 space-y-6">
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Default model</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="mt-2 w-full rounded-2xl border border-border bg-card/60 p-3 text-sm focus:outline-none focus:border-ember"
            >
              <option value={model}>{model}</option>
              {(modelsQ.data?.models ?? []).map((m) => {
                const id = `openrouter/${m.id}`;
                if (id === model) return null;
                return (
                  <option key={m.id} value={id}>
                    {m.name || m.id}
                  </option>
                );
              })}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground">Max workers: {maxAgents}</label>
              <input type="range" min={1} max={8} value={maxAgents} onChange={(e) => setMaxAgents(+e.target.value)} className="mt-2 w-full" />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground">Max iterations: {maxIter}</label>
              <input type="range" min={1} max={20} value={maxIter} onChange={(e) => setMaxIter(+e.target.value)} className="mt-2 w-full" />
            </div>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Allowed tools</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {ALL_TOOLS.map((t) => {
                const active = tools.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() =>
                      setTools((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]))
                    }
                    className={`rounded-full border px-3 py-1 text-xs transition ${
                      active
                        ? "border-ember/40 bg-ember/10 text-ember"
                        : "border-border bg-card/60 text-muted-foreground"
                    }`}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          </div>
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-ember px-5 py-2.5 text-sm font-medium text-ember-foreground shadow-ember hover:brightness-110 transition disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </button>
        </div>
      )}
    </section>
  );
}
