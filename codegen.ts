import type { CodegenConfig } from "@graphql-codegen/cli"

// One schema → typed resolvers (server) + typed documents/hooks (client).
// Run: pnpm codegen  (generated files are committed)
const config: CodegenConfig = {
  schema: "apps/svc-notion/src/interface/graphql/schema.graphql",
  generates: {
    "apps/svc-notion/src/interface/graphql/generated/resolvers-types.ts": {
      plugins: ["typescript", "typescript-resolvers"],
      config: {
        contextType: "../context#GraphQLContext",
        useIndexSignature: true,
        enumsAsTypes: true,
        scalars: { JSON: "unknown" },
        mapperTypeSuffix: "Model",
        mappers: {
          User: "../../../domain/entities#User",
          Workspace: "../../../domain/entities#Workspace",
          Page: "../../../domain/entities#Page",
          PageSummary: "../../../domain/entities#PageSummary",
          Database: "../../../domain/entities#DatabaseDef",
          DatabaseView: "../../../domain/entities#DatabaseView",
          Comment: "../../../domain/entities#Comment",
          Favorite: "../../../domain/entities#Favorite",
          PageVersion: "../../../domain/entities#PageVersion",
        },
      },
    },
    "packages/core/src/notion/graphql/generated/": {
      preset: "client",
      documents: ["packages/core/src/notion/**/*.{ts,tsx}"],
      config: { scalars: { JSON: "unknown" } },
      presetConfig: { fragmentMasking: false },
    },
  },
  ignoreNoDocuments: true,
}

export default config
