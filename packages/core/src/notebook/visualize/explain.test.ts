import { describe, expect, it } from "vitest"

import { explainStep, heapBadge, typeName, valueText } from "./explain"
import type { TraceStep } from "./types"

function step(over: Partial<TraceStep> = {}): TraceStep {
  return {
    index: 0,
    line: 1,
    event: "line",
    frames: [{ id: "f1", name: "<module>", line: 1, locals: {} }],
    heap: [],
    stdout: [],
    ...over,
  }
}

const SOURCE = [
  "items = [1]",
  "items.append(2)",
  "total = sum(items)",
  'print("total", total)',
]

describe("explainStep", () => {
  it("opens with a plain start sentence and the upcoming line", () => {
    expect(explainStep(step(), undefined, SOURCE)).toEqual({
      done: ["Chương trình bắt đầu chạy."],
      next: "Sắp chạy dòng 1: items = [1]",
    })
  })

  it("names a new variable and the value it received", () => {
    const previous = step()
    const current = step({
      index: 1,
      line: 2,
      frames: [
        {
          id: "f1",
          name: "<module>",
          line: 2,
          locals: { total: { kind: "primitive", value: 3 } },
        },
      ],
    })

    expect(explainStep(current, previous, SOURCE).done).toEqual([
      "Tạo biến total và gán cho nó 3.",
    ])
  })

  it("reports a changed variable with both values", () => {
    const previous = step({
      frames: [
        {
          id: "f1",
          name: "<module>",
          line: 1,
          locals: { total: { kind: "primitive", value: 3 } },
        },
      ],
    })
    const current = step({
      index: 1,
      line: 2,
      frames: [
        {
          id: "f1",
          name: "<module>",
          line: 2,
          locals: { total: { kind: "primitive", value: 5 } },
        },
      ],
    })

    expect(explainStep(current, previous, SOURCE).done).toEqual([
      "Biến total đổi từ 3 thành 5.",
    ])
  })

  it("explains a call and a return in child-friendly words", () => {
    const outer = step()
    const called = step({
      index: 1,
      frames: [
        outer.frames[0]!,
        { id: "f2", name: "tag", line: 1, locals: {} },
      ],
    })

    expect(explainStep(called, outer, SOURCE).done).toEqual([
      "Máy tính gọi hàm tag và mở một hộp mới để chứa biến của hàm đó.",
    ])
    expect(explainStep(outer, called, SOURCE).done).toEqual([
      "Hàm tag đã chạy xong nên hộp của nó được dọn đi.",
    ])
  })

  it("describes a new object and later additions to it", () => {
    const empty = step()
    const created = step({
      index: 1,
      heap: [{ id: "heap-1", type: "list", fields: {} }],
    })
    const grown = step({
      index: 2,
      heap: [
        {
          id: "heap-1",
          type: "list",
          fields: { "0": { kind: "primitive", value: 1 } },
        },
      ],
    })

    expect(explainStep(created, empty, SOURCE).done).toEqual([
      "Tạo một danh sách mới trong bộ nhớ, đánh dấu ①.",
    ])
    expect(explainStep(grown, created, SOURCE).done).toEqual([
      "Thêm 1 vào danh sách ①.",
    ])
  })

  it("reads out only the newly printed lines", () => {
    const before = step({ stdout: ["first"] })
    const after = step({ index: 1, stdout: ["first", "second", "third"] })

    expect(explainStep(after, before, SOURCE).done).toEqual([
      'Máy tính in ra màn hình: "second" và "third".',
    ])
  })

  it("says the program stopped when the step is an exception", () => {
    const result = explainStep(
      step({ line: 3, event: "exception" }),
      step(),
      SOURCE
    )
    expect(result.next).toBe("Chương trình dừng lại vì có lỗi ở dòng 3.")
  })

  it("does not claim a line ran when the step only re-reports the same line", () => {
    expect(
      explainStep(step({ index: 1, line: 2 }), step({ line: 2 }), SOURCE).done
    ).toEqual(["Máy tính chuẩn bị chạy dòng 2."])
  })

  it("says a line finished with no visible change", () => {
    expect(
      explainStep(step({ index: 1, line: 3 }), step({ line: 2 }), SOURCE).done
    ).toEqual(["Dòng 2 đã chạy xong, chưa có gì thay đổi."])
  })

  it("creates the object before saying a variable points at it", () => {
    const before = step()
    const after = step({
      index: 1,
      frames: [
        {
          id: "f1",
          name: "<module>",
          line: 1,
          locals: { diem: { kind: "reference", id: "heap-1", label: "list" } },
        },
      ],
      heap: [{ id: "heap-1", type: "list", fields: {} }],
    })

    expect(explainStep(after, before, SOURCE).done).toEqual([
      "Tạo một danh sách mới trong bộ nhớ, đánh dấu ①.",
      "Tạo biến diem và gán cho nó danh sách ①.",
    ])
  })

  it("ignores truncation markers so caps never leak into the wording", () => {
    const previous = step()
    const current = step({
      index: 1,
      frames: [
        {
          id: "f1",
          name: "<module>",
          line: 1,
          locals: {
            "<truncated>": { kind: "truncated", preview: "local scan limit" },
          },
        },
      ],
      heap: [
        {
          id: "heap-1",
          type: "list",
          fields: { "<truncated>": { kind: "truncated", preview: "80 items" } },
        },
      ],
    })

    const done = explainStep(current, previous, SOURCE).done
    expect(done.join(" ")).not.toContain("truncated")
    expect(done.join(" ")).not.toContain("scan limit")
  })
})

describe("wording helpers", () => {
  it("translates container types a ten-year-old will read", () => {
    expect(typeName("list")).toBe("danh sách")
    expect(typeName("Array")).toBe("danh sách")
    expect(typeName("dict")).toBe("từ điển")
    expect(typeName("Bag")).toBe("Bag")
  })

  it("numbers heap objects with circled digits", () => {
    expect(heapBadge("heap-1")).toBe("①")
    expect(heapBadge("heap-20")).toBe("⑳")
    expect(heapBadge("heap-21")).toBe("#21")
  })

  it("keeps literals as written and names references", () => {
    expect(valueText({ kind: "primitive", value: "apple" })).toBe('"apple"')
    expect(valueText({ kind: "primitive", value: 7 })).toBe("7")
    expect(
      valueText({ kind: "reference", id: "heap-2", label: "Object" })
    ).toBe("đối tượng ②")
    expect(valueText({ kind: "truncated", preview: "<heap limit>" })).toBe(
      "<heap limit>"
    )
  })
})
