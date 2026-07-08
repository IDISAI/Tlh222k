import { redirect } from "next/navigation"
import { BuilderPage } from "@workspace/core"

import { getRole } from "@/lib/auth"
import { ROADMAPS_PATH } from "@/lib/paths"

export const metadata = { title: "Roadmap Builder" }

export default async function BuilderCanvasPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const role = await getRole()
  if (role !== "admin" && role !== "super-admin") redirect("/403")

  // Data loads client-side inside BuilderPage: the mock store persists to
  // localStorage, which this server render can never see (ponytail: swap for
  // a server-side GraphQL fetch + notFound() once svc-roadmap exists).
  return <BuilderPage roadmapId={id} role={role} listHref={ROADMAPS_PATH} />
}
