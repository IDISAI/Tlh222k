-- Favourites move off per-browser localStorage onto the account.
--
-- There is nothing to backfill: the previous store was each visitor's own
-- localStorage, which the server has never been able to read.
CREATE TABLE IF NOT EXISTS "UserRoadmapFavorite" (
  "clerkUserId" TEXT NOT NULL,
  "ownerNodeId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserRoadmapFavorite_pkey" PRIMARY KEY ("clerkUserId", "ownerNodeId"),
  CONSTRAINT "UserRoadmapFavorite_ownerNodeId_fkey"
    FOREIGN KEY ("ownerNodeId") REFERENCES "Node"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "UserRoadmapFavorite_ownerNodeId_idx"
  ON "UserRoadmapFavorite"("ownerNodeId");
