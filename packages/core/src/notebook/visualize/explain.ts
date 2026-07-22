// Vietnamese, grade-5-level narration of a trace step.
//
// The diagram shows *what* memory looks like; a ten-year-old also needs to be
// told *what just happened* in words. This derives that from the shared
// TraceStep schema alone, so Python and JavaScript get the same explanations
// with no language-specific branches.

import type { TraceStep, TraceValue } from "./types"

export interface StepExplanation {
  /** Plain-Vietnamese sentences for what the previous line did. */
  done: string[]
  /** The line that is about to run. */
  next: string
}

/** Longest sentence fragment we will inline before shortening it. */
const MAX_INLINE = 40
const CIRCLED = "①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳"

/** Friendly Vietnamese names for the container types both engines emit. */
const TYPE_NAMES: Record<string, string> = {
  list: "danh sách",
  tuple: "bộ giá trị",
  dict: "từ điển",
  set: "tập hợp",
  Array: "danh sách",
  Object: "đối tượng",
}

export function typeName(type: string): string {
  return TYPE_NAMES[type] ?? type
}

/** `heap-3` → `③`, so a child matches the box without reading an id. */
export function heapBadge(id: string): string {
  const index = Number(/(\d+)$/.exec(id)?.[1])
  if (!Number.isInteger(index) || index < 1) return id
  return index <= CIRCLED.length ? CIRCLED[index - 1]! : `#${index}`
}

/** How a value reads inside a sentence. Keeps code literals as written. */
export function valueText(value: TraceValue): string {
  switch (value.kind) {
    case "primitive":
      return typeof value.value === "string"
        ? `"${value.value}"`
        : String(value.value)
    case "reference":
      return `${typeName(value.label)} ${heapBadge(value.id)}`
    case "truncated":
      return value.preview
  }
}

export function explainStep(
  step: TraceStep,
  previous: TraceStep | undefined,
  sourceLines: string[]
): StepExplanation {
  const code = sourceLines[step.line - 1]?.trim() ?? ""
  const next =
    step.event === "exception"
      ? `Chương trình dừng lại vì có lỗi ở dòng ${step.line}.`
      : `Sắp chạy dòng ${step.line}${code ? `: ${shorten(code)}` : ""}`

  if (!previous) {
    return { done: ["Chương trình bắt đầu chạy."], next }
  }

  // Heap first: an object exists before a variable can point at it, and reading
  // it in that order is how a child would narrate it out loud.
  const done: string[] = [
    ...explainHeap(step, previous),
    ...explainFrames(step, previous),
    ...explainOutput(step, previous),
  ]
  if (done.length === 0) {
    done.push(
      previous.line === step.line
        ? `Máy tính chuẩn bị chạy dòng ${step.line}.`
        : `Dòng ${previous.line} đã chạy xong, chưa có gì thay đổi.`
    )
  }
  return { done, next }
}

// ── frames: new/removed calls, and variables that appeared or changed ─────────

function explainFrames(step: TraceStep, previous: TraceStep): string[] {
  const sentences: string[] = []
  const before = new Map(previous.frames.map((frame) => [frame.id, frame]))
  const after = new Map(step.frames.map((frame) => [frame.id, frame]))

  for (const frame of step.frames) {
    if (before.has(frame.id)) continue
    sentences.push(
      `Máy tính gọi hàm ${frame.name} và mở một hộp mới để chứa biến của hàm đó.`
    )
  }
  for (const frame of previous.frames) {
    if (after.has(frame.id)) continue
    sentences.push(`Hàm ${frame.name} đã chạy xong nên hộp của nó được dọn đi.`)
  }

  for (const frame of step.frames) {
    const old = before.get(frame.id)
    if (!old) continue
    for (const [name, value] of Object.entries(frame.locals)) {
      if (name === "<truncated>") continue
      const had = old.locals[name]
      if (had === undefined) {
        sentences.push(`Tạo biến ${name} và gán cho nó ${valueText(value)}.`)
      } else if (!sameValue(had, value)) {
        sentences.push(
          `Biến ${name} đổi từ ${valueText(had)} thành ${valueText(value)}.`
        )
      }
    }
  }
  return sentences
}

// ── heap: objects created, and fields added or changed ───────────────────────

function explainHeap(step: TraceStep, previous: TraceStep): string[] {
  const sentences: string[] = []
  const before = new Map(previous.heap.map((node) => [node.id, node]))

  for (const node of step.heap) {
    const old = before.get(node.id)
    if (!old) {
      sentences.push(
        `Tạo một ${typeName(node.type)} mới trong bộ nhớ, đánh dấu ${heapBadge(node.id)}.`
      )
      continue
    }
    const added: string[] = []
    const changed: string[] = []
    for (const [field, value] of Object.entries(node.fields)) {
      if (field === "<truncated>") continue
      const had = old.fields[field]
      if (had === undefined) added.push(valueText(value))
      else if (!sameValue(had, value))
        changed.push(`${field} thành ${valueText(value)}`)
    }
    if (added.length > 0) {
      sentences.push(
        `Thêm ${joinVi(added)} vào ${typeName(node.type)} ${heapBadge(node.id)}.`
      )
    }
    if (changed.length > 0) {
      sentences.push(
        `Trong ${typeName(node.type)} ${heapBadge(node.id)}, đổi ${joinVi(changed)}.`
      )
    }
  }
  return sentences
}

function explainOutput(step: TraceStep, previous: TraceStep): string[] {
  const fresh = step.stdout.slice(previous.stdout.length)
  if (fresh.length === 0) return []
  return [
    `Máy tính in ra màn hình: ${joinVi(fresh.map((line) => `"${line}"`))}.`,
  ]
}

// ── helpers ──────────────────────────────────────────────────────────────────

function sameValue(a: TraceValue, b: TraceValue): boolean {
  if (a.kind !== b.kind) return false
  if (a.kind === "primitive" && b.kind === "primitive")
    return a.value === b.value
  if (a.kind === "reference" && b.kind === "reference") return a.id === b.id
  if (a.kind === "truncated" && b.kind === "truncated") {
    return a.preview === b.preview
  }
  return false
}

function joinVi(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? ""
  return `${parts.slice(0, -1).join(", ")} và ${parts[parts.length - 1]}`
}

function shorten(text: string): string {
  return text.length <= MAX_INLINE ? text : `${text.slice(0, MAX_INLINE - 1)}…`
}
