// Notebook persistence for the editor. v1 is a browser localStorage store so
// the admin editor works with no backend; Phase 2's Go kernel-server replaces
// it behind this same interface (the CRUD shape is intentionally minimal).

import { NotebookService } from "../notebook.service"
import type { Notebook } from "../types"
import type { NotebookMeta, NotebookRecord, RuntimeProfile } from "../kernel/types"
import { createNotebookMeta } from "./editor.service"

export interface NotebookSummary {
  slug: string
  title: string
  updatedAt: string
  published: boolean
  runtimeProfile: RuntimeProfile
}

export interface NotebookStore {
  load(slug: string): Promise<NotebookRecord | null>
  save(slug: string, record: NotebookRecord): Promise<void>
  list(): Promise<NotebookSummary[]>
  remove(slug: string): Promise<void>
}

const KEY_PREFIX = "notebook:"
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*$/

const service = new NotebookService()

/** localStorage-backed store (admin editor v1). No-ops outside the browser. */
export class LocalNotebookStore implements NotebookStore {
  private key(slug: string) {
    return `${KEY_PREFIX}${slug}`
  }

  async load(slug: string): Promise<NotebookRecord | null> {
    if (typeof localStorage === "undefined" || !SLUG_PATTERN.test(slug)) {
      return null
    }
    const raw = localStorage.getItem(this.key(slug))
    if (!raw) return null
    try {
      const payload = JSON.parse(raw) as {
        notebook: unknown
        meta?: Partial<NotebookMeta>
        published?: boolean
        runtimeProfile?: string
        updatedAt?: string
      }
      return {
        notebook: service.parse(payload.notebook),
        meta: createNotebookMeta({
          ...payload.meta,
          published: payload.meta?.published ?? payload.published,
          runtimeProfile:
            payload.meta?.runtimeProfile ??
            (payload.runtimeProfile as RuntimeProfile | undefined),
          updatedAt: payload.meta?.updatedAt ?? payload.updatedAt,
        }),
      }
    } catch {
      return null
    }
  }

  async save(slug: string, record: NotebookRecord): Promise<void> {
    if (typeof localStorage === "undefined" || !SLUG_PATTERN.test(slug)) return
    const { notebook } = record
    const payload = {
      slug,
      title: notebook.title,
      updatedAt: new Date().toISOString(),
      published: record.meta.published,
      runtimeProfile: record.meta.runtimeProfile,
      notebook: service.serialize(notebook),
    }
    localStorage.setItem(this.key(slug), JSON.stringify(payload))
  }

  async list(): Promise<NotebookSummary[]> {
    if (typeof localStorage === "undefined") return []
    const out: NotebookSummary[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (!k?.startsWith(KEY_PREFIX)) continue
      try {
        const { slug, title, updatedAt, published, runtimeProfile } = JSON.parse(
          localStorage.getItem(k)!
        ) as NotebookSummary
        out.push({
          slug,
          title,
          updatedAt,
          published: published ?? false,
          runtimeProfile: runtimeProfile ?? "data-science",
        })
      } catch {
        // Skip corrupt entries.
      }
    }
    return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  async remove(slug: string): Promise<void> {
    if (typeof localStorage === "undefined") return
    localStorage.removeItem(this.key(slug))
  }
}

/**
 * kernel-server-backed store (Phase 2 backend). Admin editor uses this so the
 * notebooks it creates/updates are shared with the web viewer (which reads the
 * same server). `getToken` attaches a Clerk session JWT for the admin-only
 * write routes; in dev the server's DEV_AUTH_ROLE bypass makes it optional.
 */
export class HttpNotebookStore implements NotebookStore {
  constructor(
    private baseUrl: string,
    private getToken?: () => Promise<string | null>
  ) {}

  private async headers(): Promise<Record<string, string>> {
    const h: Record<string, string> = { "Content-Type": "application/json" }
    const token = await this.getToken?.()
    if (token) h.Authorization = `Bearer ${token}`
    return h
  }

  async load(slug: string): Promise<NotebookRecord | null> {
    if (!SLUG_PATTERN.test(slug)) return null
    const res = await fetch(`${this.baseUrl}/api/notebooks/${slug}`, {
      headers: await this.headers(),
    })
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`load ${slug}: ${res.status}`)
    const payload = (await res.json()) as {
      notebook: unknown
      meta?: Partial<NotebookMeta>
    }
    return {
      notebook: service.parse(payload.notebook),
      meta: createNotebookMeta(payload.meta),
    }
  }

  async save(slug: string, record: NotebookRecord): Promise<void> {
    if (!SLUG_PATTERN.test(slug)) return
    const { notebook, meta } = record
    const res = await fetch(`${this.baseUrl}/api/notebooks/${slug}`, {
      method: "PUT",
      headers: await this.headers(),
      body: JSON.stringify({
        title: notebook.title,
        published: meta.published,
        runtimeProfile: meta.runtimeProfile,
        notebook: service.serialize(notebook),
      }),
    })
    if (!res.ok) throw new Error(`save ${slug}: ${res.status}`)
  }

  async list(): Promise<NotebookSummary[]> {
    const res = await fetch(`${this.baseUrl}/api/notebooks`, {
      headers: await this.headers(),
    })
    if (!res.ok) throw new Error(`list: ${res.status}`)
    const metas = (await res.json()) as Array<
      NotebookSummary & Partial<NotebookMeta>
    >
    return metas.map((meta) => ({
      ...meta,
      published: meta.published ?? false,
      runtimeProfile: meta.runtimeProfile ?? "data-science",
    }))
  }

  async remove(slug: string): Promise<void> {
    if (!SLUG_PATTERN.test(slug)) return
    await fetch(`${this.baseUrl}/api/notebooks/${slug}`, {
      method: "DELETE",
      headers: await this.headers(),
    })
  }
}
