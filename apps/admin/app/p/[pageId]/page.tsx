import { notFound } from "next/navigation"

import { PublicPageView } from "@workspace/core"

const SVC_URL = process.env.NEXT_PUBLIC_NOTION_API_URL ?? "http://localhost:3004"

interface PublicPage {
  id: string
  title: string
  icon: string | null
  coverUrl: string | null
  content: unknown
}

async function getPublicPage(id: string): Promise<PublicPage | null> {
  const res = await fetch(`${SVC_URL}/graphql`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      query:
        "query PublicPage($id: ID!) { publicPage(id: $id) { id title icon coverUrl content } }",
      variables: { id },
    }),
    cache: "no-store",
  })
  if (!res.ok) return null
  const json = (await res.json()) as { data?: { publicPage: PublicPage | null } }
  return json.data?.publicPage ?? null
}

export default async function SharedPage({
  params,
}: {
  params: Promise<{ pageId: string }>
}) {
  const { pageId } = await params
  const page = await getPublicPage(pageId)
  if (!page) notFound()

  return (
    <div className="min-h-svh bg-white dark:bg-neutral-950">
      <PublicPageView
        title={page.title}
        icon={page.icon}
        coverUrl={page.coverUrl}
        content={page.content}
      />
      <footer className="py-10 text-center text-xs opacity-40">
        Được chia sẻ công khai · Notion clone
      </footer>
    </div>
  )
}
