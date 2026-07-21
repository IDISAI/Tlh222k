import { Catch, type ArgumentsHost, type ExceptionFilter } from "@nestjs/common"

import { DomainError } from "../roadmap/domain/errors"
import { RoadmapError } from "./roadmap-error"

/**
 * Interface-adapter boundary: translates a framework-free `DomainError` into
 * the transport error the client expects (a `GraphQLError` carrying
 * `extensions.code`, produced by `RoadmapError`). This keeps the domain layer
 * free of any GraphQL/HTTP dependency (Clean Architecture dependency rule) —
 * domain code throws `DomainError`, only this edge knows about the wire format.
 *
 * Registered BEFORE the Sentry catch-all filter so it matches `DomainError`
 * first (expected business errors don't need Sentry noise).
 */
@Catch(DomainError)
export class DomainExceptionFilter implements ExceptionFilter {
  catch(exception: DomainError, _host: ArgumentsHost): never {
    throw new RoadmapError(exception.code, exception.message)
  }
}
