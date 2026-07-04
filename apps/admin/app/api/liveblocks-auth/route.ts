import { Liveblocks } from "@liveblocks/node"

import { auth } from "@/auth"

const liveblocks = new Liveblocks({
  secret: process.env.LIVEBLOCKS_SECRET_KEY ?? "",
})

export async function POST() {
  const session = await auth()
  if (!session?.user) return new Response("Unauthorized", { status: 401 })

  const lbSession = liveblocks.prepareSession(session.user.id, {
    userInfo: { name: session.user.name ?? session.user.email ?? "User" },
  })
  // ponytail: every signed-in user may join any page room — tighten to
  // workspace-scoped room IDs when sharing across workspaces matters.
  lbSession.allow("page:*", lbSession.FULL_ACCESS)

  const { status, body } = await lbSession.authorize()
  return new Response(body, { status })
}
