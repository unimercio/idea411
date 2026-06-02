import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Flame, Mail } from "lucide-react";
import { useEffect, useState } from "react";
import { z } from "zod";
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
  const navigate = useNavigate();
  const { redirect: redirectTo } = Route.useSearch();
  const dest = redirectTo && redirectTo.startsWith("/") ? redirectTo : "/dashboard";
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  // Redirect when authenticated
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: dest, replace: true });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) navigate({ to: dest, replace: true });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate, dest]);


  const friendlyError = (msg: string) => {
    if (/rate limit|after \d+ seconds/i.test(msg)) {
      return "We just sent you a confirmation email. Please wait a minute before trying again, and check your inbox (including spam).";
    }
    if (/already registered|already exists/i.test(msg)) {
      return "An account with that email already exists. Try signing in instead.";
    }
    return msg;
  };

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/dashboard` },
        });
        if (error) throw error;
        setSentTo(email);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Signed in.");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Authentication failed";
      toast.error(friendlyError(msg));
    } finally {
      setLoading(false);
    }
  };


  const handleGoogle = async () => {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin + "/dashboard",
      });
      if (result.error) {
        toast.error(result.error.message || "Google sign-in failed");
        setLoading(false);
      }
      // If redirected or session set, listener handles navigation.
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Google sign-in failed");
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
              <h1 className="mt-5 font-display text-2xl font-semibold">Check your email</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                We sent a confirmation link to <span className="text-foreground">{sentTo}</span>.
                Click it to activate your account, then return here to sign in.
              </p>
              <p className="mt-4 text-xs text-muted-foreground">
                Didn't get it? Check your spam folder. You can request a new link in about a minute.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSentTo(null);
                  setMode("signin");
                  setPassword("");
                }}
                className="mt-6 inline-flex items-center justify-center rounded-full border border-border bg-secondary/60 px-4 py-2 text-sm hover:bg-accent transition"
              >
                Back to sign in
              </button>
            </div>
          ) : (
            <>
              <h1 className="font-display text-2xl font-semibold text-center">
                {mode === "signin" ? "Welcome back" : "Create your account"}
              </h1>
              <p className="mt-2 text-center text-sm text-muted-foreground">
                {mode === "signin" ? "Sign in to continue forging." : "Start forging your ideas today."}
              </p>

              <button
                onClick={handleGoogle}
                disabled={loading}
                className="mt-8 w-full inline-flex items-center justify-center gap-2 rounded-full border border-border bg-secondary/60 px-4 py-2.5 text-sm hover:bg-accent transition disabled:opacity-50"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
                  <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.42-1.7 4.16-5.5 4.16-3.31 0-6-2.74-6-6.12 0-3.38 2.69-6.12 6-6.12 1.88 0 3.14.8 3.86 1.49l2.63-2.54C16.84 3.36 14.66 2.4 12 2.4 6.76 2.4 2.5 6.66 2.5 11.9c0 5.24 4.26 9.5 9.5 9.5 5.48 0 9.12-3.85 9.12-9.27 0-.62-.07-1.1-.16-1.58H12z" />
                </svg>
                Continue with Google
              </button>

              <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
                <div className="h-px flex-1 bg-border" />
                or
                <div className="h-px flex-1 bg-border" />
              </div>

              <form onSubmit={handleEmail} className="space-y-3">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@domain.com"
                  className="w-full rounded-full border border-border bg-background/60 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password (min 6 chars)"
                  className="w-full rounded-full border border-border bg-background/60 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-gradient-ember px-4 py-2.5 text-sm font-medium text-ember-foreground shadow-ember hover:brightness-110 transition disabled:opacity-50"
                >
                  <Mail className="h-4 w-4" />
                  {loading ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
                </button>
              </form>

              <p className="mt-6 text-center text-xs text-muted-foreground">
                {mode === "signin" ? "New here?" : "Already have an account?"}{" "}
                <button
                  type="button"
                  onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
                  className="text-foreground hover:underline"
                >
                  {mode === "signin" ? "Create an account" : "Sign in"}
                </button>
              </p>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          <Link to="/" className="hover:text-foreground transition">← Back to home</Link>
        </p>
      </div>
    </main>
  );
}
