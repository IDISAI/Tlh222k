import { describe, expect, it } from "vitest"

import {
  LANGUAGES,
  kernelNameForProfile,
  languageSpec,
  profileForNotebook,
} from "./languages"

const EXPECTED_LANGUAGES = [
  ["python", "data-science", "python3"],
  ["javascript", "javascript", "deno"],
  ["cpp", "cpp", "xcpp17"],
  ["java", "java", "java"],
  ["rust", "rust", "rust"],
  ["go", "go", "gophernotes"],
  ["julia", "julia", "julia"],
] as const

describe("notebook language registry", () => {
  it("maps every supported language to its runtime profile and kernel", () => {
    expect(LANGUAGES).toHaveLength(7)

    for (const [language, profile, kernelName] of EXPECTED_LANGUAGES) {
      expect(languageSpec(language)).toMatchObject({
        language,
        profile,
        kernelName,
      })
      expect(kernelNameForProfile(profile)).toBe(kernelName)
    }

    expect(kernelNameForProfile("ml-cpu")).toBe("python3")
  })

  it("never executes an unknown language as Python", () => {
    expect(languageSpec("brainfuck")).toBeUndefined()
    expect(languageSpec(undefined)).toBeUndefined()
    expect(profileForNotebook("brainfuck")).toBeNull()
    expect(profileForNotebook(undefined)).toBeNull()
    expect(profileForNotebook("python", "ml-cpu")).toBe("ml-cpu")
    expect(profileForNotebook("python", "javascript")).toBe("data-science")
  })
})
