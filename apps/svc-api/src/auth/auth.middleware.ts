import { Injectable, type NestMiddleware } from "@nestjs/common"
import type { Request, Response, NextFunction } from "express"

import { resolveUser, type CurrentUser } from "./clerk"

// Express request augmented with the resolved caller. The GraphQL path resolves
// the user in the Apollo context factory (app.module); this middleware does the
// same for REST so @CurrentUser() works on controllers too.
export interface RequestWithUser extends Request {
  user?: CurrentUser | null
}

/**
 * Resolves the Clerk caller once per REST request and stashes it on req.user.
 * Never rejects — guards (assertCanWrite / AdminGuard) decide access; public
 * reads still work with user = null.
 */
@Injectable()
export class AuthMiddleware implements NestMiddleware {
  async use(
    req: RequestWithUser,
    _res: Response,
    next: NextFunction
  ): Promise<void> {
    req.user = await resolveUser(req.headers.authorization)
    next()
  }
}
