import { createParamDecorator, ExecutionContext } from "@nestjs/common"
import { GqlExecutionContext } from "@nestjs/graphql"
import type { CurrentUser as CurrentUserType } from "./clerk"
import type { RequestWithUser } from "./auth.middleware"

/**
 * Reads the resolved caller. GraphQL: from the Apollo context factory
 * (app.module). REST: from req.user set by AuthMiddleware. Null for guests.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): CurrentUserType | null => {
    if (context.getType() === "http") {
      const req = context.switchToHttp().getRequest<RequestWithUser>()
      return req.user ?? null
    }
    const ctx = GqlExecutionContext.create(context).getContext<{
      user: CurrentUserType | null
    }>()
    return ctx.user ?? null
  }
)
