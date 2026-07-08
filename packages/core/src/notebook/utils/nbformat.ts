/** nbformat allows `string | string[]` for sources and stream text. */
export function joinSource(source: string | string[] | undefined): string {
  if (source === undefined) return ""
  return Array.isArray(source) ? source.join("") : source
}
