import { handle } from "hono/vercel"

import { app } from "../src/app"

// Vercel entry — vercel.json rewrites every path here (Fluid Compute, Node).
export default handle(app)
