import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  deleteHermesRolePreset,
  listHermesRolePresets,
  upsertHermesRolePreset,
  type HermesRolePreset,
} from "@/lib/api/hermes.functions";
import { listOpenRouterModels } from "@/lib/api/openrouter.functions";
import { toast } from "sonner";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/hermes-presets")({
  component: AdminHermesPresetsPage,
});

const blank: Omit<HermesRolePreset, "id"> & { id?: string } = {
  role: "worker",
  name: "",
  system_prompt: "",
  default_model: "openrouter/openai/gpt-4o-mini",
  enabled: true,
  sort_order: 100,
};

function AdminHermesPresetsPage() {
  const listFn = useServerFn(listHermesRolePresets);
  const saveFn = useServerFn(upsertHermesRolePreset);
  const delFn = useServerFn(deleteHermesRolePreset);
  const modelsFn = useServerFn(listOpenRouterModels);

  const q = useQuery({ queryKey: ["hermesPresets"], queryFn: () => listFn() });
  const modelsQ = useQuery({ queryKey: ["openrouterModels"], queryFn: () => modelsFn() });
  const [editing, setEditing] = useState<(Omit<HermesRolePreset, "id"> & { id?: string }) | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await saveFn({
        data: {
          id: editing.id,
          role: editing.role,
          name: editing.name,
          system_prompt: editing.system_prompt,
          default_model: editing.default_model,
          enabled: editing.enabled,
          sort_order: editing.sort_order,
        },
      });
      toast.success("Preset saved");
      setEditing(null);
      q.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-ember">Admin</p>
            <h1 className="mt-2 font-display text-3xl font-semibold">Hermes role presets</h1>
            <p className="mt-2 text-muted-foreground text-sm">
              Default system prompts and models for planner / worker / critic agents.
            </p>
          </div>
          <button
            onClick={() => setEditing({ ...blank })}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-ember px-4 py-2 text-sm font-medium text-ember-foreground shadow-ember"
          >
            <Plus className="h-3.5 w-3.5" /> New preset
          </button>
        </div>

        {q.isLoading && <Loader2 className="mt-8 h-5 w-5 animate-spin text-muted-foreground" />}
        {q.error && <p className="mt-6 text-destructive">{(q.error as Error).message}</p>}

        {q.data && (
          <div className="mt-8 grid gap-3">
            {q.data.map((p) => (
              <article
                key={p.id}
                className="rounded-2xl border border-border bg-card/60 p-4 flex items-start justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-wider text-ember">{p.role}</p>
                  <p className="mt-1 font-medium">{p.name}</p>
                  <p className="text-xs font-mono text-muted-foreground">{p.default_model}</p>
                  <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{p.system_prompt}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={`text-[10px] rounded-full border px-2 py-0.5 uppercase tracking-wider ${p.enabled ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-border bg-muted/40 text-muted-foreground"}`}>
                    {p.enabled ? "enabled" : "disabled"}
                  </span>
                  <div className="flex gap-1">
                    <button onClick={() => setEditing(p)} className="text-xs text-muted-foreground hover:text-foreground px-2 py-1">
                      Edit
                    </button>
                    <button
                      onClick={async () => {
                        if (!confirm("Delete this preset?")) return;
                        await delFn({ data: { id: p.id } });
                        q.refetch();
                      }}
                      className="text-xs text-destructive hover:brightness-110 px-2 py-1"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        {editing && (
          <div className="mt-10 rounded-3xl border border-ember/30 bg-card/80 p-6">
            <h2 className="font-display text-xl">{editing.id ? "Edit preset" : "New preset"}</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="text-xs uppercase tracking-wider text-muted-foreground">
                Role
                <select
                  value={editing.role}
                  onChange={(e) => setEditing({ ...editing, role: e.target.value as any })}
                  className="mt-2 w-full rounded-xl border border-border bg-background/60 p-2 text-sm"
                >
                  <option value="planner">planner</option>
                  <option value="worker">worker</option>
                  <option value="critic">critic</option>
                  <option value="custom">custom</option>
                </select>
              </label>
              <label className="text-xs uppercase tracking-wider text-muted-foreground">
                Name
                <input
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  className="mt-2 w-full rounded-xl border border-border bg-background/60 p-2 text-sm"
                />
              </label>
              <label className="text-xs uppercase tracking-wider text-muted-foreground md:col-span-2">
                Default model
                <select
                  value={editing.default_model}
                  onChange={(e) => setEditing({ ...editing, default_model: e.target.value })}
                  className="mt-2 w-full rounded-xl border border-border bg-background/60 p-2 text-sm"
                >
                  <option value={editing.default_model}>{editing.default_model}</option>
                  {(modelsQ.data?.models ?? []).map((m) => {
                    const id = `openrouter/${m.id}`;
                    if (id === editing.default_model) return null;
                    return (
                      <option key={m.id} value={id}>
                        {m.name || m.id}
                      </option>
                    );
                  })}
                </select>
              </label>
              <label className="text-xs uppercase tracking-wider text-muted-foreground md:col-span-2">
                System prompt
                <textarea
                  rows={6}
                  value={editing.system_prompt}
                  onChange={(e) => setEditing({ ...editing, system_prompt: e.target.value })}
                  className="mt-2 w-full rounded-xl border border-border bg-background/60 p-2 text-sm"
                />
              </label>
              <label className="text-xs uppercase tracking-wider text-muted-foreground">
                Sort order
                <input
                  type="number"
                  value={editing.sort_order}
                  onChange={(e) => setEditing({ ...editing, sort_order: +e.target.value })}
                  className="mt-2 w-full rounded-xl border border-border bg-background/60 p-2 text-sm"
                />
              </label>
              <label className="flex items-end gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editing.enabled}
                  onChange={(e) => setEditing({ ...editing, enabled: e.target.checked })}
                />
                Enabled
              </label>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={save}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-full bg-gradient-ember px-4 py-2 text-sm font-medium text-ember-foreground shadow-ember disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
              </button>
              <button onClick={() => setEditing(null)} className="text-sm text-muted-foreground hover:text-foreground px-3">
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
