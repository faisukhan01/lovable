"use client";

/**
 * Lovify API client.
 *
 * All requests go through the platform gateway with relative URLs only:
 *   /api/<path>?XTransformPort=8000  ->  FastAPI backend on localhost:8000
 * Never use absolute URLs or hardcoded ports in components.
 */

import { useAuthStore } from "@/lib/store";
import type {
  AuthResponse,
  ProjectDetail,
  ProjectSummary,
  PublishedApp,
  Stats,
  UserT,
} from "@/lib/types";

const BACKEND_PORT = 8000;

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

export function apiUrl(path: string): string {
  const sep = path.includes("?") ? "&" : "?";
  return `/api${path}${sep}XTransformPort=${BACKEND_PORT}`;
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown } = {}
): Promise<T> {
  const token = useAuthStore.getState().token;

  let res: Response;
  try {
    res = await fetch(apiUrl(path), {
      method: options.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError(0, "Cannot reach the Lovify backend. Is the API service running?");
  }

  if (res.status === 401) {
    useAuthStore.getState().clear();
    throw new ApiError(401, "Your session expired. Please sign in again.");
  }

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  if (!res.ok) {
    const detail =
      (data as { detail?: unknown })?.detail instanceof String ||
      typeof (data as { detail?: unknown })?.detail === "string"
        ? String((data as { detail?: string }).detail)
        : "Something went wrong. Please try again.";
    throw new ApiError(res.status, detail);
  }

  return data as T;
}

/* ----------------------------- Auth ----------------------------- */

export function signup(email: string, password: string, name?: string) {
  return request<AuthResponse>("/auth/signup", {
    method: "POST",
    body: { email, password, name: name || undefined },
  });
}

export function login(email: string, password: string) {
  return request<AuthResponse>("/auth/login", { method: "POST", body: { email, password } });
}

export function me() {
  return request<UserT>("/auth/me");
}

/* --------------------------- Projects --------------------------- */

export function listProjects(withHtml?: boolean) {
  return request<{ projects: (ProjectSummary & { html?: string | null })[] }>(
    `/projects${withHtml ? "?with_html=1" : ""}`
  );
}

export function createProject(prompt: string) {
  return request<ProjectDetail>("/projects", { method: "POST", body: { prompt } });
}

export function getProject(id: string) {
  return request<ProjectDetail>(`/projects/${id}`);
}

export function deleteProject(id: string) {
  return request<{ ok: boolean }>(`/projects/${id}`, { method: "DELETE" });
}

export function chatOnProject(id: string, message: string) {
  return request<{ ok: boolean; status: string }>(`/projects/${id}/chat`, {
    method: "POST",
    body: { message },
  });
}

export function restoreVersion(id: string, version: number) {
  return request<ProjectDetail>(`/projects/${id}/restore`, {
    method: "POST",
    body: { version },
  });
}

export function publishProject(id: string) {
  return request<{ slug: string; url: string }>(`/projects/${id}/publish`, {
    method: "POST",
    body: {},
  });
}

export function getProjectCode(id: string) {
  return request<{ html: string; version: number }>(`/projects/${id}/code`);
}

/* ------------------------- Power features ------------------------ */

export function enhancePrompt(prompt: string) {
  return request<{ prompt: string }>("/enhance-prompt", {
    method: "POST",
    body: { prompt },
  });
}

export function renameProject(id: string, name: string) {
  return request<{ ok: boolean; name: string }>(`/projects/${id}`, {
    method: "PATCH",
    body: { name },
  });
}

export function forkProject(id: string) {
  return request<{ id: string; name: string; status: string; version: number }>(
    `/projects/${id}/fork`,
    { method: "POST", body: {} }
  );
}

export function exploreApps(withHtml?: boolean) {
  return request<{
    apps: {
      slug: string;
      name: string;
      description: string;
      version: number;
      published_at: string | null;
      html?: string | null;
    }[];
  }>(`/explore${withHtml ? "?with_html=1" : ""}`);
}

/* ---------------------------- Public ---------------------------- */

export function getStats() {
  return request<Stats>("/stats");
}

export function getPublishedApp(slug: string) {
  return request<PublishedApp>(`/published/${slug}`);
}
