import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { createHermesTask, getHermesSettings } from "@/lib/api/hermes.functions";
import { listOpenRouterModels } from "@/lib/api/openrouter.functions";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/hermes/new")({
  component: NewHermesTaskPage,
});

function NewHermesTaskPage() {
  const navigate = useNavigate();
  const createFn = useServerFn(createHermesTask);
  const settingsFn = useServerFn(getHermesSettings);
  const modelsFn = useServerFn(listOpenRouterModels);

  const settingsQ = useQuery({ queryKey: ["hermesSettings"], queryFn: () => settingsFn() });
  const modelsQ = useQuery({ queryKey: ["openrouterModels"], queryFn: () => modelsFn() });

  const defaultModel = settingsQ.data?.default_model ?? "openrouter/openai/gpt-4o-mini";
  const [goal, setGoal] = useState("");
  const [model, setModel] = useState<string>(defaultModel);
  const [maxAgents, setMaxAgents] = useState<number>(settingsQ.data?.max_agents ?? 3);
  const [maxIterations, setMaxIterations] = useState<number>(settingsQ.data?.max_iterations ?? 8);
  const [submitting, setSubmitting] = useState(false);

  // Sync defaults from settings once loaded
  useMemo(() => {
    if (settingsQ.data) {
      setModel((m) => (m === "openrouter/openai/gpt-4o-mini" ? settingsQ.data!.default_model : m));
      setMaxAgents((v) => (v === 3 ? settingsQ.data!.max_agents : v));
      setMaxIterations((v) => (v === 8 ? settingsQ.data!.max_iterations : v));
    }
  }, [settingsQ.data]);

  const models = modelsQ.data?.models ?? [];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (goal.trim().length < 8) {
      toast.error("Goal must be at least 8 characters");
      return;
    }
    setSubmitting(true);
    try {
      const t = await createFn({ data: { goal: goal.trim(), model, maxAgents, maxIterations } });
      toast.success("Task created");
      navigate({ to: "/hermes/$taskId", params: { taskId: t.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="mx-auto max-w-3xl px-6 py-10">
      <p className="text-xs uppercase tracking-[0.2em] text-ember">New Hermes task</p>
      <h1 className="mt-2 font-display text-3xl font-semibold">Give Hermes a goal</h1>
      <p className="mt-2 text-muted-foreground text-sm">
        A planner agent decomposes the goal; worker agents research and execute sub-tasks; a critic
        consolidates the final report.
      </p>

      <form onSubmit={submit} className="mt-8 space-y-6">
        <div>
          <label className="text-xs uppercase tracking-wider text-muted-foreground">Goal</label>
          <textarea
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            rows={6}
            placeholder="e.g. Research the top 5 competitors in AI-powered note-taking apps and produce a positioning brief."
            className="mt-2 w-full rounded-2xl border border-border bg-card/60 p-4 text-sm focus:outline-none focus:border-ember"
            maxLength={4000}
          />
        </div>

        <div>
          <label className="text-xs uppercase tracking-wider text-muted-foreground">Model (OpenRouter)</label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="mt-2 w-full rounded-2xl border border-border bg-card/60 p-3 text-sm focus:outline-none focus:border-ember"
          >
            <option value={defaultModel}>{defaultModel} (default)</option>
            {modelsQ.isLoading && <option disabled>Loading OpenRouter models…</option>}
            {models.map((m) => {
              const id = `openrouter/${m.id}`;
              if (id === defaultModel) return null;
              return (
                <option key={m.id} value={id}>
                  {m.name || m.id}
                </option>
              );
            })}
          </select>
          {modelsQ.error && (
            <p className="mt-1 text-xs text-destructive">
              Couldn't load OpenRouter catalog: {(modelsQ.error as Error).message}. You can still submit with the default model.
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground">
              Max workers: {maxAgents}
            </label>
            <input
              type="range"
              min={1}
              max={8}
              value={maxAgents}
              onChange={(e) => setMaxAgents(Number(e.target.value))}
              className="mt-2 w-full"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground">
              Max iterations per worker: {maxIterations}
            </label>
            <input
              type="range"
              min={1}
              max={20}
              value={maxIterations}
              onChange={(e) => setMaxIterations(Number(e.target.value))}
              className="mt-2 w-full"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-2 rounded-full bg-gradient-ember px-5 py-2.5 text-sm font-medium text-ember-foreground shadow-ember hover:brightness-110 transition disabled:opacity-50"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {submitting ? "Creating…" : "Spawn Hermes"}
        </button>
      </form>
    </section>
  );
}
