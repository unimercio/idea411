// Supabase-backed projects store. Keeps a synchronous in-memory cache so existing
// call sites (createProject/updateProject/getProject/...) remain non-async.
// Cache is hydrated from Supabase per signed-in user; mutations write through.
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

const CHANGE_EVENT = "ideaforge:projects-changed";
const COLUMN_FIELDS = ["title", "idea", "status"] as const;
const DATA_FIELDS = [
  "sketchName",
  "email",
  "scores",
  "analysis",
  "chat",
  "focusGroup",
  "iterations",
] as const;
type DataField = (typeof DATA_FIELDS)[number];

let cache: Project[] = [];
let cacheUserId: string | null = null;
let authWired = false;
let hydratePromise: Promise<void> | null = null;

function notifyChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

function rowToProject(row: ProjectRow): Project {
  const data = (row.data ?? {}) as Partial<Project>;
  return {
    id: row.id,
    title: row.title,
    idea: row.idea,
    status: (row.status as Project["status"]) ?? "vetting",
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
    sketchName: data.sketchName,
    email: data.email,
    scores: data.scores,
    analysis: data.analysis,
    chat: data.chat,
    focusGroup: data.focusGroup,
    iterations: data.iterations,
  };
}

function projectDataPayload(p: Project): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of DATA_FIELDS) {
    const v = (p as unknown as Record<string, unknown>)[k];
    if (v !== undefined) out[k] = v;
  }
  return out;
}

type ProjectRow = {
  id: string;
  user_id: string;
  title: string;
  idea: string;
  status: string;
  data: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

async function hydrateForUser(userId: string | null) {
  if (userId === null) {
    cache = [];
    cacheUserId = null;
    notifyChange();
    return;
  }
  cacheUserId = userId;
  const { data, error } = await supabase
    .from("projects")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .select("*" as any)
    .order("updated_at", { ascending: false });
  if (error) {
    console.error("[projects] load failed", error);
    cache = [];
    notifyChange();
    return;
  }
  // Guard against late responses after another user signed in.
  if (cacheUserId !== userId) return;
  cache = ((data ?? []) as unknown as ProjectRow[]).map(rowToProject);
  notifyChange();
}

function ensureAuthWired() {
  if (authWired || typeof window === "undefined") return;
  authWired = true;
  hydratePromise = supabase.auth.getSession().then(({ data }) => {
    return hydrateForUser(data.session?.user.id ?? null);
  });
  supabase.auth.onAuthStateChange((event, session) => {
    if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
    const next = session?.user.id ?? null;
    if (next === cacheUserId && event !== "SIGNED_OUT") return;
    hydratePromise = hydrateForUser(next);
  });
}

export async function refreshProjects() {
  ensureAuthWired();
  const { data } = await supabase.auth.getUser();
  await hydrateForUser(data.user?.id ?? null);
}

function read(): Project[] {
  ensureAuthWired();
  return cache;
}

export function listProjects(): Project[] {
  return [...read()].sort((a, b) => b.updatedAt - a.updatedAt);
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
  ensureAuthWired();
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
  cache = [project, ...cache];
  notifyChange();
  void (async () => {
    if (!cacheUserId) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabase.from("projects").insert({
      id: project.id,
      user_id: cacheUserId,
      title: project.title,
      idea: project.idea,
      status: project.status,
      data: projectDataPayload(project) as any,
    });
    if (error) console.error("[projects] insert failed", error);
  })();
  return project;
}

export function updateProject(id: string, patch: Partial<Project>): Project | undefined {
  ensureAuthWired();
  const i = cache.findIndex((p) => p.id === id);
  if (i === -1) return undefined;
  const updated: Project = { ...cache[i], ...patch, updatedAt: Date.now() };
  cache = [...cache];
  cache[i] = updated;
  notifyChange();
  void (async () => {
    if (!cacheUserId) return;
    const dbPatch: Record<string, unknown> = {};
    for (const k of COLUMN_FIELDS) {
      if (k in patch) dbPatch[k] = (patch as Record<string, unknown>)[k];
    }
    const touchesData = DATA_FIELDS.some((k) => k in patch);
    if (touchesData) dbPatch.data = projectDataPayload(updated);
    if (Object.keys(dbPatch).length === 0) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabase.from("projects").update(dbPatch as any).eq("id", id);
    if (error) console.error("[projects] update failed", error);
  })();
  return updated;
}

export function deleteProject(id: string) {
  ensureAuthWired();
  cache = cache.filter((p) => p.id !== id);
  notifyChange();
  void (async () => {
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) console.error("[projects] delete failed", error);
  })();
}

function cryptoRandomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Fallback (non-cryptographic) — last resort.
  return "00000000-0000-4000-8000-" + Math.random().toString(16).slice(2, 14).padStart(12, "0");
}

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>(() => listProjects());
  useEffect(() => {
    setProjects(listProjects());
    if (hydratePromise) {
      void hydratePromise.then(() => setProjects(listProjects()));
    }
    const refresh = () => setProjects(listProjects());
    window.addEventListener(CHANGE_EVENT, refresh);
    return () => window.removeEventListener(CHANGE_EVENT, refresh);
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
