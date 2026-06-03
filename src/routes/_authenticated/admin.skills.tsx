import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  deleteSkill,
  listSkills,
  setDefaultSkill,
  upsertSkill,
  type ModelSkill,
} from "@/lib/api/skills.functions";
import {
  COMPONENT_LABEL,
  SKILL_COMPONENTS,
  modelsForComponent,
  type SkillComponent,
} from "@/lib/api/skills.shared";
import { checkAdmin } from "@/lib/api/prompt-templates.functions";

export const Route = createFileRoute("/_authenticated/admin/skills")({
  head: () => ({
    meta: [
      { title: "Model Skills — Admin" },
      {
        name: "description",
        content: "Steer model selection and preloaded context per app component.",
      },
    ],
  }),
  component: SkillsAdmin,
});

type Draft = {
  id?: string;
  component: SkillComponent;
  name: string;
  model: string;
  system_preamble: string;
  enabled: boolean;
  is_default: boolean;
  sort_order: number;
};

function emptyDraft(component: SkillComponent): Draft {
  const [first] = modelsForComponent(component);
  return {
    component,
    name: "",
    model: first,
    system_preamble: "",
    enabled: true,
    is_default: false,
    sort_order: 100,
  };
}

function toDraft(s: ModelSkill): Draft {
  return {
    id: s.id,
    component: s.component,
    name: s.name,
    model: s.model,
    system_preamble: s.system_preamble,
    enabled: s.enabled,
    is_default: s.is_default,
    sort_order: s.sort_order,
  };
}

