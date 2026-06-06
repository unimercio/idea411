export const INTAKE_CHAR_BOUND_MIN = 100;
export const INTAKE_CHAR_BOUND_MAX = 1200;
export const INTAKE_DEFAULT_MIN = 400;
export const INTAKE_DEFAULT_MAX = 1200;
const KEY = "intake_char_range";

export type IntakeCharRange = { min: number; max: number };

export function getIntakeCharRange(): IntakeCharRange {
  if (typeof window === "undefined") {
    return { min: INTAKE_DEFAULT_MIN, max: INTAKE_DEFAULT_MAX };
  }
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { min: INTAKE_DEFAULT_MIN, max: INTAKE_DEFAULT_MAX };
    const parsed = JSON.parse(raw) as Partial<IntakeCharRange>;
    const min = clamp(parsed.min ?? INTAKE_DEFAULT_MIN);
    const max = clamp(parsed.max ?? INTAKE_DEFAULT_MAX);
    return { min: Math.min(min, max), max: Math.max(min, max) };
  } catch {
    return { min: INTAKE_DEFAULT_MIN, max: INTAKE_DEFAULT_MAX };
  }
}

export function setIntakeCharRange(range: IntakeCharRange) {
  if (typeof window === "undefined") return;
  const min = clamp(range.min);
  const max = clamp(range.max);
  window.localStorage.setItem(
    KEY,
    JSON.stringify({ min: Math.min(min, max), max: Math.max(min, max) }),
  );
}

function clamp(n: number) {
  return Math.max(INTAKE_CHAR_BOUND_MIN, Math.min(INTAKE_CHAR_BOUND_MAX, Math.round(n)));
}
