import { redirect } from "next/navigation"

// Super-admin lands on the user-management console.
export default function Page() {
  redirect("/users")
}
