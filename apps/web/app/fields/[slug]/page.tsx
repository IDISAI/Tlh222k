import { FieldRoadmaps } from "@/components/fields/field-roadmaps"

export const dynamic = "force-dynamic"

export default async function FieldRoadmapsPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  return <FieldRoadmaps slug={slug} />
}
