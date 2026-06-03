import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AlertCircle, Flame, Mail } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { toast } from "sonner";

const searchSchema = z.object({
  redirect: z.string().trim().min(1).max(512).optional().catch(undefined),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Sign in — IdeaForge" },
      { name: "description", content: "Sign in or create an IdeaForge account." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { redirect: redirectTo } = Route.useSearch();
  const dest = redirectTo && redirectTo.startsWith("/") ? redirectTo : "/dashboard";
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [formError, setFormError] = useState<{ message: string; action?: "resend" | "switch-signup" | "switch-signin" } | null>(null);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: dest, replace: true });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) navigate({ to: dest, replace: true });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate, dest]);

  // Clear field errors when user edits
  useEffect(() => { setEmailError(null); setFormError(null); }, [email]);
  useEffect(() => { setPasswordError(null); setFormError(null); }, [password]);
  // Clear all errors on mode switch
  useEffect(() => { setEmailError(null); setPasswordError(null); setFormError(null); }, [mode]);

  const passwordRules = useMemo(() => {
    const pw = password;
    return [
      { label: "At least 8 characters", ok: pw.length >= 8 },
      { label: "Contains a letter", ok: /[a-zA-Z]/.test(pw) },
      { label: "Contains a number", ok: /\d/.test(pw) },
      { label: "Contains a symbol (recommended)", ok: /[^a-zA-Z0-9]/.test(pw) },
    ];
  }, [password]);

  type FieldKey = "email" | "password" | "form";
  type Mapped = { field: FieldKey; message: string; action?: "resend" | "switch-signup" | "switch-signin" };

  const mapAuthError = (err: unknown): Mapped => {
    const raw = err instanceof Error ? err.message : typeof err === "string" ? err : t("auth.errAuth");
    const code = (err as { code?: string } | null)?.code?.toLowerCase() ?? "";
    const status = (err as { status?: number } | null)?.status;
    const msg = raw.toLowerCase();

    if (code === "weak_password" || /weak.?password|pwned|compromised|leaked|haveibeenpwned|password.{0,30}breach/i.test(msg)) {
      return { field: "password", message: "This password is too weak or has appeared in a known data breach. Use at least 8 characters with a mix of letters, numbers, and a symbol." };
    }
    if (/password.{0,20}(too short|short|at least \d+|length|must be)/i.test(msg)) {
      const m = /at least (\d+)/i.exec(msg);
      return { field: "password", message: `Password is too short.${m ? ` Use at least ${m[1]} characters.` : " Use at least 6 characters."}` };
    }
    if (code === "email_not_confirmed" || /email.{0,10}not.{0,10}confirmed|confirm.{0,10}your.{0,10}email/i.test(msg)) {
      return { field: "form", message: "Your email isn't confirmed yet. Check your inbox (and spam) for the confirmation link.", action: "resend" };
    }
    if (code === "invalid_credentials" || /invalid.{0,10}credentials|invalid login/i.test(msg)) {
      return { field: "form", message: "Email or password is incorrect. If you just signed up, confirm your email first.", action: "switch-signup" };
    }
    if (code === "user_already_exists" || /already (registered|exists)|user.*exists/i.test(msg)) {
      return { field: "email", message: "An account with that email already exists. Try signing in instead.", action: "switch-signin" };
    }
    if (code === "validation_failed" || /invalid.{0,10}email|email.{0,10}invalid|valid email/i.test(msg)) {
      return { field: "email", message: "Please enter a valid email address." };
    }
    if (code === "over_email_send_rate_limit" || /rate limit|after \d+ seconds|too many/i.test(msg)) {
      return { field: "form", message: t("auth.errRateLimit") };
    }
    if (code === "signup_disabled" || /signup.{0,10}disabled|signups are not allowed/i.test(msg)) {
      return { field: "form", message: "New sign-ups are disabled. Please contact support." };
    }
    if (status === 0 || /failed to fetch|network|networkerror/i.test(msg)) {
      return { field: "form", message: "Network error — check your connection and try again." };
    }
    return { field: "form", message: raw };
  };

  const credentialsSchema = z.object({
    email: z.string().trim().min(1, "Email is required").email("Please enter a valid email address").max(255),
    password: z
      .string()
      .min(mode === "signup" ? 8 : 6, mode === "signup" ? "Use at least 8 characters" : "Password is too short")
      .max(72, "Password is too long (max 72 characters)"),
  });

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setEmailError(null);
    setPasswordError(null);
    setFormError(null);

    const parsed = credentialsSchema.safeParse({ email, password });
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors;
      if (flat.email?.[0]) setEmailError(flat.email[0]);
      if (flat.password?.[0]) setPasswordError(flat.password[0]);
      return;
    }

    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: { emailRedirectTo: `${window.location.origin}${dest}` },
        });
        if (error) throw error;
        setSentTo(parsed.data.email);
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: parsed.data.email,
          password: parsed.data.password,
        });
        if (error) throw error;
        toast.success(t("auth.signedIn"));
      }
    } catch (err) {
      const mapped = mapAuthError(err);
      if (mapped.field === "email") setEmailError(mapped.message);
      else if (mapped.field === "password") setPasswordError(mapped.message);
      else setFormError({ message: mapped.message, action: mapped.action });
    } finally {
      setLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    if (!email || resending) return;
    setResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: `${window.location.origin}${dest}` },
      });
      if (error) throw error;
      toast.success(`Confirmation email re-sent to ${email}`);
      setFormError(null);
    } catch (err) {
      const mapped = mapAuthError(err);
      setFormError({ message: mapped.message });
    } finally {
      setResending(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin + dest,
      });
      if (result.error) {
        toast.error(result.error.message || t("auth.errGoogle"));
        setLoading(false);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("auth.errGoogle"));
      setLoading(false);
    }
  };

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
          {sentTo ? (
            <div className="text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-gradient-ember text-ember-foreground shadow-ember">
                <Mail className="h-5 w-5" />
              </div>
              <h1 className="mt-5 font-display text-2xl font-semibold">{t("auth.checkEmail")}</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {t("auth.checkEmailBody", { email: sentTo })}
              </p>
              <p className="mt-4 text-xs text-muted-foreground">{t("auth.checkEmailSpam")}</p>
              <button
                type="button"
                onClick={() => {
                  setSentTo(null);
                  setMode("signin");
                  setPassword("");
                }}
                className="mt-6 inline-flex items-center justify-center rounded-full border border-border bg-secondary/60 px-4 py-2 text-sm hover:bg-accent transition"
              >
                {t("auth.backToSignIn")}
              </button>
            </div>
          ) : (
            <>
              <h1 className="font-display text-2xl font-semibold text-center">
                {mode === "signin" ? t("auth.welcomeBack") : t("auth.createAccount")}
              </h1>
              <p className="mt-2 text-center text-sm text-muted-foreground">
                {mode === "signin" ? t("auth.signInSubtitle") : t("auth.signUpSubtitle")}
              </p>

              <button
                onClick={handleGoogle}
                disabled={loading}
                className="mt-8 w-full inline-flex items-center justify-center gap-2 rounded-full border border-border bg-secondary/60 px-4 py-2.5 text-sm hover:bg-accent transition disabled:opacity-50"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
                  <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.42-1.7 4.16-5.5 4.16-3.31 0-6-2.74-6-6.12 0-3.38 2.69-6.12 6-6.12 1.88 0 3.14.8 3.86 1.49l2.63-2.54C16.84 3.36 14.66 2.4 12 2.4 6.76 2.4 2.5 6.66 2.5 11.9c0 5.24 4.26 9.5 9.5 9.5 5.48 0 9.12-3.85 9.12-9.27 0-.62-.07-1.1-.16-1.58H12z" />
                </svg>
                {t("auth.continueGoogle")}
              </button>

              <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
                <div className="h-px flex-1 bg-border" />
                {t("common.or")}
                <div className="h-px flex-1 bg-border" />
              </div>

              <form onSubmit={handleEmail} noValidate className="space-y-3">
                {formError && (
                  <div
                    role="alert"
                    className="flex gap-2 rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
                  >
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <div className="flex-1 space-y-2">
                      <p>{formError.message}</p>
                      {formError.action === "resend" && (
                        <button
                          type="button"
                          onClick={handleResendConfirmation}
                          disabled={resending || !email}
                          className="inline-flex items-center rounded-full border border-destructive/40 bg-background/40 px-3 py-1 text-xs font-medium text-foreground hover:bg-accent disabled:opacity-50"
                        >
                          {resending ? "Sending…" : "Resend confirmation email"}
                        </button>
                      )}
                      {formError.action === "switch-signup" && (
                        <button
                          type="button"
                          onClick={() => setMode("signup")}
                          className="inline-flex items-center rounded-full border border-destructive/40 bg-background/40 px-3 py-1 text-xs font-medium text-foreground hover:bg-accent"
                        >
                          Create an account instead
                        </button>
                      )}
                      {formError.action === "switch-signin" && (
                        <button
                          type="button"
                          onClick={() => setMode("signin")}
                          className="inline-flex items-center rounded-full border border-destructive/40 bg-background/40 px-3 py-1 text-xs font-medium text-foreground hover:bg-accent"
                        >
                          Sign in instead
                        </button>
                      )}
                    </div>
                  </div>
                )}

                <div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t("auth.emailPlaceholder")}
                    aria-invalid={!!emailError}
                    aria-describedby={emailError ? "email-error" : undefined}
                    className={`w-full rounded-full border bg-background/60 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring ${
                      emailError ? "border-destructive focus:ring-destructive" : "border-border"
                    }`}
                  />
                  {emailError && (
                    <p id="email-error" role="alert" className="mt-1.5 px-3 text-xs text-destructive">
                      {emailError}
                    </p>
                  )}
                </div>

                <div>
                  <input
                    type="password"
                    required
                    minLength={mode === "signup" ? 8 : 6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t("auth.passwordPlaceholder")}
                    aria-invalid={!!passwordError}
                    aria-describedby={passwordError ? "password-error" : mode === "signup" ? "password-rules" : undefined}
                    className={`w-full rounded-full border bg-background/60 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring ${
                      passwordError ? "border-destructive focus:ring-destructive" : "border-border"
                    }`}
                  />
                  {passwordError && (
                    <p id="password-error" role="alert" className="mt-1.5 px-3 text-xs text-destructive">
                      {passwordError}
                    </p>
                  )}
                  {password.length > 0 && (
                    <PasswordStrength password={password} showMeter={mode === "signup"} />
                  )}
                  {mode === "signup" && !passwordError && password.length > 0 && (
                    <ul id="password-rules" className="mt-2 space-y-0.5 px-3 text-xs">
                      {passwordRules.map((r) => (
                        <li key={r.label} className={r.ok ? "text-muted-foreground" : "text-muted-foreground/70"}>
                          <span className={`mr-1.5 ${r.ok ? "text-ember" : "text-muted-foreground/50"}`}>
                            {r.ok ? "✓" : "○"}
                          </span>
                          {r.label}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-gradient-ember px-4 py-2.5 text-sm font-medium text-ember-foreground shadow-ember hover:brightness-110 transition disabled:opacity-50"
                >
                  <Mail className="h-4 w-4" />
                  {loading ? t("auth.pleaseWait") : mode === "signin" ? t("auth.signInBtn") : t("auth.createBtn")}
                </button>
              </form>

              <p className="mt-6 text-center text-xs text-muted-foreground">
                {mode === "signin" ? t("auth.newHere") : t("auth.alreadyHave")}{" "}
                <button
                  type="button"
                  onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
                  className="text-foreground hover:underline"
                >
                  {mode === "signin" ? t("auth.createAccountLink") : t("auth.signInLink")}
                </button>
              </p>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          <Link to="/" className="hover:text-foreground transition">{t("common.backToHome")}</Link>
        </p>
      </div>
    </main>
  );
}
