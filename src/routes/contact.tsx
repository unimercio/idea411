import { createFileRoute, Link } from "@tanstack/react-router";
import { Flame, Mail } from "lucide-react";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact — IdeaForge" },
      { name: "description", content: "Talk to the IdeaForge team about Atelier plans, partnerships, and press." },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto max-w-7xl px-6 py-5">
          <Link to="/" className="flex items-center gap-2 font-display font-semibold">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-gradient-ember text-ember-foreground shadow-ember">
              <Flame className="h-4 w-4" />
            </span>
            IdeaForge
          </Link>
        </div>
      </header>
      <section className="mx-auto max-w-3xl px-6 py-24">
        <p className="text-xs uppercase tracking-[0.2em] text-ember">Talk to us</p>
        <h1 className="mt-3 font-display text-5xl font-semibold text-balance">
          Let's forge something remarkable.
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          For Atelier plans, partnerships, or press — drop us a line and we'll be in touch within one
          business day.
        </p>
        <a
          href="mailto:hello@ideaforge.app"
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-gradient-ember px-5 py-2.5 text-sm font-medium text-ember-foreground shadow-ember hover:brightness-110 transition"
        >
          <Mail className="h-4 w-4" /> hello@ideaforge.app
        </a>
      </section>
    </main>
  );
}
