"use client"

import type { ReactNode } from "react"
import { ApolloProvider } from "@apollo/client"

import { getApolloClient } from "./client"

/**
 * Wraps an app in the shared Apollo Client so every roadmap read/write in that
 * zone goes through one transport + cache. Mount it once, high in each app's
 * layout (web / admin / super-admin).
 */
export function RoadmapApolloProvider({ children }: { children: ReactNode }) {
  return <ApolloProvider client={getApolloClient()}>{children}</ApolloProvider>
}
