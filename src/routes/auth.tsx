import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Flame, Mail } from "lucide-react";
import { useEffect, useState } from "react";
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
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: dest, replace: true });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) navigate({ to: dest, replace: true });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate, dest]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [resendCooldown]);

  const friendlyError = (msg: string) => {
    if (/rate limit|after \d+ seconds|too many/i.test(msg)) return t("auth.errRateLimit");
    if (/already registered|already exists|user.*exists/i.test(msg)) return t("auth.errExists");
    if (/invalid login|invalid.*credentials/i.test(msg)) return t("auth.errInvalidCreds");
    if (/email not confirmed|confirm.*email/i.test(msg)) return t("auth.errEmailNotConfirmed");
    if (/invalid.*email|email.*invalid/i.test(msg)) return t("auth.errInvalidEmail");
    if (/password.*(short|6|length)/i.test(msg)) return t("auth.errPasswordShort");
    return msg;
  };

  const validate = (): string | null => {
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
    if (!emailOk) return t("auth.errInvalidEmail");
    if (password.length < 6) return t("auth.errPasswordShort");
    if (mode === "signup" && password !== confirmPassword) return t("auth.errPasswordMismatch");
    return null;
  };

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    const v = validate();
    if (v) {
      setFieldError(v);
      return;
    }
    setFieldError(null);
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}${dest}` },
        });
        if (error) throw error;
        setSentTo(email);
        setResendCooldown(60);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success(t("auth.signedIn"));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("auth.errAuth");
      const friendly = friendlyError(msg);
      setFieldError(friendly);
      toast.error(friendly);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!sentTo || resending || resendCooldown > 0) return;
    setResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: sentTo,
        options: { emailRedirectTo: `${window.location.origin}${dest}` },
      });
      if (error) throw error;
      toast.success(t("auth.resendSent"));
      setResendCooldown(60);
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("auth.resendFailed");
      toast.error(friendlyError(msg));
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
              <div className="mt-6 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resending || resendCooldown > 0}
                  className="inline-flex items-center justify-center rounded-full bg-gradient-ember px-4 py-2 text-sm font-medium text-ember-foreground shadow-ember hover:brightness-110 transition disabled:opacity-50"
                >
                  {resending
                    ? t("auth.resending")
                    : resendCooldown > 0
                      ? t("auth.resendCooldown", { seconds: resendCooldown })
                      : t("auth.resendEmail")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSentTo(null);
                    setMode("signin");
                    setPassword("");
                    setConfirmPassword("");
                    setFieldError(null);
                  }}
                  className="inline-flex items-center justify-center rounded-full border border-border bg-secondary/60 px-4 py-2 text-sm hover:bg-accent transition"
                >
                  {t("auth.backToSignIn")}
                </button>
              </div>
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

              <form onSubmit={handleEmail} className="space-y-3">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("auth.emailPlaceholder")}
                  className="w-full rounded-full border border-border bg-background/60 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("auth.passwordPlaceholder")}
                  className="w-full rounded-full border border-border bg-background/60 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
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
