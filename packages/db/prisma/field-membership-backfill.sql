-- Preserve every existing implicit Field ↔ Node association before consumers
-- switch to the ordered explicit membership table. Safe to re-run.
INSERT INTO "FieldMembership" ("fieldId", "nodeId", "position", "createdAt")
SELECT
  legacy."A",
  legacy."B",
  ROW_NUMBER() OVER (PARTITION BY legacy."A" ORDER BY legacy."B") - 1,
  NOW()
FROM "_FieldToNode" AS legacy
ON CONFLICT ("fieldId", "nodeId") DO NOTHING;
