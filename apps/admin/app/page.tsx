import { redirect } from "next/navigation"

import { ROADMAPS_PATH } from "@/lib/paths"

// Admin lands straight on the roadmap CMS (not a placeholder dashboard).
export default function Page() {
  redirect(ROADMAPS_PATH)
}
