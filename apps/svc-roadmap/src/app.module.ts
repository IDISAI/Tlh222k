import { join } from "path"
import { Module } from "@nestjs/common"
import { GraphQLModule } from "@nestjs/graphql"
import { ApolloDriver, type ApolloDriverConfig } from "@nestjs/apollo"
import type { Request } from "express"
import type { GraphQLFormattedError } from "graphql"

import { PrismaModule } from "./prisma/prisma.module"
import { RoadmapModule } from "./roadmap/roadmap.module"
import { resolveUser, type CurrentUser } from "./auth/clerk"

@Module({
  imports: [
    PrismaModule,
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      // Schema-first: load the SDL shared with the frontend codegen.
      typePaths: [join(__dirname, "schema.graphql")],
      playground: true,
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
  ],
})
export class AppModule {}
