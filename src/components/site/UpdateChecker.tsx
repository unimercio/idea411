import { useEffect, useRef } from "react";
import { toast } from "sonner";

/**
 * Lightweight "new version available" checker.
 *
 * Polls the served HTML document with a HEAD request and watches `ETag` /
 * `Last-Modified`. When the value changes vs. what was seen at first load,
 * the user is shown a persistent toast with a "Refresh" action.
 *
 * - Client-only (guards on `window`).
 * - Disabled in dev, inside iframes, and on Lovable preview hostnames so the
 *   editor preview doesn't constantly nag.
 * - No service worker — works with the project's manifest-only PWA setup.
 */
const POLL_MS = 60_000;
const TOAST_ID = "app-update-available";

function isPreviewLikeHost(host: string) {
  return (
    host.startsWith("id-preview--") ||
    host.startsWith("preview--") ||
    host === "lovableproject.com" ||
    host.endsWith(".lovableproject.com") ||
    host === "lovableproject-dev.com" ||
    host.endsWith(".lovableproject-dev.com") ||
    host === "beta.lovable.dev" ||
    host.endsWith(".beta.lovable.dev")
  );
}

function shouldRun() {
  if (typeof window === "undefined") return false;
  if (!import.meta.env.PROD) return false;
  try {
    if (window.self !== window.top) return false;
  } catch {
    return false;
  }
  if (isPreviewLikeHost(window.location.hostname)) return false;
  return true;
}

async function fetchVersionToken(): Promise<string | null> {
  try {
    const res = await fetch(`/?_v=${Date.now()}`, {
      method: "HEAD",
      cache: "no-store",
      credentials: "same-origin",
    });
    if (!res.ok) return null;
    return (
      res.headers.get("etag") ||
      res.headers.get("last-modified") ||
      res.headers.get("x-build-id") ||
      null
    );
  } catch {
    return null;
  }
}

export function UpdateChecker() {
  const initialRef = useRef<string | null>(null);
  const notifiedRef = useRef(false);

  useEffect(() => {
    if (!shouldRun()) return;

    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const notify = () => {
      if (notifiedRef.current) return;
      notifiedRef.current = true;
      toast("A new version of IdeaForge is available", {
        id: TOAST_ID,
        description: "Refresh to load the latest build.",
        duration: Infinity,
        action: {
          label: "Refresh",
          onClick: () => window.location.reload(),
        },
      });
    };

    const check = async () => {
      const token = await fetchVersionToken();
      if (cancelled || !token) return;
      if (initialRef.current === null) {
        initialRef.current = token;
        return;
      }
      if (token !== initialRef.current) notify();
    };

    void check();
    timer = setInterval(() => void check(), POLL_MS);

    const onVisibility = () => {
      if (document.visibilityState === "visible") void check();
    };
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return null;
}
