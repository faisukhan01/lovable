/** Shared Lovify types mirroring the FastAPI backend responses. */

export type ProjectStatus = "generating" | "ready" | "error";

export interface UserT {
  id: string;
  email: string;
  name: string | null;
  created_at?: string | null;
}

export interface AuthResponse {
  token: string;
  user: UserT;
}

export interface ProjectSummary {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  error: string | null;
  version: number;
  published_slug: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface MessageT {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string | null;
}

export interface VersionT {
  id: string;
  version: number;
  label: string;
  created_at: string | null;
}

export interface ProjectDetail extends ProjectSummary {
  html: string | null;
  original_prompt: string;
  messages: MessageT[];
  versions: VersionT[];
}

export interface Stats {
  builders: number;
  apps: number;
  published: number;
}

export interface PublishedApp {
  slug: string;
  name: string;
  description: string;
  html: string;
  published_at: string | null;
  views?: number;
  likes?: number;
  author?: string;
  author_name?: string | null;
}

/* --------------------------- social / community --------------------------- */

export interface ExploreApp {
  slug: string;
  name: string;
  description: string;
  version: number;
  views: number;
  likes: number;
  author: string;
  published_at: string | null;
  liked?: boolean;
  html?: string | null;
}

export type ExploreSort = "newest" | "liked" | "viewed";

export interface BuilderProfile {
  handle: string;
  name: string;
  joined: string | null;
  apps_published: number;
  total_views: number;
  apps: {
    slug: string;
    name: string;
    description: string;
    views: number;
    likes: number;
    published_at: string | null;
  }[];
}

export interface UsageStats {
  projects: number;
  published: number;
  versions: number;
  messages: number;
  likes_received: number;
  views_received: number;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}
