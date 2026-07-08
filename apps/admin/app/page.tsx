import { redirect } from "next/navigation"

// Admin lands straight on the roadmap CMS (not a placeholder dashboard).
export default function Page() {
  redirect("/roadmaps")
}
