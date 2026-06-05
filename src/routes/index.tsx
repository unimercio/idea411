import { createFileRoute } from "@tanstack/react-router";
import { Hero } from "@/components/site/Hero";
import { Footer } from "@/components/site/Footer";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "IdeaForge — Vet your idea in minutes" },
      {
        name: "description",
        content:
          "Drop your concept and get an instant vetting report. Free to try — no account needed.",
      },
      { property: "og:title", content: "IdeaForge — Vet your idea in minutes" },
      {
        property: "og:description",
        content: "Try the idea intake free. Create an account to save your reports.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <Hero />
      <Footer />
    </main>
  );
}
