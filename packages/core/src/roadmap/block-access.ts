import {
  canListRoadmap,
  canOpenRoadmap,
  type Discoverability,
  type LifecycleStatus,
} from "./access-policy"
import { normalizePublishStatus } from "./publish-status"

/**
 * Read a block's legacy tri-state as the two axes the contract actually names.
 *
 * `Node.publishStatus` is `DRAFT | PUBLISHED | PRIVATE`, which folds lifecycle
 * and discoverability into one value — the shape the contract forbids. The
 * important half is PRIVATE: it never meant "unfinished", it meant "do not
 * list". Treating it as unpublished made a direct link to an unlisted block
 * 404, which is exactly the case unlisted content exists to serve.
 *
 * `Roadmap` already has real columns for both. Blocks will too once the
 * migration reaches them; until then this is the one place that translates.
 */
export function axesOfBlock(raw: unknown): {
  lifecycleStatus: LifecycleStatus
  discoverability: Discoverability
} {
  const status = normalizePublishStatus(raw)
  if (status === "PRIVATE") {
    return { lifecycleStatus: "PUBLISHED", discoverability: "PRIVATE" }
  }
  return {
    lifecycleStatus: status === "PUBLISHED" ? "PUBLISHED" : "DRAFT",
    discoverability: "PUBLIC",
  }
}

/** Whether a direct link should render this block for a signed-out reader. */
export function blockOpensByLink(raw: unknown): boolean {
  return canOpenRoadmap(
    { ...axesOfBlock(raw), visibility: "FREE" },
    { authenticated: false, role: "guest" }
  )
}

/** Whether this block belongs in a listing, a tab strip, or search results. */
export function blockIsListed(raw: unknown): boolean {
  return canListRoadmap(
    { ...axesOfBlock(raw), visibility: "FREE" },
    { authenticated: false, role: "guest" }
  )
}
