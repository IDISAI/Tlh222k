import { redirect } from "next/navigation"

import { USERS_PATH } from "@/lib/paths"

// Super-admin lands on the user-management console.
export default function Page() {
  redirect(USERS_PATH)
}
