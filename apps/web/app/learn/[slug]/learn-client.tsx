"use client"

import { useMemo, useState } from "react"
import { useAuth, useClerk } from "@clerk/nextjs"

import {
  InteractiveNotebook,
  JupyterSandboxAdapter,
  SandboxSessionClient,
  type Notebook,
} from "@workspace/core"
import { devAuthRole } from "@workspace/core/navigation/role"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"

type LearnTab = "tutorial" | "exercise"

interface LearnClientProps {
  slug: string
  tutorial: Notebook
  /** Companion exercise notebook; null = no exercise authored yet. */
  exercise: Notebook | null
}

/** /learn/[slug]: Kaggle-Learn-style Tutorial | Exercise tab pair. */
export function LearnClient({ slug, tutorial, exercise }: LearnClientProps) {
  const [tab, setTab] = useState<LearnTab>("tutorial")
  const { getToken, isSignedIn: clerkSignedIn } = useAuth()
  const clerk = useClerk()
  const kernelUrl = process.env.NEXT_PUBLIC_KERNEL_SERVER_URL
  const isSignedIn =
    clerkSignedIn ||
    Boolean(devAuthRole(process.env.NODE_ENV, process.env.NEXT_PUBLIC_DEV_AUTH_ROLE))

  const tutorialAdapter = useMemo(
    () =>
      isSignedIn && kernelUrl
        ? new JupyterSandboxAdapter(
            new SandboxSessionClient(kernelUrl, getToken),
            "data-science"
          )
        : null,
    [getToken, isSignedIn, kernelUrl]
  )
  const exerciseAdapter = useMemo(
    () =>
      isSignedIn && kernelUrl && exercise
        ? new JupyterSandboxAdapter(
            new SandboxSessionClient(kernelUrl, getToken),
            "data-science"
          )
        : null,
    [exercise, getToken, isSignedIn, kernelUrl]
  )

  return (
    <Tabs value={tab} onValueChange={(value) => setTab(value as LearnTab)}>
      <div className="border-b">
        <div className="mx-auto w-full max-w-6xl px-4 pt-6">
          <h1 className="text-2xl font-bold">{tutorial.title}</h1>
          <TabsList variant="line" className="mt-3 -mb-px">
            <TabsTrigger value="tutorial">Tutorial</TabsTrigger>
            {/* Exercise tab is always enabled; shows placeholder when no exercise authored */}
            <TabsTrigger value="exercise">Exercise</TabsTrigger>
          </TabsList>
        </div>
      </div>

      <TabsContent value="tutorial">
        <InteractiveNotebook
          notebook={tutorial}
          adapter={tutorialAdapter}
          signedIn={Boolean(isSignedIn && kernelUrl)}
          onSignIn={() => void clerk.openSignIn()}
          exerciseTitle={exercise?.title}
          onStartExercise={exercise ? () => setTab("exercise") : undefined}
        />
      </TabsContent>

      <TabsContent value="exercise">
        {exercise ? (
          <InteractiveNotebook
            notebook={exercise}
            adapter={exerciseAdapter}
            signedIn={Boolean(isSignedIn && kernelUrl)}
            onSignIn={() => void clerk.openSignIn()}
          />
        ) : (
          <div className="mx-auto flex min-h-[50vh] w-full max-w-lg flex-col items-center justify-center gap-3 px-4 text-center">
            <p className="text-5xl">🚧</p>
            <h2 className="text-lg font-semibold">Exercise coming soon</h2>
            <p className="text-sm text-muted-foreground">
              Bài tập cho notebook này đang được chuẩn bị. Admin có thể tạo
              notebook với slug{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                {slug}-exercise
              </code>{" "}
              và xuất bản để kích hoạt tab này.
            </p>
          </div>
        )}
      </TabsContent>
    </Tabs>
  )
}
