import { join } from "path"
import { Module, type MiddlewareConsumer, type NestModule } from "@nestjs/common"
import { APP_FILTER } from "@nestjs/core"
import { GraphQLModule } from "@nestjs/graphql"
import { ApolloDriver, type ApolloDriverConfig } from "@nestjs/apollo"
import { ApolloServerPluginLandingPageLocalDefault } from "@apollo/server/plugin/landingPage/default"
import { SentryModule, SentryGlobalFilter } from "@sentry/nestjs/setup"
import type { Request } from "express"
import type { GraphQLFormattedError } from "graphql"

const IS_PROD = process.env.NODE_ENV === "production"

import { PrismaModule } from "./prisma/prisma.module"
import { RoadmapModule } from "./roadmap/roadmap.module"
import { NotionModule } from "./notion/notion.module"
import { resolveUser, type CurrentUser } from "./auth/clerk"
import { AuthMiddleware } from "./auth/auth.middleware"

@Module({
  imports: [
    // Must be imported before other modules so Sentry can instrument them.
    SentryModule.forRoot(),
    PrismaModule,
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      // Schema-first: load the SDL shared with the frontend codegen.
      typePaths: [join(__dirname, "schema.graphql")],
      // Apollo Sandbox (embedded) replaces the legacy Playground, dev only.
      // Introspection + Sandbox both expose the schema, so gate on prod.
      playground: false,
      introspection: !IS_PROD,
      plugins: IS_PROD
        ? []
        : [ApolloServerPluginLandingPageLocalDefault({ embed: true })],
      // Resolve the Clerk user ONCE per request; resolvers read ctx.user.
      context: async ({
        req,
      }: {
        req: Request
      }): Promise<{ user: CurrentUser | null }> => ({
        user: await resolveUser(req.headers.authorization),
      }),
      // Preserve extensions.code (RoadmapError) so the client can reconstruct
      // the typed error; hide internal stack traces.
      formatError: (formatted: GraphQLFormattedError): GraphQLFormattedError => ({
        message: formatted.message,
        extensions: { code: formatted.extensions?.code ?? "INTERNAL_ERROR" },
        path: formatted.path,
      }),
    }),
    RoadmapModule,
    NotionModule,
  ],
  providers: [
    // Catches unhandled exceptions and reports them to Sentry, then re-throws
    // so Nest's / Apollo's existing error handling still runs.
    { provide: APP_FILTER, useClass: SentryGlobalFilter },
  ],
})
export class AppModule implements NestModule {
  // Resolve the Clerk caller for REST requests (GraphQL does it in the Apollo
  // context factory above). Runs on every route; guards decide access.
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(AuthMiddleware).forRoutes("*")
  }
}
