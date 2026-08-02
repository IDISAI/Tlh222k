/** Build Turbo arguments without starting a duplicate svc-api process. */
export function turboDevArgs(turboFilters, reuseSvcApi = false) {
  if (!reuseSvcApi) return ["turbo", "dev", ...turboFilters]

  return [
    "turbo",
    "dev",
    ...turboFilters.filter((filter) => filter !== "--filter=svc-api"),
    "--filter=!svc-api",
  ]
}

/**
 * Distinguish an already-running local GraphQL API from an unrelated process
 * that happens to occupy port 3005. Never silently point Field CMS at wrong server.
 */
export async function hasHealthySvcApi(url) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 1_500)

  try {
    const response = await fetch(`${url.replace(/\/$/, "")}/graphql`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "{ __typename }" }),
      signal: controller.signal,
    })
    if (!response.ok) return false
    const body = await response.json()
    return body?.data?.__typename === "Query"
  } catch {
    return false
  } finally {
    clearTimeout(timeout)
  }
}
