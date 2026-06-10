import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { ArrowRight, ImagePlus, Sparkles, X, History, Mail, Wand2, Zap } from "lucide-react";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { getProject, overallScore } from "@/lib/projects";
import { refineIdea } from "@/lib/api/vetting.functions";
import { enhanceIdea } from "@/lib/api/enhance-idea.functions";
import { HeaderBrand } from "@/components/site/HeaderBrand";
import { getIntakeCharRange } from "@/lib/intakeCharRange";

const searchSchema = z.object({
  refine: z.string().trim().min(1).max(64).optional().catch(undefined),
});

export const Route = createFileRoute("/intake")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "New idea — IdeaForge" },
      {
        name: "description",
        content:
          "Drop your concept and a napkin sketch. IdeaForge runs a multimodal vetting pass and returns an opportunity report.",
      },
    ],
  }),
  component: IntakePage,
});

const makeIdeaSchema = (min: number, max: number) =>
  z.object({
    idea: z
      .string()
      .trim()
      .min(min, { message: "intake.errMin" })
      .max(max, { message: "intake.errMax" }),
    email: z
      .string()
      .trim()
      .max(255)
      .email({ message: "intake.errEmail" })
      .optional()
      .or(z.literal("").transform(() => undefined)),
  });

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB
const ACCEPTED = ["image/png", "image/jpeg", "image/webp", "image/heic"];

function IntakePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { refine } = Route.useSearch();
  const fileInput = useRef<HTMLInputElement>(null);

  const refineProject = useMemo(() => (refine ? getProject(refine) : undefined), [refine]);
  const prevOverall = overallScore(refineProject?.scores);
  const iterationCount = (refineProject?.iterations?.length ?? 0) + 1;

  const [idea, setIdea] = useState(refineProject?.idea ?? "");
  useEffect(() => {
    if (refineProject) return;
    if (typeof window === "undefined") return;
    const draft = sessionStorage.getItem("idea-draft");
    if (draft) {
      setIdea(draft);
      sessionStorage.removeItem("idea-draft");
    }
    const emailDraft = sessionStorage.getItem("idea-email");
    if (emailDraft) {
      setEmail(emailDraft);
      sessionStorage.removeItem("idea-email");
    }
  }, [refineProject]);
  const [email, setEmail] = useState(refineProject?.email ?? "");
  const [sketch, setSketch] = useState<{ file: File; url: string } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [refining, setRefining] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [mode, setMode] = useState<"quick" | "detailed">("quick");
  const [refineHint, setRefineHint] = useState<string | null>(null);
  const refineFn = useServerFn(refineIdea);
  const enhanceFn = useServerFn(enhanceIdea);

  const onRefine = async () => {
    if (idea.trim().length < 5) {
      setError(t("intake.errWriteMore"));
      return;
    }
    setError(null);
    setRefineHint(null);
    setRefining(true);
    try {
      const result = await refineFn({ data: { idea: idea.trim() } });
      setIdea(result.refined);
      if (result.question) setRefineHint(result.question);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("intake.errRefine"));
    } finally {
      setRefining(false);
    }
  };

  const onEnhance = async () => {
    if (idea.trim().length < 5) {
      setError(t("intake.errWriteMore"));
      return;
    }
    setError(null);
    setEnhancing(true);
    try {
      const result = await enhanceFn({ data: { idea: idea.trim(), mode } });
      if (!result.ok) {
        setError(result.error ?? "Enhance failed");
      } else {
        setIdea(result.refined);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enhance failed");
    } finally {
      setEnhancing(false);
    }
  };


  const onPickFile = useCallback((file: File | undefined) => {
    if (!file) return;
    if (!ACCEPTED.includes(file.type)) {
      setError(t("intake.errSketchType"));
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError(t("intake.errSketchSize"));
      return;
    }
    setError(null);
    const url = URL.createObjectURL(file);
    setSketch((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return { file, url };
    });
  }, [t]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    onPickFile(e.dataTransfer.files?.[0]);
  };

  const removeSketch = () => {
    if (sketch) URL.revokeObjectURL(sketch.url);
    setSketch(null);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = makeIdeaSchema(charRange.min, charRange.max).safeParse({ idea, email });
    if (!parsed.success) {
      const msg = parsed.error.issues[0].message;
      const translated = msg.startsWith("intake.")
        ? t(msg, { min: charRange.min, max: charRange.max })
        : msg;
      setError(translated);
      return;
    }
    setError(null);
    setSubmitting(true);
    const { createProject, updateProject, deriveTitle } = await import("@/lib/projects");
    if (refineProject) {
      updateProject(refineProject.id, {
        idea: parsed.data.idea,
        title: deriveTitle(parsed.data.idea),
        sketchName: sketch?.file.name ?? refineProject.sketchName,
        email: parsed.data.email ?? refineProject.email,
        analysis: undefined,
        status: "vetting",
      });
      navigate({ to: "/vetting", search: { id: refineProject.id } });
      return;
    }
    const project = createProject({
      idea: parsed.data.idea,
      sketchName: sketch?.file.name,
      email: parsed.data.email,
    });
    navigate({ to: "/vetting", search: { id: project.id } });
  };

  const chars = idea.trim().length;
  const [charRange, setCharRange] = useState(() => getIntakeCharRange());
  useEffect(() => {
    const sync = () => setCharRange(getIntakeCharRange());
    window.addEventListener("storage", sync);
    window.addEventListener("focus", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("focus", sync);
    };
  }, []);


  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto max-w-7xl px-6 py-5 flex items-center justify-between">
          <HeaderBrand />
          <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground transition">
            {t("intake.skipDashboard")}
          </Link>
        </div>
      </header>

      <section
        aria-hidden
        className="absolute inset-x-0 -z-10 h-[480px]"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 70% 60% at 50% 0%, oklch(0.68 0.19 38 / 0.18), transparent 60%)",
        }}
      />

      <section className="mx-auto max-w-3xl px-6 pt-16 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="text-center"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-ember" />
            {refineProject ? t("intake.badgeRefine", { n: iterationCount }) : t("intake.badgeMultimodal")}
          </span>
          <h1 className="mt-6 font-display text-4xl sm:text-5xl font-semibold text-balance leading-[1.05]">
            {refineProject ? t("intake.titleRefine") : t("intake.title")}
          </h1>
          <p className="mt-4 text-muted-foreground">
            {refineProject ? t("intake.subtitleRefine") : t("intake.subtitle")}
          </p>
          {refineProject && prevOverall !== null && (
            <div className="mt-6 inline-flex items-center gap-3 rounded-2xl border border-border bg-card/60 px-4 py-2.5 text-left">
              <History className="h-4 w-4 text-ember" />
              <div className="text-xs text-muted-foreground">
                {t("intake.prevScore")}{" "}
                <span className="font-display text-sm font-semibold text-foreground">
                  {prevOverall}/100
                </span>{" "}
                · "{refineProject.title}"
              </div>
            </div>
          )}
        </motion.div>



        <motion.form
          onSubmit={onSubmit}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="mt-12 rounded-3xl border border-border bg-card/80 p-2 shadow-elegant"
        >
          <div className="rounded-[1.25rem] bg-background/60 p-5">
            <label htmlFor="idea" className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              {t("intake.concept")}
            </label>
            <textarea
              id="idea"
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              rows={6}
              maxLength={charRange.max}
              placeholder={t("intake.ideaPlaceholder")}
              className="mt-2 w-full resize-none bg-transparent text-base placeholder:text-muted-foreground/60 focus:outline-none"
            />
            <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={onRefine}
                  disabled={refining || idea.trim().length < 5}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent/40 transition disabled:opacity-50"
                >
                  <Wand2 className="h-3.5 w-3.5 text-ember" />
                  {refining ? t("intake.refining") : t("intake.refineAI")}
                </button>
                <button
                  type="button"
                  onClick={onEnhance}
                  disabled={enhancing || idea.trim().length < 5}
                  className="inline-flex items-center gap-1.5 rounded-full border border-indigo/40 bg-indigo/10 px-3 py-1 text-xs text-indigo hover:bg-indigo/20 transition disabled:opacity-50"
                >
                  <Zap className="h-3.5 w-3.5" />
                  {enhancing ? "Enhancing…" : "Enhance with AI"}
                </button>
                <div className="inline-flex overflow-hidden rounded-full border border-border text-[10px]">
                  <button
                    type="button"
                    onClick={() => setMode("quick")}
                    className={`px-2.5 py-1 transition ${mode === "quick" ? "bg-surface-2 text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    Quick
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("detailed")}
                    className={`px-2.5 py-1 transition ${mode === "detailed" ? "bg-surface-2 text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    Detailed
                  </button>
                </div>
              </div>
              <span className={"text-[11px] " + (chars > 0 && chars < charRange.min ? "text-ember" : "text-muted-foreground")}>
                {chars > 0 && chars < charRange.min ? t("intake.tipChars") : ""}
                {chars}/{charRange.max}
              </span>
            </div>
            {refineHint && (
              <p className="mt-2 rounded-lg border border-ember/30 bg-ember/5 px-3 py-2 text-xs text-foreground/80">
                <span className="text-ember">{t("intake.followUp")}</span> {refineHint}
              </p>
            )}

            <div className="mt-6">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                {t("intake.sketch")} <span className="normal-case text-muted-foreground/60">{t("intake.optional")}</span>
              </p>

              {sketch ? (
                <div className="mt-3 relative overflow-hidden rounded-2xl border border-border">
                  <img
                    src={sketch.url}
                    alt="Uploaded sketch preview"
                    className="block w-full max-h-[360px] object-contain bg-background"
                  />
                  <button
                    type="button"
                    onClick={removeSketch}
                    className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full bg-background/80 backdrop-blur border border-border px-2.5 py-1 text-xs hover:bg-accent transition"
                  >
                    <X className="h-3.5 w-3.5" /> {t("intake.remove")}
                  </button>
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-background/90 to-transparent px-4 py-2 text-[11px] text-muted-foreground">
                    {sketch.file.name} · {(sketch.file.size / 1024).toFixed(0)} KB
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={onDrop}
                  className={
                    "mt-3 w-full rounded-2xl border border-dashed px-6 py-10 text-center transition " +
                    (dragOver
                      ? "border-ember/60 bg-ember/5"
                      : "border-border bg-background/40 hover:bg-accent/40")
                  }
                >
                  <ImagePlus className="mx-auto h-6 w-6 text-ember" />
                  <p className="mt-3 text-sm">
                    {t("intake.dropSketch")} <span className="text-ember">{t("intake.browse")}</span>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("intake.sketchFormats")}
                  </p>
                </button>
              )}

              <input
                ref={fileInput}
                type="file"
                accept={ACCEPTED.join(",")}
                className="hidden"
                onChange={(e) => onPickFile(e.target.files?.[0] ?? undefined)}
              />
            </div>

            <div className="mt-6">
              <label htmlFor="email" className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                {t("intake.email")} <span className="normal-case text-muted-foreground/60">{t("intake.emailOptional")}</span>
              </label>
              <div className="mt-2 flex items-center gap-2 rounded-xl border border-border bg-background/40 px-3 py-2 focus-within:border-ember/60">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <input
                  id="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  maxLength={255}
                  placeholder={t("intake.emailPlaceholder")}
                  className="w-full bg-transparent text-sm placeholder:text-muted-foreground/60 focus:outline-none"
                />
              </div>
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                {t("intake.emailHelp")}
              </p>
            </div>

            {error && (
              <p className="mt-4 text-sm text-ember" role="alert">
                {error}
              </p>
            )}

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                {t("intake.privacy")}
              </p>
              <button
                type="submit"
                disabled={submitting}
                className="group inline-flex items-center gap-2 rounded-full bg-gradient-ember px-5 py-2.5 text-sm font-medium text-ember-foreground shadow-ember hover:brightness-110 transition disabled:opacity-60"
              >
                {submitting ? t("intake.forging") : t("intake.runVetting")}
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </button>
            </div>
          </div>
        </motion.form>
      </section>
    </main>
  );
}
