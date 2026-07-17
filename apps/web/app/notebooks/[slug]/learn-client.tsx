"use client"

import { useMemo, useState } from "react"
import { useAuth, useClerk } from "@clerk/nextjs"

import {
  InteractiveNotebook,
  JupyterSandboxAdapter,
  PyodideKernelAdapter,
  SandboxSessionClient,
  type KernelAdapter,
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
export function LearnClient(props: LearnClientProps) {
  const isDev =
    devAuthRole(process.env.NODE_ENV, process.env.NEXT_PUBLIC_DEV_AUTH_ROLE) !==
    null

  if (isDev) {
    return <DevLearnClient {...props} />
  }

  return <ClerkLearnClient {...props} />
}

function DevLearnClient({ slug, tutorial, exercise }: LearnClientProps) {
  const [tab, setTab] = useState<LearnTab>("tutorial")
  const kernelUrl = process.env.NEXT_PUBLIC_KERNEL_SERVER_URL
  const isSignedIn = true

  const usePyodide = !kernelUrl
  const canRun = usePyodide || isSignedIn

  const getDevToken = async () => "dev-token"

  const makeAdapter = useMemo(
    () => (): KernelAdapter =>
      kernelUrl
        ? new JupyterSandboxAdapter(
            new SandboxSessionClient(kernelUrl, getDevToken),
            "data-science"
          )
        : new PyodideKernelAdapter(
            () => new Worker(new URL("./pyodide.worker.ts", import.meta.url))
          ),
    [kernelUrl]
  )
  const tutorialAdapter = useMemo(
    () => (canRun ? makeAdapter() : null),
    [canRun, makeAdapter]
  )
  const exerciseAdapter = useMemo(
    () => (canRun && exercise ? makeAdapter() : null),
    [canRun, exercise, makeAdapter]
  )

  return (
    <Tabs value={tab} onValueChange={(value) => setTab(value as LearnTab)}>
      <div className="border-b">
        <div className="mx-auto w-full max-w-6xl px-4 pt-6">
          <h1 className="text-2xl font-bold">{tutorial.title}</h1>
          <TabsList variant="line" className="mt-3 -mb-px">
            <TabsTrigger value="tutorial">Tutorial</TabsTrigger>
            <TabsTrigger value="exercise">Exercise</TabsTrigger>
          </TabsList>
        </div>
      </div>

      <TabsContent value="tutorial">
        <InteractiveNotebook
          notebook={tutorial}
          adapter={tutorialAdapter}
          signedIn={canRun}
          onSignIn={() => {}}
          exerciseTitle={exercise?.title ?? "Exercise"}
          onStartExercise={() => setTab("exercise")}
        />
      </TabsContent>

      <TabsContent value="exercise">
        {exercise ? (
          <InteractiveNotebook
            notebook={exercise}
            adapter={exerciseAdapter}
            signedIn={canRun}
            onSignIn={() => {}}
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

function ClerkLearnClient({ slug, tutorial, exercise }: LearnClientProps) {
  const [tab, setTab] = useState<LearnTab>("tutorial")
  const { getToken, isSignedIn: clerkSignedIn } = useAuth()
  const clerk = useClerk()
  const kernelUrl = process.env.NEXT_PUBLIC_KERNEL_SERVER_URL
  const isSignedIn = clerkSignedIn

  const usePyodide = !kernelUrl
  const canRun = usePyodide || isSignedIn

  const makeAdapter = useMemo(
    () => (): KernelAdapter =>
      kernelUrl
        ? new JupyterSandboxAdapter(
            new SandboxSessionClient(kernelUrl, getToken),
            "data-science"
          )
        : new PyodideKernelAdapter(
            () => new Worker(new URL("./pyodide.worker.ts", import.meta.url))
          ),
    [getToken, kernelUrl]
  )
  const tutorialAdapter = useMemo(
    () => (canRun ? makeAdapter() : null),
    [canRun, makeAdapter]
  )
  const exerciseAdapter = useMemo(
    () => (canRun && exercise ? makeAdapter() : null),
    [canRun, exercise, makeAdapter]
  )

  return (
    <Tabs value={tab} onValueChange={(value) => setTab(value as LearnTab)}>
      <div className="border-b">
        <div className="mx-auto w-full max-w-6xl px-4 pt-6">
          <h1 className="text-2xl font-bold">{tutorial.title}</h1>
          <TabsList variant="line" className="mt-3 -mb-px">
            <TabsTrigger value="tutorial">Tutorial</TabsTrigger>
            <TabsTrigger value="exercise">Exercise</TabsTrigger>
          </TabsList>
        </div>
      </div>

      <TabsContent value="tutorial">
        <InteractiveNotebook
          notebook={tutorial}
          adapter={tutorialAdapter}
          signedIn={canRun}
          onSignIn={() => void clerk.openSignIn()}
          exerciseTitle={exercise?.title ?? "Exercise"}
          onStartExercise={() => setTab("exercise")}
        />
      </TabsContent>

      <TabsContent value="exercise">
        {exercise ? (
          <InteractiveNotebook
            notebook={exercise}
            adapter={exerciseAdapter}
            signedIn={canRun}
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
