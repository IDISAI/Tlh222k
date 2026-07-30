-- A learner's roadmap completion, stamped once.
--
-- Recomputing "completed" from node progress alone means an editor who adds a
-- required node silently un-completes everyone who had already finished. The
-- access contract forbids revoking a completion, so it is recorded as an event
-- rather than derived on every read.
CREATE TABLE IF NOT EXISTS "UserRoadmapCompletion" (
  "clerkUserId" TEXT NOT NULL,
  "ownerNodeId" TEXT NOT NULL,
  "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserRoadmapCompletion_pkey" PRIMARY KEY ("clerkUserId", "ownerNodeId"),
  CONSTRAINT "UserRoadmapCompletion_ownerNodeId_fkey"
    FOREIGN KEY ("ownerNodeId") REFERENCES "Node"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "UserRoadmapCompletion_ownerNodeId_idx"
  ON "UserRoadmapCompletion"("ownerNodeId");

-- Backfill: anyone who has already finished every required node of a block has
-- earned that completion, and must keep it even if the block grows tomorrow.
-- Blocks with no required node are excluded — nothing to finish is not the
-- same as finished.
INSERT INTO "UserRoadmapCompletion" ("clerkUserId", "ownerNodeId", "completedAt")
SELECT
  progress."clerkUserId",
  membership."ownerId",
  CURRENT_TIMESTAMP
FROM "CompositionMembership" membership
JOIN "UserProgress" progress ON progress."nodeId" = membership."nodeId"
WHERE membership."scope" = 'PUBLISHED' AND membership."isRequired" = TRUE
GROUP BY progress."clerkUserId", membership."ownerId"
HAVING COUNT(*) FILTER (WHERE progress."status" = 'done') = (
  SELECT COUNT(*)
  FROM "CompositionMembership" required
  WHERE required."ownerId" = membership."ownerId"
    AND required."scope" = 'PUBLISHED'
    AND required."isRequired" = TRUE
)
ON CONFLICT ("clerkUserId", "ownerNodeId") DO NOTHING;
