import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { HeaderBrand } from "@/components/site/HeaderBrand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Bug,
  Sparkles,
  AlertTriangle,
  ArrowUp,
  Trash2,
  Trophy,
} from "lucide-react";
import { checkAdmin } from "@/lib/api/prompt-templates.functions";

export const Route = createFileRoute("/_authenticated/feedback")({
  head: () => ({
    meta: [
      { title: "Feedback — IdeaForge" },
      { name: "description", content: "Share wishes, bugs, and must-have issues." },
    ],
  }),
  component: FeedbackPage,
});

type FeedbackType = "wish" | "bug" | "issue";
type FeedbackStatus = "open" | "planned" | "in_progress" | "done" | "wontfix";

type FeedbackItem = {
  id: string;
  user_id: string;
  type: FeedbackType;
  title: string;
  description: string;
  status: FeedbackStatus;
  votes: number;
  created_at: string;
  github_issue_number: number | null;
  github_issue_url: string | null;
};

const TYPE_META: Record<FeedbackType, { label: string; icon: typeof Bug; tone: string }> = {
  wish: { label: "Wish", icon: Sparkles, tone: "bg-violet-500/15 text-violet-300 border-violet-500/30" },
  bug: { label: "Bug", icon: Bug, tone: "bg-rose-500/15 text-rose-300 border-rose-500/30" },
  issue: { label: "Must-have", icon: AlertTriangle, tone: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
};

const STATUS_LABEL: Record<FeedbackStatus, string> = {
  open: "Open",
  planned: "Planned",
  in_progress: "In progress",
  done: "Done",
  wontfix: "Won't fix",
};

function FeedbackPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [myVotes, setMyVotes] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | FeedbackType>("all");
  const [sort, setSort] = useState<"top" | "new">("top");

  const [type, setType] = useState<FeedbackType>("wish");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const checkAdminFn = useServerFn(checkAdmin);
  const adminQuery = useQuery({ queryKey: ["isAdmin"], queryFn: () => checkAdminFn() });
  const isAdmin = adminQuery.data?.isAdmin === true;

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const load = async () => {
    setLoading(true);
    const { data: rows, error } = await supabase
      .from("feedback_items")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    setItems((rows ?? []) as FeedbackItem[]);
    if (userId) {
      const { data: votes } = await supabase
        .from("feedback_votes")
        .select("item_id")
        .eq("user_id", userId);
      setMyVotes(new Set((votes ?? []).map((v: { item_id: string }) => v.item_id)));
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const createFeedbackFn = useServerFn(createFeedbackWithGithub);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    if (title.trim().length < 3) {
      toast.error("Title is too short");
      return;
    }
    setSubmitting(true);
    try {
      const res = await createFeedbackFn({
        data: { type, title: title.trim(), description: description.trim() },
      });
      setTitle("");
      setDescription("");
      if (res.github) {
        toast.success(`Posted • GitHub issue #${res.github.number}`);
      } else {
        toast.success("Feedback posted");
      }
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to post");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleVote = async (itemId: string) => {
    if (!userId) return;
    const has = myVotes.has(itemId);
    // optimistic
    setMyVotes((s) => {
      const n = new Set(s);
      if (has) n.delete(itemId); else n.add(itemId);
      return n;
    });
    setItems((list) =>
      list.map((i) => (i.id === itemId ? { ...i, votes: i.votes + (has ? -1 : 1) } : i)),
    );
    if (has) {
      const { error } = await supabase
        .from("feedback_votes")
        .delete()
        .eq("item_id", itemId)
        .eq("user_id", userId);
      if (error) toast.error(error.message);
    } else {
      const { error } = await supabase
        .from("feedback_votes")
        .insert({ item_id: itemId, user_id: userId });
      if (error) toast.error(error.message);
    }
  };

  const removeItem = async (id: string) => {
    if (!confirm("Delete this item?")) return;
    const { error } = await supabase.from("feedback_items").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setItems((l) => l.filter((i) => i.id !== id));
  };

  const setStatus = async (id: string, status: FeedbackStatus) => {
    const { error } = await supabase.from("feedback_items").update({ status }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setItems((l) => l.map((i) => (i.id === id ? { ...i, status } : i)));
  };

  const visible = useMemo(() => {
    const f = filter === "all" ? items : items.filter((i) => i.type === filter);
    return [...f].sort((a, b) =>
      sort === "top" ? b.votes - a.votes : +new Date(b.created_at) - +new Date(a.created_at),
    );
  }, [items, filter, sort]);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto max-w-5xl px-6 py-5 flex items-center justify-between">
          <HeaderBrand to="/dashboard" />
          <Link
            to="/bounties"
            className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm hover:bg-muted transition"
          >
            <Trophy className="size-4" /> Bounties
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-6 py-8 space-y-8">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Feedback</h1>
          <p className="text-muted-foreground mt-1">
            Post a Wish (nice to have), a Bug, or a must-have Issue. Upvote what matters.
          </p>
        </div>

        <form
          onSubmit={submit}
          className="rounded-2xl border border-border bg-card/50 p-5 space-y-3"
        >
          <div className="flex flex-col sm:flex-row gap-3">
            <Select value={type} onValueChange={(v) => setType(v as FeedbackType)}>
              <SelectTrigger className="sm:w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="wish">Wish</SelectItem>
                <SelectItem value="bug">Bug</SelectItem>
                <SelectItem value="issue">Must-have</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder="Short title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={140}
              className="flex-1"
            />
          </div>
          <Textarea
            placeholder="Describe it (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={2000}
            rows={3}
          />
          <div className="flex justify-end">
            <Button type="submit" disabled={submitting || !title.trim()}>
              {submitting ? "Posting..." : "Post feedback"}
            </Button>
          </div>
        </form>

        <div className="flex flex-wrap items-center gap-2">
          {(["all", "wish", "bug", "issue"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full border px-3 py-1 text-sm transition ${
                filter === f
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {f === "all" ? "All" : TYPE_META[f].label}
            </button>
          ))}
          <div className="ml-auto flex gap-2">
            {(["top", "new"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSort(s)}
                className={`rounded-full border px-3 py-1 text-sm transition ${
                  sort === s
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {s === "top" ? "Top voted" : "Newest"}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {loading && <p className="text-muted-foreground text-sm">Loading…</p>}
          {!loading && visible.length === 0 && (
            <p className="text-muted-foreground text-sm">No feedback yet. Be the first!</p>
          )}
          {visible.map((item) => {
            const meta = TYPE_META[item.type];
            const Icon = meta.icon;
            const voted = myVotes.has(item.id);
            const canDelete = isAdmin || item.user_id === userId;
            return (
              <article
                key={item.id}
                className="flex gap-4 rounded-2xl border border-border bg-card/50 p-4"
              >
                <button
                  onClick={() => toggleVote(item.id)}
                  className={`flex h-fit flex-col items-center rounded-xl border px-3 py-2 transition ${
                    voted
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:bg-muted"
                  }`}
                  aria-label="Upvote"
                >
                  <ArrowUp className="size-4" />
                  <span className="text-sm font-semibold">{item.votes}</span>
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className={meta.tone}>
                      <Icon className="size-3 mr-1" />
                      {meta.label}
                    </Badge>
                    <Badge variant="outline">{STATUS_LABEL[item.status]}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(item.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <h3 className="mt-2 font-medium">{item.title}</h3>
                  {item.description && (
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap mt-1">
                      {item.description}
                    </p>
                  )}
                  {(isAdmin || canDelete) && (
                    <div className="mt-3 flex items-center gap-2">
                      {isAdmin && (
                        <Select
                          value={item.status}
                          onValueChange={(v) => setStatus(item.id, v as FeedbackStatus)}
                        >
                          <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {(Object.keys(STATUS_LABEL) as FeedbackStatus[]).map((s) => (
                              <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeItem(item.id)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
