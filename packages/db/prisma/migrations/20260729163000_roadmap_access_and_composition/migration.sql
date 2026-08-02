-- Expand phase: split lifecycle, discoverability, and entitlement.
ALTER TABLE "Roadmap"
  ADD COLUMN IF NOT EXISTS "discoverability" TEXT NOT NULL DEFAULT 'PUBLIC',
  ADD COLUMN IF NOT EXISTS "visibility" TEXT NOT NULL DEFAULT 'FREE',
  ADD COLUMN IF NOT EXISTS "ownerId" TEXT,
  ADD COLUMN IF NOT EXISTS "roleTags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "dueDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "firstPublishedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);

-- PRIVATE was incorrectly stored as lifecycle. Preserve direct-link access
-- while removing it from discovery.
UPDATE "Roadmap"
SET
  "publishStatus" = 'PUBLISHED',
  "discoverability" = 'PRIVATE',
  "firstPublishedAt" = COALESCE("firstPublishedAt", "updatedAt")
WHERE UPPER("publishStatus") = 'PRIVATE';

UPDATE "Roadmap"
SET "firstPublishedAt" = COALESCE("firstPublishedAt", "updatedAt")
WHERE UPPER("publishStatus") = 'PUBLISHED';

ALTER TABLE "Node"
  ADD COLUMN IF NOT EXISTS "isRequired" BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS "CompositionMembership" (
  "ownerId" TEXT NOT NULL,
  "nodeId" TEXT NOT NULL,
  "scope" TEXT NOT NULL DEFAULT 'DRAFT',
  "positionX" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "positionY" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "isRequired" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CompositionMembership_pkey" PRIMARY KEY ("ownerId", "nodeId", "scope"),
  CONSTRAINT "CompositionMembership_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "Node"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CompositionMembership_nodeId_fkey"
    FOREIGN KEY ("nodeId") REFERENCES "Node"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "CompositionEdge" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "scope" TEXT NOT NULL DEFAULT 'DRAFT',
  "kind" TEXT NOT NULL DEFAULT 'solid',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CompositionEdge_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CompositionEdge_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "Node"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CompositionEdge_sourceId_fkey"
    FOREIGN KEY ("sourceId") REFERENCES "Node"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CompositionEdge_targetId_fkey"
    FOREIGN KEY ("targetId") REFERENCES "Node"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "NodeKeyResult" (
  "id" TEXT NOT NULL,
  "nodeId" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NodeKeyResult_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "NodeKeyResult_nodeId_fkey"
    FOREIGN KEY ("nodeId") REFERENCES "Node"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "Roadmap_publishStatus_discoverability_visibility_idx"
  ON "Roadmap"("publishStatus", "discoverability", "visibility");
CREATE INDEX IF NOT EXISTS "Roadmap_ownerId_idx" ON "Roadmap"("ownerId");
CREATE INDEX IF NOT EXISTS "Roadmap_archivedAt_idx" ON "Roadmap"("archivedAt");
CREATE INDEX IF NOT EXISTS "CompositionMembership_nodeId_idx"
  ON "CompositionMembership"("nodeId");
CREATE INDEX IF NOT EXISTS "CompositionMembership_ownerId_scope_idx"
  ON "CompositionMembership"("ownerId", "scope");
CREATE UNIQUE INDEX IF NOT EXISTS "CompositionEdge_ownerId_sourceId_targetId_scope_key"
  ON "CompositionEdge"("ownerId", "sourceId", "targetId", "scope");
CREATE INDEX IF NOT EXISTS "CompositionEdge_ownerId_scope_idx"
  ON "CompositionEdge"("ownerId", "scope");
CREATE INDEX IF NOT EXISTS "CompositionEdge_sourceId_idx"
  ON "CompositionEdge"("sourceId");
CREATE INDEX IF NOT EXISTS "CompositionEdge_targetId_idx"
  ON "CompositionEdge"("targetId");
CREATE INDEX IF NOT EXISTS "NodeKeyResult_nodeId_position_idx"
  ON "NodeKeyResult"("nodeId", "position");

-- Copy the legacy parentId layout into draft and published snapshots. This is
-- expand/contract: old readers keep working until all callers use memberships.
INSERT INTO "CompositionMembership"
  ("ownerId", "nodeId", "scope", "positionX", "positionY", "isRequired", "updatedAt")
SELECT
  "parentId",
  "id",
  scope,
  "positionX",
  "positionY",
  "isRequired",
  CURRENT_TIMESTAMP
FROM "Node"
CROSS JOIN (VALUES ('DRAFT'), ('PUBLISHED')) AS scopes(scope)
WHERE "parentId" IS NOT NULL
ON CONFLICT ("ownerId", "nodeId", "scope") DO NOTHING;

INSERT INTO "CompositionEdge"
  ("id", "ownerId", "sourceId", "targetId", "scope", "kind", "updatedAt")
SELECT
  'legacy-' || md5("parentId" || ':' || "id" || ':' || scope),
  "parentId",
  "parentId",
  "id",
  scope,
  'solid',
  CURRENT_TIMESTAMP
FROM "Node"
CROSS JOIN (VALUES ('DRAFT'), ('PUBLISHED')) AS scopes(scope)
WHERE "parentId" IS NOT NULL
ON CONFLICT ("ownerId", "sourceId", "targetId", "scope") DO NOTHING;
