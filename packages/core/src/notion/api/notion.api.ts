// Backend-backed Notion domain client. Mirrors the (now-removed) core
// NotionService method-for-method so the Server Actions that consumed the
// service can call the same shapes over GraphQL. Every method takes the caller
// token as the last argument (null for public web reads).
import type {
  CreateDocumentInput,
  NotionDoc,
  UpdateDocumentInput,
} from "../types"
import { notionGql } from "./server-client"

const DOC_FIELDS = `
  id slug title isArchived parentDocumentId content coverImage icon
  isPublished position createdAt updatedAt
`

export const notionApi = {
  getById(id: string, token: string | null): Promise<NotionDoc | null> {
    return notionGql<{ notionDoc: NotionDoc | null }>(
      `query ($id: ID!) { notionDoc(id: $id) { ${DOC_FIELDS} } }`,
      { id },
      token
    ).then((d) => d.notionDoc)
  },

  getBySlug(slug: string, token: string | null): Promise<NotionDoc | null> {
    return notionGql<{ notionDocBySlug: NotionDoc | null }>(
      `query ($slug: String!) { notionDocBySlug(slug: $slug) { ${DOC_FIELDS} } }`,
      { slug },
      token
    ).then((d) => d.notionDocBySlug)
  },

  getChildren(
    parentDocumentId: string,
    token: string | null
  ): Promise<NotionDoc[]> {
    return notionGql<{ notionChildren: NotionDoc[] }>(
      `query ($p: ID!) { notionChildren(parentDocumentId: $p) { ${DOC_FIELDS} } }`,
      { p: parentDocumentId },
      token
    ).then((d) => d.notionChildren)
  },

  getTrash(token: string | null): Promise<NotionDoc[]> {
    return notionGql<{ notionTrash: NotionDoc[] }>(
      `query { notionTrash { ${DOC_FIELDS} } }`,
      {},
      token
    ).then((d) => d.notionTrash)
  },

  getSearch(token: string | null): Promise<NotionDoc[]> {
    return notionGql<{ notionSearch: NotionDoc[] }>(
      `query { notionSearch { ${DOC_FIELDS} } }`,
      {},
      token
    ).then((d) => d.notionSearch)
  },

  create(input: CreateDocumentInput, token: string | null): Promise<NotionDoc> {
    return notionGql<{ createNotionDoc: NotionDoc }>(
      `mutation ($input: CreateNotionDocInput!) {
         createNotionDoc(input: $input) { ${DOC_FIELDS} } }`,
      { input },
      token
    ).then((d) => d.createNotionDoc)
  },

  update(input: UpdateDocumentInput, token: string | null): Promise<NotionDoc> {
    return notionGql<{ updateNotionDoc: NotionDoc }>(
      `mutation ($input: UpdateNotionDocInput!) {
         updateNotionDoc(input: $input) { ${DOC_FIELDS} } }`,
      { input },
      token
    ).then((d) => d.updateNotionDoc)
  },

  archive(id: string, token: string | null): Promise<void> {
    return notionGql(
      `mutation ($id: ID!) { archiveNotionDoc(id: $id) }`,
      { id },
      token
    ).then(() => undefined)
  },

  restore(id: string, token: string | null): Promise<void> {
    return notionGql(
      `mutation ($id: ID!) { restoreNotionDoc(id: $id) }`,
      { id },
      token
    ).then(() => undefined)
  },

  remove(id: string, token: string | null): Promise<void> {
    return notionGql(
      `mutation ($id: ID!) { removeNotionDoc(id: $id) }`,
      { id },
      token
    ).then(() => undefined)
  },

  move(
    id: string,
    parentDocumentId: string | null,
    token: string | null
  ): Promise<NotionDoc> {
    return notionGql<{ moveNotionDoc: NotionDoc }>(
      `mutation ($id: ID!, $p: ID) { moveNotionDoc(id: $id, parentDocumentId: $p) { ${DOC_FIELDS} } }`,
      { id, p: parentDocumentId },
      token
    ).then((d) => d.moveNotionDoc)
  },

  reorder(
    parentDocumentId: string,
    orderedIds: string[],
    token: string | null
  ): Promise<void> {
    return notionGql(
      `mutation ($p: ID!, $ids: [ID!]!) { reorderNotionDocs(parentDocumentId: $p, orderedIds: $ids) }`,
      { p: parentDocumentId, ids: orderedIds },
      token
    ).then(() => undefined)
  },

  removeIcon(id: string, token: string | null): Promise<NotionDoc> {
    return notionGql<{ removeNotionIcon: NotionDoc }>(
      `mutation ($id: ID!) { removeNotionIcon(id: $id) { ${DOC_FIELDS} } }`,
      { id },
      token
    ).then((d) => d.removeNotionIcon)
  },

  removeCoverImage(id: string, token: string | null): Promise<NotionDoc> {
    return notionGql<{ removeNotionCover: NotionDoc }>(
      `mutation ($id: ID!) { removeNotionCover(id: $id) { ${DOC_FIELDS} } }`,
      { id },
      token
    ).then((d) => d.removeNotionCover)
  },
}
