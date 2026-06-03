import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import es from "./locales/es.json";
import fr from "./locales/fr.json";
import de from "./locales/de.json";
import pt from "./locales/pt.json";
import it from "./locales/it.json";

export const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English", native: "English", dir: "ltr" as const },
  { code: "es", label: "Spanish", native: "Español", dir: "ltr" as const },
  { code: "fr", label: "French", native: "Français", dir: "ltr" as const },
  { code: "de", label: "German", native: "Deutsch", dir: "ltr" as const },
  { code: "pt", label: "Portuguese", native: "Português", dir: "ltr" as const },
  { code: "it", label: "Italian", native: "Italiano", dir: "ltr" as const },
];

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]["code"];

const STORAGE_KEY = "ideaforge.lang";

function detectInitial(): string {
  if (typeof window === "undefined") return "en";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored && SUPPORTED_LANGUAGES.some((l) => l.code === stored)) return stored;
  const browser = window.navigator.language?.slice(0, 2).toLowerCase();
  if (browser && SUPPORTED_LANGUAGES.some((l) => l.code === browser)) return browser;
  return "en";
}

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources: {
      en: { translation: en },
      es: { translation: es },
      fr: { translation: fr },
      de: { translation: de },
      pt: { translation: pt },
      it: { translation: it },
    },
    lng: detectInitial(),
    fallbackLng: "en",
    interpolation: { escapeValue: false },
    returnNull: false,
  });
}

export function applyLanguage(code: string) {
  const lang = SUPPORTED_LANGUAGES.find((l) => l.code === code) ?? SUPPORTED_LANGUAGES[0];
  i18n.changeLanguage(lang.code);
  if (typeof document !== "undefined") {
    document.documentElement.lang = lang.code;
    document.documentElement.dir = lang.dir;
  }
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, lang.code);
  }
}

export default i18n;
