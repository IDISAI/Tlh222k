import { describe, expect, it } from "vitest"
import { GraphQLError } from "graphql"

import { DomainError } from "../roadmap/domain/errors"
import { DomainExceptionFilter } from "./domain-exception.filter"

describe("DomainExceptionFilter", () => {
  const filter = new DomainExceptionFilter()

  it("maps a DomainError to a GraphQLError carrying extensions.code", () => {
    try {
      filter.catch(new DomainError("INVALID_URL", "bad url"), {} as never)
      throw new Error("filter did not rethrow")
    } catch (e) {
      expect(e).toBeInstanceOf(GraphQLError)
      expect((e as GraphQLError).extensions.code).toBe("INVALID_URL")
    }
  })

  it("preserves the original code for every domain code", () => {
    for (const code of ["NOT_FOUND", "PERMISSION_DENIED", "INVALID_HIERARCHY"] as const) {
      try {
        filter.catch(new DomainError(code), {} as never)
      } catch (e) {
        expect((e as GraphQLError).extensions.code).toBe(code)
      }
    }
  })
})
