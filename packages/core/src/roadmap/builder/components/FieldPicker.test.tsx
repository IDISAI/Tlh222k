import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { FieldPicker } from "./FieldPicker"

const createField = vi.fn()

vi.mock("../../api", () => ({
  RoadmapService: class {
    listFields() {
      return Promise.resolve([
        {
          id: "field-ai",
          title: "AI",
          slug: "ai",
          order: 0,
          description: null,
          imageUrl: null,
          publishStatus: "PUBLISHED",
        },
      ])
    }

    createField(...args: unknown[]) {
      return createField(...args)
    }
  },
}))

describe("FieldPicker", () => {
  it("only selects existing Fields and never offers an inline create path", async () => {
    const user = userEvent.setup()

    render(
      <FieldPicker
        role="admin"
        value={[]}
        onChange={() => undefined}
      />
    )

    const input = await screen.findByRole("textbox")
    await user.type(input, "Quantum")

    expect(
      screen.queryByRole("button", { name: /Quantum/i })
    ).toBeNull()
    expect(createField).not.toHaveBeenCalled()
  })
})
