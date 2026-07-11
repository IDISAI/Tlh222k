"use client"

import { useCallback, useState } from "react"

import { ExerciseView, NotebookView, type Notebook } from "@workspace/core"
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

  // The web app owns worker bundling; `new URL(..., import.meta.url)` resolves
  // against this file's directory (where pyodide.worker.ts lives).
  const createWorker = useCallback(
    () => new Worker(new URL("./pyodide.worker.ts", import.meta.url)),
    []
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
        <NotebookView
          notebook={tutorial}
          exerciseTitle={exercise?.title ?? undefined}
          onStartExercise={
            exercise !== null ? () => setTab("exercise") : undefined
          }
        />
      </TabsContent>

      <TabsContent value="exercise">
        {exercise && (
          <ExerciseView notebook={exercise} createWorker={createWorker} />
        )}
      </TabsContent>
    </Tabs>
  )
}
