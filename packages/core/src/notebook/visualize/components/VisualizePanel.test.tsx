import { act } from "react"
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  FIXTURE_ERROR_TRACE,
  FIXTURE_SOURCE,
  FIXTURE_TRACE,
  FIXTURE_TRUNCATED_TRACE,
} from "../fixtures"
import { VisualizePanel } from "./VisualizePanel"

afterEach(cleanup)

function renderPanel(over: Partial<Parameters<typeof VisualizePanel>[0]> = {}) {
  const onClose = vi.fn()
  const utils = render(
    <VisualizePanel
      source={FIXTURE_SOURCE}
      trace={FIXTURE_TRACE}
      onClose={onClose}
      {...over}
    />
  )
  return { onClose, ...utils }
}

const currentLine = () => {
  const lines = screen.getByLabelText("Source lines")
  const current = within(lines)
    .getAllByRole("listitem")
    .find((li) => li.getAttribute("aria-current") === "step")
  expect(current).toBeDefined()
  return current!
}

describe("VisualizePanel", () => {
  it("highlights the current step's source line with an arrow", () => {
    renderPanel()
    expect(currentLine().textContent).toContain("items = [1]")
    expect(currentLine().textContent).toContain("→")
  })

  it("renders variables, stack, heap, and output from the current step", async () => {
    const user = userEvent.setup()
    renderPanel()
    await user.click(screen.getByRole("button", { name: "Last step" }))

    const variables = screen.getByLabelText("Variables")
    expect(variables.textContent).toContain("items")
    expect(variables.textContent).toContain("list → heap-1")
    expect(variables.textContent).toContain("total")
    expect(variables.textContent).toContain("3")

    expect(screen.getByLabelText("Stack").textContent).toContain("<module>")
    const heap = screen.getByLabelText("Heap")
    expect(heap.textContent).toContain("heap-1")
    expect(heap.textContent).toContain("list")
    expect(screen.getByLabelText("Output").textContent).toContain("total 3")
  })

  it("disables first/previous at start, next/last at end", async () => {
    const user = userEvent.setup()
    renderPanel()
    const button = (name: string) => screen.getByRole("button", { name }) as HTMLButtonElement
    expect(button("First step").disabled).toBe(true)
    expect(button("Previous step").disabled).toBe(true)
    expect(button("Next step").disabled).toBe(false)

    await user.click(button("Last step"))
    expect(button("Next step").disabled).toBe(true)
    expect(button("Last step").disabled).toBe(true)
    expect(button("First step").disabled).toBe(false)
    expect(screen.getByText("Step 3 of 3")).toBeDefined()
  })

  describe("with fake timers", () => {
    // userEvent awaits real timers internally; use sync fireEvent here.
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

    it("play advances on the interval and stops at the end", () => {
      renderPanel()
      fireEvent.click(screen.getByRole("button", { name: "Play" }))

      act(() => void vi.advanceTimersByTime(600))
      expect(screen.getByText("Step 2 of 3")).toBeDefined()
      act(() => void vi.advanceTimersByTime(600))
      expect(screen.getByText("Step 3 of 3")).toBeDefined()
      // Stopped: button back to Play, further time does nothing.
      expect(screen.getByRole("button", { name: "Play" })).toBeDefined()
      act(() => void vi.advanceTimersByTime(2000))
      expect(screen.getByText("Step 3 of 3")).toBeDefined()
    })

    it("speed selector changes the tick interval", () => {
      renderPanel()
      fireEvent.change(screen.getByRole("combobox"), { target: { value: "2" } })
      fireEvent.click(screen.getByRole("button", { name: "Play" }))

      act(() => void vi.advanceTimersByTime(300))
      expect(screen.getByText("Step 2 of 3")).toBeDefined()
    })
  })

  it("fires onClose", async () => {
    const user = userEvent.setup()
    const { onClose } = renderPanel()
    await user.click(screen.getByRole("button", { name: "Close visualization" }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("announces error and truncation as status text", () => {
    renderPanel({ trace: FIXTURE_ERROR_TRACE })
    expect(
      screen
        .getAllByRole("status")
        .some((el) => el.textContent?.includes("ZeroDivisionError: division by zero"))
    ).toBe(true)
    cleanup()

    renderPanel({ trace: FIXTURE_TRUNCATED_TRACE })
    expect(
      screen.getAllByRole("status").some((el) => el.textContent?.includes("Trace truncated"))
    ).toBe(true)
  })

  it("shows loading and engine-unavailable states", () => {
    renderPanel({ loading: true })
    expect(screen.getByRole("status").textContent).toContain("Preparing trace")
    cleanup()

    renderPanel({ trace: null })
    expect(screen.getByRole("status").textContent).toContain("not available yet")
  })
})
