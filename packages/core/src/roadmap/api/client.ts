import {
  ApolloClient,
  HttpLink,
  InMemoryCache,
  from,
  gql as apolloGql,
  type NormalizedCacheObject,
} from "@apollo/client"
import { setContext } from "@apollo/client/link/context"

import { RoadmapServiceError, type RoadmapErrorCode } from "../types"

/** True when the frontend should talk to svc-roadmap instead of the mock. */
export function roadmapBackendEnabled(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SVC_ROADMAP_URL)
}

function endpoint(): string {
  const base = process.env.NEXT_PUBLIC_SVC_ROADMAP_URL ?? ""
  return `${base.replace(/\/$/, "")}/graphql`
}

interface ClerkGlobal {
  loaded?: boolean
  load?: () => Promise<unknown>
  session?: { getToken?: () => Promise<string | null> } | null
}

function readClerk(): ClerkGlobal | undefined {
  return (window as unknown as { Clerk?: ClerkGlobal }).Clerk
}

/**
 * Clerk session token for authorizing writes. Client-side reads it from the
 * globally-loaded Clerk instance (the token is short-lived and meant for API
 * calls); server-side there is none here, and public reads don't need one.
 *
 * Crucially, it WAITS for ClerkJS to attach and finish loading. The first
 * authenticated call — e.g. the builder's `graphById` firing on mount — can
 * otherwise run before `window.Clerk.session` exists, sending no token; then
 * svc-roadmap sees a guest and denies the write (`PERMISSION_DENIED`) even for
 * an admin/super-admin. Waiting closes that startup race.
 */
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function getClerkToken(): Promise<string | null> {
  if (typeof window === "undefined") return null

  // Everything below is BOUNDED: public reads (roadmap list / graph) must never
  // stall on a slow or blocked ClerkJS load. Wait a little for the token so
  // authenticated calls (builder) succeed, but always give up and proceed
  // token-less rather than hang the whole data layer.
  const deadline = Date.now() + 2_500

  let clerk = readClerk()
  while (!clerk && Date.now() < deadline) {
    await sleep(50)
    clerk = readClerk()
  }
  if (!clerk) return null

  try {
    if (clerk.loaded === false && typeof clerk.load === "function") {
      // Race clerk.load() against the remaining budget so a degraded Clerk
      // connection can't freeze queries indefinitely.
      await Promise.race([clerk.load(), sleep(Math.max(0, deadline - Date.now()))])
    }
    const token = await Promise.race([
      Promise.resolve(clerk.session?.getToken?.() ?? null),
      sleep(1_000).then(() => null),
    ])
    return token ?? null
  } catch {
    return null
  }
}

function makeClient(): ApolloClient<NormalizedCacheObject> {
  // `cache: "no-store"` opts every request out of the Next.js App Router fetch
  // cache. Without it, a server component that reads a roadmap would keep
  // rendering stale published/unpublished data after an admin edit — the exact
  // web↔admin desync we are killing.
  const httpLink = new HttpLink({
    uri: endpoint(),
    fetchOptions: { cache: "no-store" },
  })

  const authLink = setContext(async (_operation, prevContext) => {
    const headers = (prevContext.headers ?? {}) as Record<string, string>
    const token = await getClerkToken()
    return {
      headers: token ? { ...headers, authorization: `Bearer ${token}` } : headers,
    }
  })

  return new ApolloClient({
    link: from([authLink, httpLink]),
    cache: new InMemoryCache(),
    // Reads always hit the network so viewers never render stale roadmap state;
    // Apollo still gives us one shared transport + provider across the app.
    defaultOptions: {
      query: { fetchPolicy: "no-cache", errorPolicy: "none" },
      watchQuery: { fetchPolicy: "no-cache", errorPolicy: "none" },
      mutate: { fetchPolicy: "no-cache", errorPolicy: "none" },
    },
  })
}

// One client per browser tab (shared cache/provider); a fresh client per server
// request so auth/cache never bleed across users.
let browserClient: ApolloClient<NormalizedCacheObject> | null = null

export function getApolloClient(): ApolloClient<NormalizedCacheObject> {
  if (typeof window === "undefined") return makeClient()
  return (browserClient ??= makeClient())
}

/** Map an ApolloError's `extensions.code` back to a `RoadmapServiceError`. */
function toRoadmapError(error: unknown): unknown {
  const gqlErrors = (
    error as {
      graphQLErrors?: readonly {
        message: string
        extensions?: { code?: string }
      }[]
    }
  ).graphQLErrors
  const first = gqlErrors?.[0]
  const code = first?.extensions?.code as RoadmapErrorCode | undefined
  if (code) return new RoadmapServiceError(code, first?.message)
  return error
}

/**
 * Execute a GraphQL operation against svc-roadmap through Apollo Client.
 * Auto-routes `mutation` documents to `client.mutate` and everything else to
 * `client.query`. Backend errors are rethrown as `RoadmapServiceError` (via
 * `extensions.code`) so callers/toasts behave identically to the mock service.
 * Signature is unchanged from the previous graphql-request transport, so no
 * call site (see `roadmap.api.ts`) needs to change.
 */
export async function gql<T>(
  source: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const client = getApolloClient()
  const document = apolloGql(source)
  const isMutation = /^\s*mutation\b/.test(source)
  try {
    if (isMutation) {
      const res = await client.mutate<T>({ mutation: document, variables })
      return res.data as T
    }
    const res = await client.query<T>({
      query: document,
      variables,
      fetchPolicy: "no-cache",
    })
    return res.data as T
  } catch (error) {
    throw toRoadmapError(error)
  }
}
