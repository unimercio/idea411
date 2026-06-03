import { motion } from "motion/react";
import { ArrowRight, Sparkles, Upload, Mail } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import heroImg from "@/assets/hero-forge.jpg";

export function Hero() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [idea, setIdea] = useState("");
  const [email, setEmail] = useState("");
  const go = () => {
    if (typeof window !== "undefined") {
      if (idea.trim()) sessionStorage.setItem("idea-draft", idea.trim());
      if (email.trim()) sessionStorage.setItem("idea-email", email.trim());
    }
    navigate({ to: "/intake" });
  };
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
            {t("hero.badge")}
          </span>
          <h1 className="mt-6 font-display text-5xl sm:text-6xl md:text-7xl font-semibold text-balance leading-[1.02]">
            {t("hero.title1")}{" "}
            <span className="bg-gradient-ember bg-clip-text text-transparent">{t("hero.titleAccent")}</span>{" "}
            {t("hero.title2")}
          </h1>
          <p className="mt-6 text-lg text-muted-foreground text-balance">
            {t("hero.subtitle")}
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
            <label className="sr-only" htmlFor="idea">{t("intake.concept")}</label>
            <textarea
              id="idea"
              rows={4}
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              placeholder={t("hero.ideaPlaceholder")}
              className="w-full resize-none bg-transparent text-base placeholder:text-muted-foreground/60 focus:outline-none"
            />
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-border bg-background/40 px-3 py-2 focus-within:border-ember/60">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                maxLength={255}
                placeholder={t("hero.emailPlaceholder")}
                className="w-full bg-transparent text-sm placeholder:text-muted-foreground/60 focus:outline-none"
              />
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/60 px-3 py-1.5 text-xs text-muted-foreground">
                <Upload className="h-3.5 w-3.5" /> {t("hero.sketchesNote")}
              </span>
              <button
                type="button"
                onClick={go}
                className="group inline-flex items-center gap-2 rounded-full bg-gradient-ember px-5 py-2.5 text-sm font-medium text-ember-foreground shadow-ember hover:brightness-110 transition"
              >
                {t("hero.tryFree")}
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </button>
            </div>
          </div>
          <p className="px-4 py-3 text-center text-xs text-muted-foreground">
            {t("hero.noAccount")}
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
