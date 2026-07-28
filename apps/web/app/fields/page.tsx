import { redirect } from "next/navigation"

/** Compatibility route; Field Explorer itself lives at /. */
export default function FieldsRedirect() {
  redirect("/")
}
