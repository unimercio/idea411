import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { ArrowRight, Flame, ImagePlus, Sparkles, X, History, Mail } from "lucide-react";
import { z } from "zod";
import { getProject, overallScore } from "@/lib/projects";

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

const ideaSchema = z.object({
  idea: z
    .string()
    .trim()
    .min(20, { message: "Tell us a little more — at least 20 characters." })
    .max(2000, { message: "Keep it under 2000 characters." }),
  email: z
    .string()
    .trim()
    .max(255)
    .email({ message: "Enter a valid email address." })
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB
const ACCEPTED = ["image/png", "image/jpeg", "image/webp", "image/heic"];

function IntakePage() {
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

  const onPickFile = useCallback((file: File | undefined) => {
    if (!file) return;
    if (!ACCEPTED.includes(file.type)) {
      setError("Sketches must be PNG, JPEG, or WEBP.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError("Sketch must be under 8 MB.");
      return;
    }
    setError(null);
    const url = URL.createObjectURL(file);
    setSketch((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return { file, url };
    });
  }, []);

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
    const parsed = ideaSchema.safeParse({ idea, email });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
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

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto max-w-7xl px-6 py-5 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-display font-semibold">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-gradient-ember text-ember-foreground shadow-ember">
              <Flame className="h-4 w-4" />
            </span>
            IdeaForge
          </Link>
          <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground transition">
            Skip to dashboard →
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
            {refineProject ? `Refining · iteration ${iterationCount}` : "Multimodal vetting · text + sketch"}
          </span>
          <h1 className="mt-6 font-display text-4xl sm:text-5xl font-semibold text-balance leading-[1.05]">
            {refineProject ? "Sharpen the concept." : "Bring the spark. We'll forge the rest."}
          </h1>
          <p className="mt-4 text-muted-foreground">
            {refineProject
              ? "Your previous report, scores, and chat history are preserved. Edit the idea below and we'll re-vet it as a new iteration."
              : "Describe your concept and drop a napkin sketch. IdeaForge runs compliance, market fit, and demand scans in seconds."}
          </p>
          {refineProject && prevOverall !== null && (
            <div className="mt-6 inline-flex items-center gap-3 rounded-2xl border border-border bg-card/60 px-4 py-2.5 text-left">
              <History className="h-4 w-4 text-ember" />
              <div className="text-xs text-muted-foreground">
                Previous score{" "}
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
              The concept
            </label>
            <textarea
              id="idea"
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              rows={6}
              maxLength={2000}
              placeholder="A modular ceramic cookware system that retains heat 3× longer than cast iron…"
              className="mt-2 w-full resize-none bg-transparent text-base placeholder:text-muted-foreground/60 focus:outline-none"
            />
            <div className="mt-1 flex justify-end text-[11px] text-muted-foreground">
              {chars}/2000
            </div>

            <div className="mt-6">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Napkin sketch <span className="normal-case text-muted-foreground/60">— optional</span>
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
                    <X className="h-3.5 w-3.5" /> Remove
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
                    Drop your sketch here, or <span className="text-ember">browse</span>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    PNG, JPEG or WEBP · up to 8 MB
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
                Email <span className="normal-case text-muted-foreground/60">— optional, so we can send you the report</span>
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
                  placeholder="you@company.com"
                  className="w-full bg-transparent text-sm placeholder:text-muted-foreground/60 focus:outline-none"
                />
              </div>
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                We'll email a link to your vetting report so you can pick it back up after a refresh.
              </p>
            </div>

            {error && (
              <p className="mt-4 text-sm text-ember" role="alert">
                {error}
              </p>
            )}

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                Your idea stays private. Vetting takes ~20 seconds.
              </p>
              <button
                type="submit"
                disabled={submitting}
                className="group inline-flex items-center gap-2 rounded-full bg-gradient-ember px-5 py-2.5 text-sm font-medium text-ember-foreground shadow-ember hover:brightness-110 transition disabled:opacity-60"
              >
                {submitting ? "Forging…" : "Run vetting"}
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </button>
            </div>
          </div>
        </motion.form>
      </section>
    </main>
  );
}
