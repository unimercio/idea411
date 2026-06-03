import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ShieldCheck, Loader2 } from "lucide-react";

type Strength = {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  colorClass: string;
};

function scorePassword(pw: string): Strength {
  if (!pw) return { score: 0, label: "", colorClass: "bg-muted" };
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  const variety =
    (/[a-z]/.test(pw) ? 1 : 0) +
    (/[A-Z]/.test(pw) ? 1 : 0) +
    (/\d/.test(pw) ? 1 : 0) +
    (/[^a-zA-Z0-9]/.test(pw) ? 1 : 0);
  if (variety >= 2) s++;
  if (variety >= 3) s++;
  if (variety >= 4 && pw.length >= 14) s++;
  // Penalize obviously weak patterns
  if (/^(.)\1+$/.test(pw) || /^(123|abc|qwerty|password|letmein)/i.test(pw)) s = Math.min(s, 1);
  const score = Math.max(0, Math.min(4, s)) as Strength["score"];
  const map: Record<Strength["score"], { label: string; colorClass: string }> = {
    0: { label: "Very weak", colorClass: "bg-destructive" },
    1: { label: "Weak", colorClass: "bg-destructive" },
    2: { label: "Fair", colorClass: "bg-amber-500" },
    3: { label: "Strong", colorClass: "bg-emerald-500" },
    4: { label: "Very strong", colorClass: "bg-emerald-500" },
  };
  return { score, ...map[score] };
}

async function sha1Hex(input: string): Promise<string> {
  const enc = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-1", enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

// HIBP k-anonymity: send only the first 5 chars of the SHA-1 hash.
// The full password never leaves the browser.
async function checkPwned(password: string, signal: AbortSignal): Promise<number | null> {
  if (password.length < 6) return null;
  const hash = await sha1Hex(password);
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);
  const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
    headers: { "Add-Padding": "true" },
    signal,
  });
  if (!res.ok) throw new Error(`HIBP ${res.status}`);
  const text = await res.text();
  for (const line of text.split("\n")) {
    const [suf, count] = line.trim().split(":");
    if (suf === suffix) return parseInt(count ?? "0", 10) || 0;
  }
  return 0;
}

export function PasswordStrength({
  password,
  showMeter = true,
  className = "",
}: {
  password: string;
  showMeter?: boolean;
  className?: string;
}) {
  const strength = useMemo(() => scorePassword(password), [password]);
  const [pwned, setPwned] = useState<number | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setError(null);
    if (password.length < 6) {
      setPwned(null);
      setChecking(false);
      return;
    }
    // Debounce check
    const t = setTimeout(() => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setChecking(true);
      checkPwned(password, ctrl.signal)
        .then((count) => {
          if (!ctrl.signal.aborted) setPwned(count);
        })
        .catch((err) => {
          if (ctrl.signal.aborted || (err as Error).name === "AbortError") return;
          setError("Couldn't check breach database");
          setPwned(null);
        })
        .finally(() => {
          if (!ctrl.signal.aborted) setChecking(false);
        });
    }, 450);
    return () => {
      clearTimeout(t);
      abortRef.current?.abort();
    };
  }, [password]);

  if (!password) return null;

  return (
    <div className={`mt-2 space-y-1.5 px-1 ${className}`}>
      {showMeter && (
        <div>
          <div className="flex h-1.5 gap-1" aria-hidden>
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`h-full flex-1 rounded-full transition-colors ${
                  i < Math.max(1, strength.score) ? strength.colorClass : "bg-muted"
                }`}
              />
            ))}
          </div>
          <div className="mt-1 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Password strength</span>
            <span
              className={
                strength.score >= 3
                  ? "text-emerald-500"
                  : strength.score >= 2
                  ? "text-amber-500"
                  : "text-destructive"
              }
            >
              {strength.label}
            </span>
          </div>
        </div>
      )}

      <div role="status" aria-live="polite" className="text-xs">
        {checking && (
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Checking against breach database…
          </span>
        )}
        {!checking && pwned !== null && pwned > 0 && (
          <span className="inline-flex items-start gap-1.5 text-destructive">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              This password has appeared in <strong>{pwned.toLocaleString()}</strong> known data
              breaches. Choose a different one.
            </span>
          </span>
        )}
        {!checking && pwned === 0 && strength.score >= 2 && (
          <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-500">
            <ShieldCheck className="h-3.5 w-3.5" />
            Not found in known breaches.
          </span>
        )}
        {!checking && error && (
          <span className="text-muted-foreground">{error}</span>
        )}
      </div>
    </div>
  );
}
