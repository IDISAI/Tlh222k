// Deterministic fixture traces for C2 tests and shell development. Not wired
// into production hosts — real engines land in C3 (Python) and C4 (JS).

import type { TraceResult } from "./types"

/**
 * Three-step Python trace of a tiny list-append program, with a heap
 * reference shared across steps so reference rendering is exercised.
 */
export const FIXTURE_TRACE: TraceResult = {
  language: "python",
  truncated: false,
  steps: [
    {
      index: 0,
      line: 1,
      event: "line",
      frames: [
        {
          id: "frame-module",
          name: "<module>",
          line: 1,
          locals: {},
        },
      ],
      heap: [],
      stdout: [],
    },
    {
      index: 1,
      line: 2,
      event: "line",
      frames: [
        {
          id: "frame-module",
          name: "<module>",
          line: 2,
          locals: {
            items: { kind: "reference", id: "heap-1", label: "list" },
          },
        },
      ],
      heap: [
        {
          id: "heap-1",
          type: "list",
          fields: { "0": { kind: "primitive", value: 1 } },
        },
      ],
      stdout: [],
    },
    {
      index: 2,
      line: 3,
      event: "return",
      frames: [
        {
          id: "frame-module",
          name: "<module>",
          line: 3,
          locals: {
            items: { kind: "reference", id: "heap-1", label: "list" },
            total: { kind: "primitive", value: 3 },
          },
        },
      ],
      heap: [
        {
          id: "heap-1",
          type: "list",
          fields: {
            "0": { kind: "primitive", value: 1 },
            "1": { kind: "primitive", value: 2 },
          },
        },
      ],
      stdout: ["total 3"],
    },
  ],
}

/** Source matching FIXTURE_TRACE's line numbers. */
export const FIXTURE_SOURCE = "items = [1]\nitems.append(2)\nprint(\"total\", sum(items))"

/** Trace ending in an exception, for error-banner rendering. */
export const FIXTURE_ERROR_TRACE: TraceResult = {
  language: "python",
  truncated: false,
  error: { name: "ZeroDivisionError", message: "division by zero", line: 1 },
  steps: [
    {
      index: 0,
      line: 1,
      event: "exception",
      frames: [
        { id: "frame-module", name: "<module>", line: 1, locals: {} },
      ],
      heap: [],
      stdout: [],
    },
  ],
}

/** Trace cut off at the step cap, for truncation-notice rendering. */
export const FIXTURE_TRUNCATED_TRACE: TraceResult = {
  ...FIXTURE_TRACE,
  truncated: true,
}
