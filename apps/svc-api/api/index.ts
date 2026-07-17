// Vercel serverless entry. Thin wrapper with no decorators, so esbuild (used by
// @vercel/node) can compile it safely. The real Nest bootstrap lives in
// src/serverless.ts and is compiled by `nest build` (tsc) into dist/ WITH
// decorator metadata — importing the built JS here preserves that metadata so
// NestJS DI works. See vercel.json for the install/build wiring.
export { default } from "../dist/serverless"
