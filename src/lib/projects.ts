// Client-side projects store. Swap for a Supabase table once Lovable Cloud is enabled.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Analysis } from "./api/vetting.functions";


export type StageKey = "compliance" | "market" | "demand";

export type ProjectScores = Record<StageKey, number>;

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type Iteration = {
  at: number;
  idea: string;
  scores: ProjectScores;
  overall: number;
  thesis?: string;
};

export type Project = {
  id: string;
  title: string;
  idea: string;
  sketchName?: string;
  email?: string;
  createdAt: number;
  updatedAt: number;
  scores?: ProjectScores;
  analysis?: Analysis;
  chat?: ChatMessage[];
  focusGroup?: string;
  iterations?: Iteration[];
  status: "draft" | "vetting" | "ready" | "error";
};

const BASE_KEY = "ideaforge:projects";
const LEGACY_KEY = "ideaforge:projects";
let currentUserId: string | null = null;
let authWired = false;

function currentKey(): string {
  return `${BASE_KEY}:${currentUserId ?? "anon"}`;
}

function notifyChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new StorageEvent("storage", { key: BASE_KEY }));
}

function ensureAuthWired() {
  if (authWired || typeof window === "undefined") return;
  authWired = true;
  supabase.auth.getSession().then(({ data }) => {
    const next = data.session?.user.id ?? null;
    if (next !== currentUserId) {
      currentUserId = next;
      maybeMigrateLegacy();
      notifyChange();
    } else {
      maybeMigrateLegacy();
      notifyChange();
    }
  });
  supabase.auth.onAuthStateChange((_e, session) => {
    const next = session?.user.id ?? null;
    if (next !== currentUserId) {
      currentUserId = next;
      maybeMigrateLegacy();
      notifyChange();
    }
  });
}

function maybeMigrateLegacy() {
  if (typeof window === "undefined" || !currentUserId) return;
  try {
    const scoped = window.localStorage.getItem(currentKey());
    const legacy = window.localStorage.getItem(LEGACY_KEY);
    if (!scoped && legacy) {
      window.localStorage.setItem(currentKey(), legacy);
      window.localStorage.removeItem(LEGACY_KEY);
    }
  } catch {
    /* ignore */
  }
}

function read(): Project[] {
  if (typeof window === "undefined") return [];
  ensureAuthWired();
  try {
    const raw = window.localStorage.getItem(currentKey());
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Project[]) : [];
  } catch {
    return [];
  }
}

function write(projects: Project[]) {
  window.localStorage.setItem(currentKey(), JSON.stringify(projects));
  notifyChange();
}


export function listProjects(): Project[] {
  return read().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getProject(id: string): Project | undefined {
  return read().find((p) => p.id === id);
}

export function deriveTitle(idea: string): string {
  const trimmed = idea.trim().replace(/\s+/g, " ");
  if (!trimmed) return "Untitled idea";
  const firstSentence = trimmed.split(/[.!?\n]/)[0] ?? trimmed;
  const words = firstSentence.split(" ").slice(0, 7).join(" ");
  return words.length < firstSentence.length ? `${words}…` : words;
}

export function createProject(input: { idea: string; sketchName?: string; email?: string }): Project {
  const now = Date.now();
  const project: Project = {
    id: cryptoRandomId(),
    title: deriveTitle(input.idea),
    idea: input.idea,
    sketchName: input.sketchName,
    email: input.email,
    createdAt: now,
    updatedAt: now,
    status: "vetting",
  };
  write([project, ...read()]);
  return project;
}

export function updateProject(id: string, patch: Partial<Project>): Project | undefined {
  const all = read();
  const i = all.findIndex((p) => p.id === id);
  if (i === -1) return undefined;
  const updated: Project = { ...all[i], ...patch, updatedAt: Date.now() };
  all[i] = updated;
  write(all);
  return updated;
}

export function deleteProject(id: string) {
  write(read().filter((p) => p.id !== id));
}

function cryptoRandomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().slice(0, 8);
  }
  return Math.random().toString(36).slice(2, 10);
}

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  useEffect(() => {
    setProjects(listProjects()); // sync on mount (SSR can't read localStorage)
    const refresh = (e: StorageEvent) => {
      if (e.key === KEY || e.key === null) setProjects(listProjects());
    };
    window.addEventListener("storage", refresh);
    return () => window.removeEventListener("storage", refresh);
  }, []);
  return projects;
}

export function overallScore(scores?: ProjectScores): number | null {
  if (!scores) return null;
  return Math.round(scores.compliance * 0.3 + scores.market * 0.35 + scores.demand * 0.35);
}

export function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString();
}
