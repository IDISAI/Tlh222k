/** http(s) URL check for `jupyterUrl` validation (Req 9.6). */
export function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}
