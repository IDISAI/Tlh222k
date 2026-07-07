import { Dashboard } from "@workspace/core"

// Guests are redirected to /sign-in by proxy.ts before reaching this page.
export default function DashboardPage() {
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-8 text-4xl font-black uppercase tracking-tight">
        My Learning Progress
      </h1>
      <Dashboard />
    </main>
  )
}
