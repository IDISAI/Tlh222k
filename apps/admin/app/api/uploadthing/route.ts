import { createRouteHandler } from "uploadthing/next"

import { fileRouter } from "@/lib/uploadthing"

export const { GET, POST } = createRouteHandler({
  router: fileRouter,
  config: {
    // basePath "/admin" — default callback URL misses it and the upload
    // callback 404s
    callbackUrl:
      process.env.UPLOADTHING_CALLBACK_URL ??
      "http://localhost:3002/admin/api/uploadthing",
  },
})
