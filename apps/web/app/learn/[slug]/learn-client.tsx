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
  tutorial: Notebook
  /** Companion exercise notebook; null = no exercise for this slug. */
  exercise: Notebook | null
}

/** /learn/[slug]: Kaggle-Learn-style Tutorial | Exercise tab pair. */
export function LearnClient({ tutorial, exercise }: LearnClientProps) {
  const [tab, setTab] = useState<LearnTab>("tutorial")
  const { getToken, isSignedIn: clerkSignedIn } = useAuth()
  const clerk = useClerk()
  const kernelUrl = process.env.NEXT_PUBLIC_KERNEL_SERVER_URL
  // Dev-only bypass mirrors the server side: kernel-server skips JWT checks too.
  const isSignedIn =
    clerkSignedIn ||
    Boolean(devAuthRole(process.env.NODE_ENV, process.env.NEXT_PUBLIC_DEV_AUTH_ROLE))
  const tutorialAdapter = useMemo(
    () => isSignedIn && kernelUrl
      ? new JupyterSandboxAdapter(new SandboxSessionClient(kernelUrl, getToken), "data-science")
      : null,
    [getToken, isSignedIn, kernelUrl]
  )
  const exerciseAdapter = useMemo(
    () => isSignedIn && kernelUrl && exercise
      ? new JupyterSandboxAdapter(new SandboxSessionClient(kernelUrl, getToken), "data-science")
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
            <TabsTrigger value="exercise" disabled={exercise === null}>
              Exercise
            </TabsTrigger>
          </TabsList>
        </div>
      </div>

      <TabsContent value="tutorial">
        <InteractiveNotebook
          notebook={tutorial}
          adapter={tutorialAdapter}
          signedIn={Boolean(isSignedIn && kernelUrl)}
          onSignIn={() => void clerk.openSignIn()}
        />
      </TabsContent>

      <TabsContent value="exercise">
        {exercise && (
          <InteractiveNotebook
            notebook={exercise}
            adapter={exerciseAdapter}
            signedIn={Boolean(isSignedIn && kernelUrl)}
            onSignIn={() => void clerk.openSignIn()}
          />
        )}
      </TabsContent>
    </Tabs>
  )
}
