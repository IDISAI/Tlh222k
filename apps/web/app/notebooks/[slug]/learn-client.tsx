"use client"

import { useMemo, useState } from "react"
import { useAuth, useClerk } from "@clerk/nextjs"

import {
  canRunNotebook,
  chooseRuntime,
  InteractiveNotebook,
  JupyterSandboxAdapter,
  PyodideKernelAdapter,
  runAvailability,
  SandboxSessionClient,
  profileForNotebook,
  useTraceEngines,
  WorkerKernelAdapter,
  type KernelAdapter,
  type Notebook,
  type RunAvailability,
  type TraceLanguage,
} from "@workspace/core"
import { devAuthRole } from "@workspace/core/navigation/role"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"

type LearnTab = "tutorial" | "exercise"

function availabilityOf(
  notebook: Notebook,
  kernelUrl: string | undefined
): RunAvailability {
  return runAvailability(notebook.language, {
    hasKernelServer: Boolean(kernelUrl),
  })
}

function createNotebookAdapter(
  notebook: Notebook,
  kernelUrl: string | undefined,
  getToken: () => Promise<string | null>
): KernelAdapter | null {
  const profile = profileForNotebook(notebook.language)
  if (!profile) return null

  const runtime = chooseRuntime(kernelUrl, process.env.NODE_ENV)
  if (runtime.kind === "kernel-server") {
    return new JupyterSandboxAdapter(
      new SandboxSessionClient(runtime.url, getToken),
      profile
    )
  }
  // A deployed environment with no kernel server gets no runtime at all.
  // Falling back would run a different engine, with different versions and no
  // installed packages, and show learners results the author never saw —
  // silently. The empty adapter surfaces as a disabled Run with a reason.
  if (runtime.kind === "unavailable") return null

  // Local development only: Python on Pyodide, JavaScript on the bundled
  // interpreter, so both stay usable without running the Go kernel-server.
  if (notebook.language === "python") {
    return new PyodideKernelAdapter(
      () => new Worker(new URL("./pyodide.worker.ts", import.meta.url))
    )
  }
  if (notebook.language === "javascript") {
    return new WorkerKernelAdapter(
      () => new Worker(new URL("./javascript-trace.worker.ts", import.meta.url))
    )
  }
  return null
}

/**
 * Trace worker entrypoints. Static `new URL(..., import.meta.url)` so the app's
 * bundler emits the chunk; the Worker itself is only constructed on the first
 * "Visualize execution" click.
 */
function createTraceWorker(language: TraceLanguage): Worker {
  return language === "python"
    ? new Worker(new URL("./pyodide.worker.ts", import.meta.url))
    : new Worker(new URL("./javascript-trace.worker.ts", import.meta.url))
}

interface LearnClientProps {
  slug: string
  tutorial: Notebook
  /** Companion exercise notebook; null = no exercise authored yet. */
  exercise: Notebook | null
}

/** /learn/[slug]: Kaggle-Learn-style Tutorial | Exercise tab pair. */
export function LearnClient(props: LearnClientProps) {
  const isDev =
    devAuthRole(
    process.env.NODE_ENV,
    process.env.NEXT_PUBLIC_DEV_AUTH_ROLE,
    process.env.NEXT_PUBLIC_ENABLE_DEV_AUTH_BYPASS
  ) !==
    null

  if (isDev) {
    return <DevLearnClient {...props} />
  }

  return <ClerkLearnClient {...props} />
}

function DevLearnClient({ slug, tutorial, exercise }: LearnClientProps) {
  const [tab, setTab] = useState<LearnTab>("tutorial")
  const kernelUrl = process.env.NEXT_PUBLIC_KERNEL_SERVER_URL
  // The dev bypass impersonates a signed-in learner, so the same rule applies
  // here as in the Clerk path — one policy, not two.
  const runVerdict = canRunNotebook({
    runtime: chooseRuntime(kernelUrl, process.env.NODE_ENV),
    authenticated: true,
  })
  const canRun = runVerdict.ok

  const getDevToken = async () => "dev-token"

  const makeAdapter = useMemo(
    () =>
      (notebook: Notebook): KernelAdapter | null =>
        createNotebookAdapter(notebook, kernelUrl, getDevToken),
    [kernelUrl]
  )
  const tutorialAdapter = useMemo(
    () => (canRun ? makeAdapter(tutorial) : null),
    [canRun, makeAdapter, tutorial]
  )
  const exerciseAdapter = useMemo(
    () => (canRun && exercise ? makeAdapter(exercise) : null),
    [canRun, exercise, makeAdapter]
  )
  // Tutorial only: Exercise-cell visualization is out of scope.
  const createTrace = useTraceEngines(createTraceWorker)

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
          runAvailability={availabilityOf(tutorial, kernelUrl)}
          onSignIn={() => {}}
          exerciseTitle={exercise?.title ?? "Exercise"}
          onStartExercise={() => setTab("exercise")}
          createTrace={createTrace}
        />
      </TabsContent>

      <TabsContent value="exercise">
        {exercise ? (
          <InteractiveNotebook
            notebook={exercise}
            adapter={exerciseAdapter}
            signedIn={canRun}
            runAvailability={availabilityOf(exercise, kernelUrl)}
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

  // Running costs someone's compute, so it needs an account — a guest reads
  // the committed code and its saved output, which is the content itself.
  // Previously a missing kernel URL made Run available to everyone, which is
  // how the deployed default came to be an unauthenticated Pyodide session.
  const runtime = chooseRuntime(kernelUrl, process.env.NODE_ENV)
  const runVerdict = canRunNotebook({
    runtime,
    authenticated: Boolean(isSignedIn),
  })
  const canRun = runVerdict.ok

  const makeAdapter = useMemo(
    () =>
      (notebook: Notebook): KernelAdapter | null =>
        createNotebookAdapter(notebook, kernelUrl, getToken),
    [getToken, kernelUrl]
  )
  const tutorialAdapter = useMemo(
    () => (canRun ? makeAdapter(tutorial) : null),
    [canRun, makeAdapter, tutorial]
  )
  const exerciseAdapter = useMemo(
    () => (canRun && exercise ? makeAdapter(exercise) : null),
    [canRun, exercise, makeAdapter]
  )
  // Tutorial only: Exercise-cell visualization is out of scope.
  const createTrace = useTraceEngines(createTraceWorker)

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
          runAvailability={availabilityOf(tutorial, kernelUrl)}
          onSignIn={() => void clerk.openSignIn()}
          exerciseTitle={exercise?.title ?? "Exercise"}
          onStartExercise={() => setTab("exercise")}
          createTrace={createTrace}
        />
      </TabsContent>

      <TabsContent value="exercise">
        {exercise ? (
          <InteractiveNotebook
            notebook={exercise}
            adapter={exerciseAdapter}
            signedIn={canRun}
            runAvailability={availabilityOf(exercise, kernelUrl)}
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
