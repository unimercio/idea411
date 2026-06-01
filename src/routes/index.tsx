import { createFileRoute } from "@tanstack/react-router";
import { Nav } from "@/components/site/Nav";
import { Hero } from "@/components/site/Hero";
import { Flow } from "@/components/site/Flow";
import { Showcase } from "@/components/site/Showcase";
import { Pricing } from "@/components/site/Pricing";
import { Footer } from "@/components/site/Footer";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "IdeaForge — Concept to market, in one flow" },
      {
        name: "description",
        content:
          "IdeaForge vets raw concepts with compliance, market, and demand analysis — turning sparks into actionable opportunity reports.",
      },
      { property: "og:title", content: "IdeaForge — Concept to market, in one flow" },
      {
        property: "og:description",
        content: "Vet your product idea with an AI innovation team.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <Nav />
      <Hero />
      <Flow />
      <Showcase />
      <Pricing />
      <Footer />
    </main>
  );
}
