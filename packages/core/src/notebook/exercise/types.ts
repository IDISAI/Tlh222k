import type { CellOutput } from "../types"
import type { QuestionGrade } from "../kernel/types"

/** A code cell's live run state in the Exercise tab (editable copy). */
export interface ExerciseCellState {
  /** Editable source (starts from the notebook, diverges as the user types). */
  source: string
  outputs: CellOutput[]
  /** `In [n]`; null until first run. */
  executionCount: number | null
  running: boolean
}

export interface ExerciseProgress {
  total: number
  correct: number
  /** qids in document order, e.g. ["q1", "q2"]. */
  questionIds: string[]
  grades: Record<string, QuestionGrade>
}
