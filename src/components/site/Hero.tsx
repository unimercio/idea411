import { motion } from "motion/react";
import { ArrowRight, Sparkles, Upload } from "lucide-react";
import { Link } from "@tanstack/react-router";
import heroImg from "@/assets/hero-forge.jpg";

export function Hero() {
  return (
    <section className="relative pt-36 pb-24 overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-0 -z-10 opacity-70"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 80% 50% at 50% 0%, oklch(0.68 0.19 38 / 0.18), transparent 60%)",
        }}
      />
      <div className="mx-auto max-w-7xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto max-w-3xl text-center"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-ember" />
            Concept to market — in one flow
          </span>
          <h1 className="mt-6 font-display text-5xl sm:text-6xl md:text-7xl font-semibold text-balance leading-[1.02]">
            Forge ideas into{" "}
            <span className="bg-gradient-ember bg-clip-text text-transparent">market-ready</span>{" "}
            products.
          </h1>
          <p className="mt-6 text-lg text-muted-foreground text-balance">
            IdeaForge vets, visualizes, protects, and launches your concept — from a napkin sketch
            to a live pre-order page — with the rigor of a world-class innovation team.
          </p>
        </motion.div>

        {/* Intake card */}
        <motion.div
          id="start"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          className="relative mx-auto mt-12 max-w-3xl rounded-3xl border border-border bg-card/80 p-2 shadow-elegant"
        >
          <div className="rounded-[1.25rem] bg-background/60 p-5">
            <label className="sr-only" htmlFor="idea">Describe your idea</label>
            <textarea
              id="idea"
              rows={4}
              placeholder="A modular ceramic cookware system that retains heat 3× longer than cast iron…"
              className="w-full resize-none bg-transparent text-base placeholder:text-muted-foreground/60 focus:outline-none"
            />
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <button className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/60 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition">
                <Upload className="h-3.5 w-3.5" /> Attach sketch
              </button>
              <Link to="/auth" className="group inline-flex items-center gap-2 rounded-full bg-gradient-ember px-5 py-2.5 text-sm font-medium text-ember-foreground shadow-ember hover:brightness-110 transition">
                Vet my idea
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>
          <p className="px-4 py-3 text-center text-xs text-muted-foreground">
            Free idea intake and basic vetting · No credit card required
          </p>
        </motion.div>

        {/* Hero render */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="relative mx-auto mt-20 max-w-5xl"
        >
          <div className="relative aspect-[16/10] overflow-hidden rounded-3xl border border-border shadow-elegant">
            <img
              src={heroImg}
              alt="A glowing forged object representing raw concepts becoming refined products"
              width={1600}
              height={1000}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-background to-transparent" />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
