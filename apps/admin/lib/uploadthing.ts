import { createUploadthing, type FileRouter } from "uploadthing/next"
import { UploadThingError } from "uploadthing/server"

import { auth } from "@/auth"

const f = createUploadthing()

// explicit FileRouter annotation: pnpm can't name the inferred type (TS2742)
export const fileRouter: FileRouter = {
  imageUploader: f({ image: { maxFileSize: "8MB", maxFileCount: 1 } })
    .middleware(async () => {
      const session = await auth()
      if (!session?.user) throw new UploadThingError("Unauthorized")
      return { userId: session.user.id }
    })
    .onUploadComplete(() => {
      // URL is returned to the client; nothing to persist here
    }),
}
