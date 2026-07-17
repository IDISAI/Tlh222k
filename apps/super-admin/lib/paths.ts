// The app builds without Next basePath so Clerk proxy.ts runs on Vercel. Public
// URLs still keep /super-admin because the web host mounts this child zone there.
export const BASE_PATH =
  process.env.NODE_ENV === "production" ? "/super-admin" : ""

export const USERS_PATH = `${BASE_PATH}/users`
export const SIGN_IN_PATH = `${BASE_PATH}/sign-in`
