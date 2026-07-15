import type { Notebook } from "../types"
import type { GradeMap } from "../kernel/types"
import type { ExerciseProgress } from "./types"

/** Matches `q1.check()`, `q2 .check()`, `qa.check()` in exercise code cells. */
const CHECK_PATTERN = /\b(q\w+)\s*\.\s*check\s*\(/g

/**
 * The set of gradeable questions in an exercise, discovered by scanning code
 * cells for `qN.check()` calls (document order, de-duplicated). This is how the
 * progress bar knows its denominator without any extra metadata.
 */
export function extractQuestionIds(notebook: Notebook): string[] {
  const ids: string[] = []
  const seen = new Set<string>()
  for (const cell of notebook.cells) {
    if (cell.cellType !== "code") continue
    for (const match of cell.source.matchAll(CHECK_PATTERN)) {
      const id = match[1]!
      if (!seen.has(id)) {
        seen.add(id)
        ids.push(id)
      }
    }
  }
  return ids
}

/** Fold the running grade map against the known questions into a progress view. */
export function computeProgress(
  questionIds: string[],
  grades: GradeMap
): ExerciseProgress {
  const resolved: ExerciseProgress["grades"] = {}
  let correct = 0
  for (const id of questionIds) {
    const grade = grades[id] ?? "unattempted"
    resolved[id] = grade
    if (grade === "correct") correct++
  }
  return { total: questionIds.length, correct, questionIds, grades: resolved }
}
