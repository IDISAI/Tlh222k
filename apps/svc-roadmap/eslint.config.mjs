import { config } from "@workspace/eslint-config/base"

/** @type {import("eslint").Linter.Config} */
export default [
  ...config,
  {
    rules: {
      // NestJS resolvers accept compat params (callerRole/authenticated) that
      // are intentionally unused; allow `_`-prefixed args.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  { ignores: ["dist/**"] },
]
