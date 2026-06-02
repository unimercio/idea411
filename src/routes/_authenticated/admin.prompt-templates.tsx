import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Loader2,
  Pencil,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
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
  CATEGORIES,
  KNOWN_VARIABLES,
  checkAdmin,
  claimFirstAdmin,
  deletePromptTemplate,
  listPromptTemplates,
  upsertPromptTemplate,
  type PromptCategory,
  type PromptTemplate,
} from "@/lib/api/prompt-templates.functions";

export const Route = createFileRoute("/_authenticated/admin/prompt-templates")({
  head: () => ({
    meta: [
      { title: "Prompt Templates — Admin" },
      {
        name: "description",
        content: "Manage the reusable analyst follow-up prompt templates.",
      },
    ],
  }),
  component: PromptTemplatesAdmin,
});

const CATEGORY_LABEL: Record<PromptCategory, string> = {
  strategic: "🎯 Strategic",
  compliance: "⚖️ Compliance",
  market: "📊 Market",
  sales: "💸 Sales & GTM",
};

type Draft = {
  id?: string;
  slug: string;
  category: PromptCategory;
  template: string;
  requires: string[];
  enabled: boolean;
  sort_order: number;
};

function emptyDraft(category: PromptCategory = "strategic"): Draft {
  return {
    slug: "",
    category,
    template: "",
    requires: [],
    enabled: true,
    sort_order: 100,
  };
}

function PromptTemplatesAdmin() {
  const qc = useQueryClient();
  const adminFn = useServerFn(checkAdmin);
  const listFn = useServerFn(listPromptTemplates);
  const claimFn = useServerFn(claimFirstAdmin);

  const adminQuery = useQuery({
    queryKey: ["isAdmin"],
    queryFn: () => adminFn(),
  });

  const listQuery = useQuery({
    queryKey: ["promptTemplates"],
    queryFn: () => listFn(),
    enabled: !!adminQuery.data?.isAdmin,
  });

  const claimMutation = useMutation({
    mutationFn: () => claimFn(),
    onSuccess: (res) => {
      if (res.claimed) {
        toast.success("You are now an admin.");
        qc.invalidateQueries({ queryKey: ["isAdmin"] });
      } else {
        toast.error("An admin already exists. Ask them to grant you access.");
      }
    },
    onError: (e: Error) => toast.error(e.message),
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
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </Link>
        <div className="mt-8 rounded-2xl border border-border bg-card/80 p-8 shadow-elegant">
          <ShieldCheck className="h-6 w-6 text-ember" />
          <h1 className="mt-3 font-display text-2xl font-semibold">Admin only</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            You need the <span className="text-foreground">admin</span> role to manage prompt
            templates. If you're the first user, you can claim the admin role now.
          </p>
          <Button
            className="mt-6"
            onClick={() => claimMutation.mutate()}
            disabled={claimMutation.isPending}
          >
            {claimMutation.isPending ? "Claiming…" : "Claim admin role"}
          </Button>
        </div>
      </main>
    );
  }

  return <AdminContent templates={listQuery.data?.templates ?? []} loading={listQuery.isLoading} />;
}

