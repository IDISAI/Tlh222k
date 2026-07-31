import type { NodeStatus } from "../../types"

/**
 * The three states the access contract names.
 *
 * Storage still uses `locked | in_progress | done`. "locked" is a poor name
 * for it — the contract is explicit that edges never gate content, so nothing
 * is actually locked — but renaming a column every surface reads is a separate
 * change. This maps at the boundary so the vocabulary the product speaks and
 * the vocabulary the database speaks stay reconcilable in one place.
 */
export type LearnerState = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED"

const STATE_BY_STATUS: Record<NodeStatus, LearnerState> = {
  locked: "NOT_STARTED",
  in_progress: "IN_PROGRESS",
  done: "COMPLETED",
}

/** Anything unrecognised reads as not started — never as progress unearned. */
export function learnerStateOf(status: string | null | undefined): LearnerState {
  if (typeof status !== "string") return "NOT_STARTED"
  return STATE_BY_STATUS[status as NodeStatus] ?? "NOT_STARTED"
}

export interface RoadmapCompletionInput {
  /** The roadmap's required nodes as they stand right now. */
  requiredNodeIds: readonly string[]
  /**
   * Every node this learner has completed, across all roadmaps — progress is
   * stored per user+node, so a node finished elsewhere already counts here.
   */
  completedNodeIds: ReadonlySet<string>
  /** Whether this learner had already completed the roadmap once. */
  previouslyCompleted?: boolean
}

export interface RoadmapCompletion {
  percent: number
  completed: boolean
}

/**
 * How far a learner is through one roadmap.
 *
 * Two rules do the interesting work. Only *current required* nodes count, so
 * optional content cannot inflate the bar and a node dropped from the roadmap
 * stops counting the moment it is dropped. And a completion already earned
 * survives new required nodes being added afterwards — the contract forbids
 * taking it back, so an editor extending a roadmap cannot un-graduate people.
 * Reporting anything below 100% for such a learner would contradict the
 * completion they still hold, so the bar stays full for them while learners
 * mid-way see the new, longer roadmap.
 */
export function roadmapCompletion(
  input: RoadmapCompletionInput
): RoadmapCompletion {
  if (input.previouslyCompleted) return { percent: 100, completed: true }

  const required = new Set(input.requiredNodeIds)
  const total = required.size
  if (total === 0) {
    // Nothing to finish is not the same as finished.
    return { percent: 0, completed: false }
  }

  let done = 0
  for (const nodeId of required) {
    if (input.completedNodeIds.has(nodeId)) done += 1
  }

  const percent = Math.min(100, Math.max(0, Math.floor((done / total) * 100)))
  return { percent, completed: done === total }
}
