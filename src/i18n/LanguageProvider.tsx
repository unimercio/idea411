import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { applyLanguage } from "./index";

/**
 * Initializes i18n on mount, then syncs with the signed-in user's preferred
 * language stored on their profile. Falls back to localStorage / browser locale.
 */
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Apply locally-stored or detected language immediately on mount.
    applyLanguage(
      (typeof window !== "undefined" &&
        window.localStorage.getItem("ideaforge.lang")) ||
        (typeof navigator !== "undefined" ? navigator.language.slice(0, 2) : "en"),
    );

    const loadProfileLang = async () => {
      const { data: sess } = await supabase.auth.getSession();
      const userId = sess.session?.user?.id;
      if (!userId) return;
      const { data } = await supabase
        .from("profiles")
        .select("language")
        .eq("user_id", userId)
        .maybeSingle();
      if (data?.language) applyLanguage(data.language);
    };
    loadProfileLang();

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.user?.id) loadProfileLang();
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return <>{children}</>;
}
