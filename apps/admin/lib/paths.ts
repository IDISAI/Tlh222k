// The app builds without Next basePath so Clerk proxy.ts runs on Vercel. Public
// URLs still keep /admin because the web host mounts this child zone there.
export const BASE_PATH = process.env.NODE_ENV === "production" ? "/admin" : ""

export const ROADMAPS_PATH = `${BASE_PATH}/roadmaps`
export const FORBIDDEN_PATH = `${BASE_PATH}/403`
export const NOTION_BASE_PATH = `${BASE_PATH}/notion`
