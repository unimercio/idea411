import { createFileRoute, Link } from "@tanstack/react-router";
import { Flame, Mail, Github } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — IdeaForge" },
      { name: "description", content: "Sign in to IdeaForge to start forging your ideas into market-ready products." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  return (
    <main className="min-h-screen bg-background text-foreground grid place-items-center px-6 py-20">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center justify-center gap-2 font-display text-lg font-semibold">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-gradient-ember text-ember-foreground shadow-ember">
            <Flame className="h-4 w-4" />
          </span>
          IdeaForge
        </Link>
        <div className="mt-10 rounded-3xl border border-border bg-card/80 p-8 shadow-elegant">
          <h1 className="font-display text-2xl font-semibold text-center">Welcome back</h1>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            Sign in to continue forging.
          </p>
          <div className="mt-8 space-y-3">
            <button className="w-full inline-flex items-center justify-center gap-2 rounded-full border border-border bg-secondary/60 px-4 py-2.5 text-sm hover:bg-accent transition">
              <Github className="h-4 w-4" /> Continue with GitHub
            </button>
            <button className="w-full inline-flex items-center justify-center gap-2 rounded-full border border-border bg-secondary/60 px-4 py-2.5 text-sm hover:bg-accent transition">
              <Mail className="h-4 w-4" /> Continue with email
            </button>
          </div>
          <p className="mt-8 text-center text-xs text-muted-foreground">
            Auth wiring is coming soon. Connect Lovable Cloud to enable real sign-in.
          </p>
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          <Link to="/" className="hover:text-foreground transition">← Back to home</Link>
        </p>
      </div>
    </main>
  );
}
