import fc from "fast-check"
import { describe, expect, it } from "vitest"

import { slugify, uniqueSlug } from "./slugify"

describe("slugify (notion-article-node Req 9)", () => {
  it("strips Vietnamese diacritics", () => {
    expect(slugify("Lập trình Web")).toBe("lap-trinh-web")
    expect(slugify("Nhập môn HTML")).toBe("nhap-mon-html")
    expect(slugify("Điều hướng")).toBe("dieu-huong")
  })

  it("falls back to 'untitled' for empty/special-only input (Req 9.1)", () => {
    expect(slugify("")).toBe("untitled")
    expect(slugify("!!! ***")).toBe("untitled")
    expect(slugify("💡🔥")).toBe("untitled")
  })

  // Tag: Feature: notion-article-node, Property 2: slugify output is always valid
  it("Property 2: output is always [a-z0-9-], 1-80 chars, no edge/double hyphens", () => {
    fc.assert(
      fc.property(fc.string(), (input) => {
        const slug = slugify(input)
        expect(slug).toMatch(/^[a-z0-9]$|^[a-z0-9][a-z0-9-]*[a-z0-9]$/)
        expect(slug.length).toBeGreaterThanOrEqual(1)
        expect(slug.length).toBeLessThanOrEqual(80)
        expect(slug).not.toMatch(/--/)
      }),
      { numRuns: 1000 }
    )
  })

  // Tag: Feature: notion-article-node, Property 4: slug immutability
  it("Property 4: slugify is deterministic (same input, same slug)", () => {
    fc.assert(
      fc.property(fc.string(), (input) => {
        expect(slugify(input)).toBe(slugify(input))
      }),
      { numRuns: 1000 }
    )
  })
})

describe("uniqueSlug (Req 9.2)", () => {
  it("returns the base when free", () => {
    expect(uniqueSlug("html", () => false)).toBe("html")
  })

  it("appends -2 .. -999 deterministically", () => {
    const taken = new Set(["html", "html-2", "html-3"])
    expect(uniqueSlug("html", (s) => taken.has(s))).toBe("html-4")
  })

  it("throws after 999 collisions", () => {
    expect(() => uniqueSlug("html", () => true)).toThrow()
  })

  // Tag: Feature: notion-article-node, Property 3: slug uniqueness
  it("Property 3: result is never in the taken set", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).map(slugify),
        fc.array(fc.integer({ min: 2, max: 20 })),
        (base, suffixes) => {
          const taken = new Set([base, ...suffixes.map((n) => `${base}-${n}`)])
          const result = uniqueSlug(base, (s) => taken.has(s))
          expect(taken.has(result)).toBe(false)
        }
      ),
      { numRuns: 500 }
    )
  })
})
