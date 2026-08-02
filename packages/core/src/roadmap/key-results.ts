/**
 * How many Key Results a node may declare.
 *
 * A node listing thirty outcomes is pasting a syllabus, not saying what a
 * learner will be able to do — and the detail panel it renders in has no room
 * for that. Mirrored in `roadmap.service.ts` (mock) and svc-api, so the editor
 * cannot compose something the backend would silently truncate.
 */
export const MAX_KEY_RESULTS = 12

/** Split the editor's textarea into the ordered list the service stores. */
export function parseKeyResults(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, MAX_KEY_RESULTS)
}
