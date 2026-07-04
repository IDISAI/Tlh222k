// ponytail: REST is contract-only — Swagger /docs demos these fixtures,
// real data flows exclusively through GraphQL (/graphql).

const NOW = "2026-01-01T00:00:00.000Z"

export const MOCK_WORKSPACE = {
  id: "mock-workspace-1",
  name: "Acme Workspace",
  icon: null,
  createdAt: NOW,
  updatedAt: NOW,
}

export const MOCK_PAGE_SUMMARY = {
  id: "mock-page-1",
  workspaceId: MOCK_WORKSPACE.id,
  parentId: null,
  title: "Getting started",
  icon: "📄",
  rank: "a0",
  updatedAt: NOW,
}

export const MOCK_PAGE = {
  ...MOCK_PAGE_SUMMARY,
  coverUrl: null,
  content: [
    {
      id: "block-1",
      type: "paragraph",
      content: [{ type: "text", text: "Hello from the mock contract." }],
    },
  ],
  properties: { status: "Done", points: 8 },
  visibility: "WORKSPACE",
  isPublic: false,
  createdById: "mock-user-1",
  deletedAt: null,
  createdAt: NOW,
}

export const MOCK_VIEW = {
  id: "mock-view-1",
  databaseId: "mock-database-1",
  type: "TABLE",
  name: "Table",
  config: {
    filters: [{ propertyId: "status", op: "eq", value: "Done" }],
    sorts: [{ propertyId: "points", direction: "desc" }],
  },
  rank: "a0",
}

export const MOCK_DATABASE = {
  id: "mock-database-1",
  pageId: MOCK_PAGE.id,
  propertySchema: [
    { id: "status", name: "Status", type: "select", options: ["Todo", "Done"] },
    { id: "points", name: "Points", type: "number" },
  ],
}

export const MOCK_COMMENT = {
  id: "mock-comment-1",
  pageId: MOCK_PAGE.id,
  blockId: "block-1",
  parentId: null,
  authorId: "mock-user-1",
  body: "Looks good to me.",
  resolvedAt: null,
  createdAt: NOW,
  updatedAt: NOW,
}

export const MOCK_FAVORITE = {
  id: "mock-favorite-1",
  userId: "mock-user-1",
  pageId: MOCK_PAGE.id,
  rank: "a0",
}

export const MOCK_VERSION = {
  id: "mock-version-1",
  pageId: MOCK_PAGE.id,
  title: MOCK_PAGE.title,
  content: MOCK_PAGE.content,
  createdById: "mock-user-1",
  createdAt: NOW,
}
