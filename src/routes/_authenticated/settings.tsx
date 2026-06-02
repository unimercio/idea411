import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Flame, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getMySettings, updateMySettings } from "@/lib/api/settings.functions";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — IdeaForge" },
      { name: "description", content: "Manage your account preferences." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();
  const getFn = useServerFn(getMySettings);
  const updateFn = useServerFn(updateMySettings);

  const { data, isLoading, error } = useQuery({
    queryKey: ["my-settings"],
    queryFn: () => getFn(),
  });

  const [firstName, setFirstName] = useState("");
  const [title, setTitle] = useState("");

  useEffect(() => {
    if (data) {
      setFirstName(data.first_name ?? "");
      setTitle(data.title ?? "");
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: (vars: { first_name: string; title: string }) =>
      updateFn({ data: vars }),
    onSuccess: () => {
      toast.success("Settings saved.");
      qc.invalidateQueries({ queryKey: ["my-settings"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to save"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (firstName.length > 100) {
      toast.error("First name must be 100 characters or fewer.");
      return;
    }
    if (title.length > 150) {
      toast.error("Title must be 150 characters or fewer.");
      return;
    }
    mutation.mutate({ first_name: firstName.trim(), title: title.trim() });
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto max-w-3xl px-6 py-5 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-display font-semibold">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-gradient-ember text-ember-foreground shadow-ember">
              <Flame className="h-4 w-4" />
            </span>
            IdeaForge
          </Link>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back to projects
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-6 py-10">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-semibold tracking-tight">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Personal details used across your IdeaForge experience.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-elegant">
          <h2 className="font-display text-lg font-semibold">Profile</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Tell us a bit about yourself.
          </p>

          {error && (
            <p className="mb-4 text-sm text-destructive">
              {error instanceof Error ? error.message : "Failed to load settings"}
            </p>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="first_name">First name</Label>
              <Input
                id="first_name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Ada"
                maxLength={100}
                disabled={isLoading || mutation.isPending}
                autoComplete="given-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Founder, Product Manager, etc."
                maxLength={150}
                disabled={isLoading || mutation.isPending}
                autoComplete="organization-title"
              />
              <p className="text-xs text-muted-foreground">
                How you describe your role.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                type="submit"
                disabled={isLoading || mutation.isPending}
                className="bg-gradient-ember text-ember-foreground shadow-ember hover:brightness-110"
              >
                <Save className="h-4 w-4 mr-2" />
                {mutation.isPending ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}
