import { config } from "@workspace/eslint-config/base"

export default [...config, { ignores: ["src/interface/graphql/generated/**"] }]
