-- Files attached to a node.
--
-- No access column: an attachment inherits the entitlement of the node it
-- hangs off, so there is no second switch that can drift out of step with the
-- first. Gating happens on read, against the node.
CREATE TABLE IF NOT EXISTS "NodeAttachment" (
  "id" TEXT NOT NULL,
  "nodeId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "contentType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "uploadedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NodeAttachment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "NodeAttachment_nodeId_fkey"
    FOREIGN KEY ("nodeId") REFERENCES "Node"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "NodeAttachment_nodeId_createdAt_idx"
  ON "NodeAttachment"("nodeId", "createdAt");
