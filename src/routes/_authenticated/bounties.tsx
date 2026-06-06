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
import { Trophy, MessageSquare, Trash2, Award, Check } from "lucide-react";
import { checkAdmin } from "@/lib/api/prompt-templates.functions";

export const Route = createFileRoute("/_authenticated/bounties")({
  head: () => ({
    meta: [
      { title: "Bounties — IdeaForge" },
      { name: "description", content: "Post, manage, and award bounties for feedback." },
    ],
  }),
  component: BountiesPage,
});

type BountyStatus = "open" | "awarded" | "paid" | "cancelled";

type Bounty = {
  id: string;
  feedback_item_id: string | null;
  title: string;
  description: string;
  amount: number;
  currency: string;
  status: BountyStatus;
  created_by: string;
  awarded_to: string | null;
  awarded_at: string | null;
  notes: string;
  created_at: string;
};

type FeedbackItemLite = { id: string; title: string; type: string };

const STATUS_TONE: Record<BountyStatus, string> = {
  open: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  awarded: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  paid: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  cancelled: "bg-muted text-muted-foreground border-border",
};

const STATUS_LABEL: Record<BountyStatus, string> = {
  open: "Open",
  awarded: "Awarded",
  paid: "Paid",
  cancelled: "Cancelled",
};

function BountiesPage() {
  const [bounties, setBounties] = useState<Bounty[]>([]);
  const [feedback, setFeedback] = useState<FeedbackItemLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | BountyStatus>("all");

  const checkAdminFn = useServerFn(checkAdmin);
  const adminQuery = useQuery({ queryKey: ["isAdmin"], queryFn: () => checkAdminFn() });
  const isAdmin = adminQuery.data?.isAdmin === true;

  // form state
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("100");
  const [currency, setCurrency] = useState("USD");
  const [feedbackId, setFeedbackId] = useState<string>("none");
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: b, error: be }, { data: f }] = await Promise.all([
      supabase.from("bounties").select("*").order("created_at", { ascending: false }),
      supabase.from("feedback_items").select("id,title,type").order("created_at", { ascending: false }),
    ]);
    if (be) toast.error(be.message);
    setBounties((b ?? []) as Bounty[]);
    setFeedback((f ?? []) as FeedbackItemLite[]);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim().length < 3) {
      toast.error("Title too short");
      return;
    }
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt < 0) {
      toast.error("Invalid amount");
      return;
    }
    setSubmitting(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("bounties").insert({
      title: title.trim(),
      description: description.trim(),
      amount: amt,
      currency: currency.trim().toUpperCase().slice(0, 8),
      feedback_item_id: feedbackId === "none" ? null : feedbackId,
      created_by: u.user?.id,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setTitle(""); setDescription(""); setAmount("100"); setFeedbackId("none");
    setShowForm(false);
    toast.success("Bounty posted");
    void load();
  };

  const updateBounty = async (id: string, patch: Partial<Bounty>) => {
    const { error } = await supabase.from("bounties").update(patch).eq("id", id);
    if (error) { toast.error(error.message); return; }
    setBounties((l) => l.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  };

  const awardBounty = async (id: string) => {
    const email = prompt("Award to — enter the user's email (for the record) or leave blank to mark as awarded:");
    await updateBounty(id, {
      status: "awarded",
      awarded_at: new Date().toISOString(),
      notes: email ? `Awarded to: ${email}` : "",
    });
    toast.success("Bounty awarded");
  };

  const markPaid = async (id: string) => updateBounty(id, { status: "paid" });
  const cancel = async (id: string) => updateBounty(id, { status: "cancelled" });

  const remove = async (id: string) => {
    if (!confirm("Delete bounty?")) return;
    const { error } = await supabase.from("bounties").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setBounties((l) => l.filter((b) => b.id !== id));
  };

  const visible = useMemo(
    () => (filter === "all" ? bounties : bounties.filter((b) => b.status === filter)),
    [bounties, filter],
  );

  const totals = useMemo(() => {
    const sum = (s: BountyStatus) =>
      bounties.filter((b) => b.status === s).reduce((a, b) => a + Number(b.amount || 0), 0);
    return { open: sum("open"), awarded: sum("awarded"), paid: sum("paid") };
  }, [bounties]);

  const fmt = (n: number, cur: string) =>
    new Intl.NumberFormat(undefined, { style: "currency", currency: cur || "USD" }).format(n);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto max-w-5xl px-6 py-5 flex items-center justify-between">
          <HeaderBrand to="/dashboard" />
          <Link
            to="/feedback"
            className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm hover:bg-muted transition"
          >
            <MessageSquare className="size-4" /> Feedback
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-6 py-8 space-y-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight flex items-center gap-2">
              <Trophy className="size-7 text-amber-400" /> Bounties
            </h1>
            <p className="text-muted-foreground mt-1">
              Post, manage, and award bounties tied to feedback items.
            </p>
          </div>
          {isAdmin && (
            <Button onClick={() => setShowForm((s) => !s)}>
              {showForm ? "Close" : "Post bounty"}
            </Button>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3">
          {(["open", "awarded", "paid"] as const).map((k) => (
            <div key={k} className="rounded-2xl border border-border bg-card/50 p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">{STATUS_LABEL[k]}</div>
              <div className="text-2xl font-semibold mt-1">{fmt(totals[k], "USD")}</div>
            </div>
          ))}
        </div>

        {showForm && isAdmin && (
          <form
            onSubmit={submit}
            className="rounded-2xl border border-border bg-card/50 p-5 space-y-3"
          >
            <Input
              placeholder="Bounty title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={140}
            />
            <Textarea
              placeholder="Scope, acceptance criteria, links…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={4000}
            />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Input
                type="number"
                min={0}
                step="0.01"
                placeholder="Amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <Input
                placeholder="Currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                maxLength={8}
              />
              <Select value={feedbackId} onValueChange={setFeedbackId}>
                <SelectTrigger><SelectValue placeholder="Link feedback (optional)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No linked feedback</SelectItem>
                  {feedback.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      [{f.type}] {f.title.slice(0, 60)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Posting…" : "Post bounty"}
              </Button>
            </div>
          </form>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {(["all", "open", "awarded", "paid", "cancelled"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full border px-3 py-1 text-sm transition ${
                filter === f
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {f === "all" ? "All" : STATUS_LABEL[f]}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {loading && <p className="text-muted-foreground text-sm">Loading…</p>}
          {!loading && visible.length === 0 && (
            <p className="text-muted-foreground text-sm">No bounties yet.</p>
          )}
          {visible.map((b) => {
            const linked = feedback.find((f) => f.id === b.feedback_item_id);
            return (
              <article key={b.id} className="rounded-2xl border border-border bg-card/50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className={STATUS_TONE[b.status]}>
                        {STATUS_LABEL[b.status]}
                      </Badge>
                      <span className="text-lg font-semibold">
                        {fmt(Number(b.amount), b.currency)}
                      </span>
                      {linked && (
                        <Badge variant="outline" className="text-xs">
                          ↳ {linked.title.slice(0, 50)}
                        </Badge>
                      )}
                    </div>
                    <h3 className="mt-2 font-medium">{b.title}</h3>
                    {b.description && (
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap mt-1">
                        {b.description}
                      </p>
                    )}
                    {b.notes && (
                      <p className="text-xs text-muted-foreground mt-2 italic">{b.notes}</p>
                    )}
                  </div>
                  {isAdmin && (
                    <div className="flex flex-wrap gap-2">
                      {b.status === "open" && (
                        <>
                          <Button size="sm" onClick={() => awardBounty(b.id)}>
                            <Award className="size-4 mr-1" /> Award
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => cancel(b.id)}>
                            Cancel
                          </Button>
                        </>
                      )}
                      {b.status === "awarded" && (
                        <Button size="sm" onClick={() => markPaid(b.id)}>
                          <Check className="size-4 mr-1" /> Mark paid
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => remove(b.id)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="size-4" />
                      </Button>
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