function AdminContent({
  templates,
  loading,
}: {
  templates: PromptTemplate[];
  loading: boolean;
}) {
  const qc = useQueryClient();
  const upsertFn = useServerFn(upsertPromptTemplate);
  const deleteFn = useServerFn(deletePromptTemplate);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [activeCategory, setActiveCategory] = useState<PromptCategory | "all">("all");

  const upsertMutation = useMutation({
    mutationFn: (d: Draft) => upsertFn({ data: d }),
    onSuccess: () => {
      toast.success("Saved.");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["promptTemplates"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Deleted.");
      qc.invalidateQueries({ queryKey: ["promptTemplates"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const grouped = useMemo(() => {
    const map: Record<PromptCategory, PromptTemplate[]> = {
      strategic: [],
      compliance: [],
      market: [],
      sales: [],
    };
    for (const t of templates) map[t.category].push(t);
    return map;
  }, [templates]);

  const visibleCategories =
    activeCategory === "all" ? [...CATEGORIES] : ([activeCategory] as PromptCategory[]);

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
          <h1 className="mt-2 font-display text-3xl font-semibold">Prompt templates</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            These are the reusable follow-up prompts the analyst suggests after a vetting report.
            Use <code className="rounded bg-muted px-1 py-0.5 text-[11px]">{`{variable}`}</code>{" "}
            placeholders — templates whose required variables are missing in a given report are
            automatically hidden.
          </p>
        </div>
        <Button
          onClick={() =>
            setEditing(emptyDraft(activeCategory === "all" ? "strategic" : activeCategory))
          }
        >
          <Plus className="mr-2 h-4 w-4" /> New template
        </Button>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <CategoryChip
          label="All"
          active={activeCategory === "all"}
          onClick={() => setActiveCategory("all")}
        />
        {CATEGORIES.map((c) => (
          <CategoryChip
            key={c}
            label={CATEGORY_LABEL[c]}
            active={activeCategory === c}
            onClick={() => setActiveCategory(c)}
          />
        ))}
      </div>

      {loading && (
        <div className="mt-10 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading templates…
        </div>
      )}

      <div className="mt-8 space-y-10">
        {visibleCategories.map((cat) => (
          <section key={cat}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">{CATEGORY_LABEL[cat]}</h2>
              <span className="text-xs text-muted-foreground">
                {grouped[cat].length} {grouped[cat].length === 1 ? "template" : "templates"}
              </span>
            </div>
            <div className="space-y-2">
              {grouped[cat].length === 0 && (
                <p className="text-sm text-muted-foreground">No templates in this category yet.</p>
              )}
              {grouped[cat].map((t) => (
                <TemplateRow
                  key={t.id}
                  template={t}
                  onEdit={() => setEditing(toDraft(t))}
                  onDelete={() => {
                    if (confirm(`Delete "${t.slug}"?`)) deleteMutation.mutate(t.id);
                  }}
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

function CategoryChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs transition ${
        active
          ? "border-ember/50 bg-ember/10 text-foreground"
          : "border-border bg-background/60 text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

function TemplateRow({
  template,
  onEdit,
  onDelete,
}: {
  template: PromptTemplate;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-border bg-card/60 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <code className="text-[11px] text-muted-foreground">{template.slug}</code>
          {!template.enabled && (
            <Badge variant="outline" className="text-[10px]">
              disabled
            </Badge>
          )}
          {template.requires.length > 0 && (
            <span className="text-[10px] text-muted-foreground">
              needs:{" "}
              {template.requires.map((v) => (
                <code
                  key={v}
                  className="ml-1 rounded bg-muted px-1 py-0.5 text-[10px] text-foreground/80"
                >
                  {v}
                </code>
              ))}
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-foreground/90">{renderPreview(template.template)}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
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

function renderPreview(template: string) {
  const parts = template.split(/(\{\w+\})/g);
  return parts.map((p, i) =>
    /^\{\w+\}$/.test(p) ? (
      <span
        key={i}
        className="rounded bg-ember/15 px-1 py-0.5 text-xs text-ember"
      >
        {p}
      </span>
    ) : (
      <span key={i}>{p}</span>
    ),
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
  const usedVars = useMemo(
    () =>
      Array.from(new Set(Array.from(draft.template.matchAll(/\{(\w+)\}/g)).map((m) => m[1]))),
    [draft.template],
  );

  const toggleRequire = (v: string) => {
    onChange({
      ...draft,
      requires: draft.requires.includes(v)
        ? draft.requires.filter((r) => r !== v)
        : [...draft.requires, v],
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/70 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-2xl rounded-t-3xl border border-border bg-card shadow-elegant sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="font-display text-lg font-semibold">
            {draft.id ? "Edit template" : "New template"}
          </h2>
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-6 py-5 space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Slug">
              <Input
                value={draft.slug}
                onChange={(e) => onChange({ ...draft, slug: e.target.value })}
                placeholder="strat-leverage"
              />
            </Field>
            <Field label="Category">
              <Select
                value={draft.category}
                onValueChange={(v) =>
                  onChange({ ...draft, category: v as PromptCategory })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {CATEGORY_LABEL[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field
            label="Template"
            hint="Use {variable} placeholders. Click a chip below to insert."
          >
            <Textarea
              value={draft.template}
              onChange={(e) => onChange({ ...draft, template: e.target.value })}
              placeholder='Where am I most exposed against {competitor}?'
              rows={3}
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {KNOWN_VARIABLES.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() =>
                    onChange({ ...draft, template: draft.template + `{${v}}` })
                  }
                  className="rounded-full border border-border bg-background/60 px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground hover:border-ember/40"
                >
                  {`{${v}}`}
                </button>
              ))}
            </div>
          </Field>

          {usedVars.length > 0 && (
            <Field
              label="Required variables"
              hint="A template is hidden when any required variable is missing in the report. Toggle which placeholders are required."
            >
              <div className="flex flex-wrap gap-1.5">
                {usedVars.map((v) => {
                  const on = draft.requires.includes(v);
                  return (
                    <button
                      key={v}
                      type="button"
                      onClick={() => toggleRequire(v)}
                      className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
                        on
                          ? "border-ember/50 bg-ember/15 text-ember"
                          : "border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {v} {on ? "✓" : ""}
                    </button>
                  );
                })}
              </div>
            </Field>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Sort order" hint="Lower numbers appear first.">
              <Input
                type="number"
                value={draft.sort_order}
                onChange={(e) =>
                  onChange({ ...draft, sort_order: Number(e.target.value) || 0 })
                }
              />
            </Field>
            <Field label="Enabled">
              <div className="flex h-10 items-center gap-3">
                <Switch
                  checked={draft.enabled}
                  onCheckedChange={(v) => onChange({ ...draft, enabled: v })}
                />
                <span className="text-sm text-muted-foreground">
                  {draft.enabled ? "Visible to users" : "Hidden from users"}
                </span>
              </div>
            </Field>
          </div>

          <div className="rounded-xl border border-border bg-background/40 p-3">
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Preview
            </p>
            <p className="mt-1 text-sm">{renderPreview(draft.template || "—")}</p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={saving}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save template
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold text-foreground/80">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-muted-foreground">{hint}</span>}
    </label>
  );
}

function toDraft(t: PromptTemplate): Draft {
  return {
    id: t.id,
    slug: t.slug,
    category: t.category,
    template: t.template,
    requires: t.requires,
    enabled: t.enabled,
    sort_order: t.sort_order,
  };
}
