-- In-app notifications, and the opt-in that governs email.
CREATE TABLE IF NOT EXISTS "RoadmapNotification" (
  "id" TEXT NOT NULL,
  "clerkUserId" TEXT NOT NULL,
  "ownerNodeId" TEXT NOT NULL,
  "publishedAt" TIMESTAMP(3) NOT NULL,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RoadmapNotification_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RoadmapNotification_ownerNodeId_fkey"
    FOREIGN KEY ("ownerNodeId") REFERENCES "Node"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Exactly one notification per learner per publish. Without this a republish
-- stacks a second card on someone who has not read the first.
CREATE UNIQUE INDEX IF NOT EXISTS "RoadmapNotification_clerkUserId_ownerNodeId_publishedAt_key"
  ON "RoadmapNotification"("clerkUserId", "ownerNodeId", "publishedAt");

CREATE INDEX IF NOT EXISTS "RoadmapNotification_clerkUserId_readAt_idx"
  ON "RoadmapNotification"("clerkUserId", "readAt");

-- Email is strictly opt-in, so the default is false and an absent row reads
-- as "not opted in" rather than as consent.
CREATE TABLE IF NOT EXISTS "NotificationPreference" (
  "clerkUserId" TEXT NOT NULL,
  "emailOptedIn" BOOLEAN NOT NULL DEFAULT FALSE,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("clerkUserId")
);
