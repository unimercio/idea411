import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { SUPPORTED_LANGUAGES, applyLanguage } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";
import { updateMyLanguage } from "@/lib/api/settings.functions";

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { i18n } = useTranslation();
  const [isAuthed, setIsAuthed] = useState(false);
  const updateLang = useServerFn(updateMyLanguage);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setIsAuthed(!!data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (mounted) setIsAuthed(!!s);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const onChange = async (code: string) => {
    applyLanguage(code);
    if (isAuthed) {
      try {
        await updateLang({ data: { language: code } });
      } catch {
        // non-fatal; local + storage already applied
      }
    }
  };

  return (
    <label
      className={
        "inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground " +
        (compact ? "px-1" : "px-1 sm:px-2")
      }
    >
      <Globe className="h-4 w-4" aria-hidden />
      <span className="sr-only">Language</span>
      <select
        value={i18n.language?.slice(0, 2) || "en"}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent text-sm focus:outline-none cursor-pointer uppercase"
        aria-label="Language"
      >
        {SUPPORTED_LANGUAGES.map((l) => (
          <option key={l.code} value={l.code} className="bg-background text-foreground" title={l.native}>
            {l.code.toUpperCase()}
          </option>
        ))}
      </select>
    </label>
  );
}


