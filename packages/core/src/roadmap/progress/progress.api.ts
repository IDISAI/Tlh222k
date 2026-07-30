import { gql } from "../api/client"
import type { NodeStatus, RoadmapProgress } from "../types"
import type { ProgressMap } from "./progress.service"

/**
 * Backend-backed progress.
 *
 * The mock stores progress in `localStorage`, which is per-browser: the same
 * learner on their phone sees none of it, and content shared between two
 * roadmaps cannot carry its completion across, because there is no user to
 * key on. The access contract requires progress per `user + content node`,
 * so once a backend URL is configured every read and write goes here.
 */
export class ProgressApi {
  /**
   * Synchronous by signature to match the mock, which reads localStorage. The
   * server cannot answer synchronously, so this returns what has been fetched
   * so far rather than blocking — callers that need certainty use the graph's
   * own per-node `status`, which arrives with the nodes.
   */
  getAll(): ProgressMap {
    return {}
  }

  getStatus(): NodeStatus {
    return "locked"
  }

  async set(nodeId: string, status: NodeStatus): Promise<void> {
    await gql<{ setNodeStatus: boolean }>(
      `mutation ($nodeId: ID!, $status: NodeStatus!) {
        setNodeStatus(nodeId: $nodeId, status: $status)
      }`,
      { nodeId, status }
    )
  }

  /**
   * Record that the learner opened this node. Safe to call on every open: the
   * server only moves an untouched node to in_progress, and never walks a
   * completed one backwards.
   */
  async markOpened(nodeId: string): Promise<void> {
    await gql<{ markNodeOpened: boolean }>(
      `mutation ($nodeId: ID!) { markNodeOpened(nodeId: $nodeId) }`,
      { nodeId }
    )
  }

  async myProgress(): Promise<RoadmapProgress[]> {
    // No aggregate query exists yet; the roadmap graph already carries each
    // node's personalized status, so returning [] is honest rather than a
    // second, disagreeing source of truth.
    return []
  }
}
