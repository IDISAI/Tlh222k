import { createParamDecorator, ExecutionContext } from "@nestjs/common"
import { GqlExecutionContext } from "@nestjs/graphql"
import type { CurrentUser as CurrentUserType } from "./clerk"

/**
 * Reads the user resolved once in the GraphQL context factory (app.module).
 * Null for guests.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): CurrentUserType | null => {
    const ctx = GqlExecutionContext.create(context).getContext<{
      user: CurrentUserType | null
    }>()
    return ctx.user ?? null
  }
)