function SkillsAdmin() {
  const adminFn = useServerFn(checkAdmin);
  const listFn = useServerFn(listSkills);
  const adminQuery = useQuery({ queryKey: ["isAdmin"], queryFn: () => adminFn() });
  const listQuery = useQuery({
    queryKey: ["modelSkills"],
    queryFn: () => listFn(),
    enabled: !!adminQuery.data?.isAdmin,
  });

  if (adminQuery.isLoading) {
    return (
      <div className="grid h-screen place-items-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (!adminQuery.data?.isAdmin) {
    return (
      <main className="mx-auto max-w-xl px-6 py-24">
        <p className="text-sm text-muted-foreground">Admin only.</p>
      </main>
    );
  }

  return <AdminContent skills={listQuery.data?.skills ?? []} loading={listQuery.isLoading} />;
}

function AdminContent({ skills, loading }: { skills: ModelSkill[]; loading: boolean }) {
  const qc = useQueryClient();
  const upsertFn = useServerFn(upsertSkill);
  const deleteFn = useServerFn(deleteSkill);
  const setDefaultFn = useServerFn(setDefaultSkill);
  const [editing, setEditing] = useState<Draft | null>(null);

  const upsertMutation = useMutation({
    mutationFn: (d: Draft) => upsertFn({ data: d }),
    onSuccess: () => {
      toast.success("Saved.");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["modelSkills"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Deleted.");
      qc.invalidateQueries({ queryKey: ["modelSkills"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setDefaultMutation = useMutation({
    mutationFn: (v: { id: string; component: SkillComponent }) => setDefaultFn({ data: v }),
    onSuccess: () => {
      toast.success("Default updated.");
      qc.invalidateQueries({ queryKey: ["modelSkills"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const grouped = useMemo(() => {
    const map = {} as Record<SkillComponent, ModelSkill[]>;
    for (const c of SKILL_COMPONENTS) map[c] = [];
    for (const s of skills) map[s.component].push(s);
    return map;
  }, [skills]);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to dashboard
          </Link>
          <h1 className="mt-2 font-display text-3xl font-semibold">Model skills</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            One skill per component sets the model and a preloaded context preamble that gets
            prepended to that component's system prompt. Star the one you want the app to use.
          </p>
        </div>
      </div>

      {loading && (
        <div className="mt-10 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading skills…
        </div>
      )}

      <div className="mt-8 space-y-10">
        {SKILL_COMPONENTS.map((component) => (
          <section key={component}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">{COMPONENT_LABEL[component]}</h2>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setEditing(emptyDraft(component))}
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" /> New skill
              </Button>
            </div>
            <div className="space-y-2">
              {grouped[component].length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No skill configured — this component uses built-in defaults.
                </p>
              )}
              {grouped[component].map((s) => (
                <SkillRow
                  key={s.id}
                  skill={s}
                  onEdit={() => setEditing(toDraft(s))}
                  onDelete={() => {
                    if (confirm(`Delete "${s.name}"?`)) deleteMutation.mutate(s.id);
                  }}
                  onMakeDefault={() =>
                    setDefaultMutation.mutate({ id: s.id, component: s.component })
                  }
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      {editing && (
        <EditorDrawer
          draft={editing}
          onChange={setEditing}
          onCancel={() => setEditing(null)}
          onSave={() => upsertMutation.mutate(editing)}
          saving={upsertMutation.isPending}
        />
      )}
    </main>
  );
}

function SkillRow({
  skill,
  onEdit,
  onDelete,
  onMakeDefault,
}: {
  skill: ModelSkill;
  onEdit: () => void;
  onDelete: () => void;
  onMakeDefault: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-border bg-card/60 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-foreground">{skill.name}</span>
          {skill.is_default && (
            <Badge className="bg-ember/20 text-ember hover:bg-ember/30">default</Badge>
          )}
          {!skill.enabled && (
            <Badge variant="outline" className="text-[10px]">
              disabled
            </Badge>
          )}
          <code className="text-[11px] text-muted-foreground">{skill.model}</code>
        </div>
        {skill.system_preamble && (
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
            {skill.system_preamble}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {!skill.is_default && (
          <Button size="icon" variant="ghost" onClick={onMakeDefault} title="Set as default">
            <Star className="h-4 w-4" />
          </Button>
        )}
        <Button size="icon" variant="ghost" onClick={onEdit}>
          <Pencil className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" onClick={onDelete}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    </div>
  );
}

function EditorDrawer({
  draft,
  onChange,
  onCancel,
  onSave,
  saving,
}: {
  draft: Draft;
  onChange: (d: Draft) => void;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  const models = modelsForComponent(draft.component);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end bg-background/60 backdrop-blur-sm">
      <div className="h-full w-full max-w-xl overflow-y-auto border-l border-border bg-card p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-xl font-semibold">
            {draft.id ? "Edit skill" : "New skill"}
          </h3>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>

        <div className="mt-6 space-y-5">
          <div>
            <label className="text-xs text-muted-foreground">Component</label>
            <Select
              value={draft.component}
              onValueChange={(v) => {
                const c = v as SkillComponent;
                const [first] = modelsForComponent(c);
                onChange({ ...draft, component: c, model: first });
              }}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SKILL_COMPONENTS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {COMPONENT_LABEL[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Name</label>
            <Input
              className="mt-1"
              placeholder="e.g. Cautious VC analyst"
              value={draft.name}
              onChange={(e) => onChange({ ...draft, name: e.target.value })}
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Model</label>
            <Select
              value={draft.model}
              onValueChange={(v) => onChange({ ...draft, model: v })}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {models.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs text-muted-foreground">
              System preamble (preloaded context)
            </label>
            <Textarea
              className="mt-1 min-h-48 font-mono text-xs"
              placeholder="You are a cautious, evidence-driven analyst. Always cite sources…"
              value={draft.system_preamble}
              onChange={(e) => onChange({ ...draft, system_preamble: e.target.value })}
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              This text is prepended to the component's built-in system prompt.
            </p>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-medium">Enabled</p>
              <p className="text-xs text-muted-foreground">Disabled skills are ignored.</p>
            </div>
            <Switch
              checked={draft.enabled}
              onCheckedChange={(v) => onChange({ ...draft, enabled: v })}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-medium">Default for component</p>
              <p className="text-xs text-muted-foreground">
                Only one skill per component can be default.
              </p>
            </div>
            <Switch
              checked={draft.is_default}
              onCheckedChange={(v) => onChange({ ...draft, is_default: v })}
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Sort order</label>
            <Input
              className="mt-1"
              type="number"
              value={draft.sort_order}
              onChange={(e) =>
                onChange({ ...draft, sort_order: parseInt(e.target.value, 10) || 0 })
              }
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button onClick={onSave} disabled={saving || !draft.name.trim() || !draft.model}>
              {saving ? "Saving…" : "Save skill"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
