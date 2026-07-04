import { GraphQLError } from "graphql"
import { GraphQLJSON } from "graphql-scalars"

import {
  comments,
  databases,
  favorites,
  pages,
  users,
  versions,
  workspaces,
} from "../../container"
import { ForbiddenError } from "../../domain/errors"
import type { GraphQLContext } from "./context"
import type { Resolvers } from "./generated/resolvers-types"

const iso = (d: Date) => d.toISOString()
const isoOrNull = (d: Date | null) => (d ? d.toISOString() : null)

function requireUser(ctx: GraphQLContext): string {
  if (!ctx.userId) {
    throw new GraphQLError("Sign in required", {
      extensions: { code: "UNAUTHENTICATED" },
    })
  }
  return ctx.userId
}

/** Domain ForbiddenError → GraphQL FORBIDDEN. */
async function guard<T>(op: Promise<T>): Promise<T> {
  try {
    return await op
  } catch (e) {
    if (e instanceof ForbiddenError) {
      throw new GraphQLError(e.message, { extensions: { code: "FORBIDDEN" } })
    }
    throw e
  }
}

export const resolvers: Resolvers = {
  JSON: GraphQLJSON,

  Workspace: { createdAt: (w) => iso(w.createdAt) },
  PageSummary: { updatedAt: (p) => iso(p.updatedAt) },
  Page: {
    createdAt: (p) => iso(p.createdAt),
    updatedAt: (p) => iso(p.updatedAt),
    deletedAt: (p) => isoOrNull(p.deletedAt),
    content: (p) => p.content ?? null,
    properties: (p) => p.properties ?? null,
  },
  Comment: {
    createdAt: (c) => iso(c.createdAt),
    resolvedAt: (c) => isoOrNull(c.resolvedAt),
  },
  PageVersion: {
    createdAt: (v) => iso(v.createdAt),
    content: (v) => v.content ?? null,
  },
  Database: {
    propertySchema: (db) => db.propertySchema,
    views: (db) => databases.views(db.id),
  },
  DatabaseView: { config: (v) => v.config },

  Query: {
    me: (_, __, ctx) => users.me(requireUser(ctx)),
    workspaces: (_, __, ctx) => workspaces.list(requireUser(ctx)),
    pages: (_, args, ctx) => guard(pages.tree(requireUser(ctx), args.workspaceId)),
    page: (_, args, ctx) => guard(pages.get(requireUser(ctx), args.id)),
    publicPage: (_, args) => pages.getPublic(args.id),
    trash: (_, args, ctx) =>
      guard(pages.listTrash(requireUser(ctx), args.workspaceId)),
    search: (_, args, ctx) =>
      guard(pages.search(requireUser(ctx), args.workspaceId, args.query)),
    database: (_, args, ctx) => guard(databases.get(requireUser(ctx), args.id)),
    databaseByPage: (_, args, ctx) =>
      guard(databases.getByPage(requireUser(ctx), args.pageId)),
    databaseRows: async (_, args, ctx) =>
      (await guard(databases.rows(requireUser(ctx), args.databaseId, args.viewId))) ??
      [],
    comments: (_, args, ctx) =>
      guard(comments.listByPage(requireUser(ctx), args.pageId)),
    favorites: (_, __, ctx) => favorites.list(requireUser(ctx)),
    versions: (_, args, ctx) =>
      guard(versions.listByPage(requireUser(ctx), args.pageId)),
  },

  Mutation: {
    createWorkspace: (_, args, ctx) =>
      workspaces.create(requireUser(ctx), args.name),

    createPage: (_, args, ctx) =>
      guard(
        pages.create(requireUser(ctx), {
          workspaceId: args.workspaceId,
          parentId: args.parentId,
          title: args.title,
          content: args.content ?? undefined,
          properties: args.properties ?? undefined,
        })
      ),
    updatePage: (_, { id, ...data }, ctx) =>
      guard(
        pages.update(requireUser(ctx), id, {
          title: data.title ?? undefined,
          icon: data.icon,
          coverUrl: data.coverUrl,
          content: data.content ?? undefined,
          properties: data.properties ?? undefined,
          parentId: data.parentId,
          isPublic: data.isPublic ?? undefined,
          visibility: data.visibility ?? undefined,
        })
      ),
    trashPage: (_, args, ctx) => guard(pages.trash(requireUser(ctx), args.id)),
    restorePage: (_, args, ctx) => guard(pages.restore(requireUser(ctx), args.id)),
    purgePage: (_, args, ctx) => guard(pages.purge(requireUser(ctx), args.id)),
    duplicatePage: (_, args, ctx) =>
      guard(pages.duplicate(requireUser(ctx), args.id)),

    createDatabase: (_, args, ctx) =>
      guard(
        databases.createOnPage(
          requireUser(ctx),
          args.pageId,
          args.propertySchema as never
        )
      ),
    updateDatabaseSchema: (_, args, ctx) =>
      guard(
        databases.updateSchema(requireUser(ctx), args.id, args.propertySchema as never)
      ),
    addDatabaseRow: (_, args, ctx) =>
      guard(
        databases.addRow(requireUser(ctx), args.databaseId, {
          title: args.title,
          properties: args.properties ?? undefined,
        })
      ),
    addView: (_, args, ctx) =>
      guard(
        databases.addView(requireUser(ctx), args.databaseId, {
          type: args.type,
          name: args.name,
          config: (args.config as never) ?? undefined,
        })
      ),
    updateView: (_, args, ctx) =>
      guard(
        databases.updateView(requireUser(ctx), args.id, {
          type: args.type ?? undefined,
          name: args.name ?? undefined,
          config: (args.config as never) ?? undefined,
        })
      ),
    deleteView: (_, args, ctx) => guard(databases.deleteView(requireUser(ctx), args.id)),

    createComment: async (_, args, ctx) => {
      const comment = await guard(
        comments.create(requireUser(ctx), {
          pageId: args.pageId,
          body: args.body,
          blockId: args.blockId,
          parentId: args.parentId,
        })
      )
      if (!comment) {
        throw new GraphQLError("Page not found", {
          extensions: { code: "NOT_FOUND" },
        })
      }
      return comment
    },
    updateComment: (_, args, ctx) =>
      guard(
        comments.update(requireUser(ctx), args.id, {
          body: args.body ?? undefined,
          resolved: args.resolved ?? undefined,
        })
      ),
    deleteComment: (_, args, ctx) =>
      guard(comments.delete(requireUser(ctx), args.id)),

    addFavorite: async (_, args, ctx) => {
      const favorite = await guard(favorites.add(requireUser(ctx), args.pageId))
      if (!favorite) {
        throw new GraphQLError("Page not found", {
          extensions: { code: "NOT_FOUND" },
        })
      }
      return favorite
    },
    removeFavorite: (_, args, ctx) =>
      favorites.remove(requireUser(ctx), args.pageId),

    snapshotPage: (_, args, ctx) =>
      guard(versions.snapshot(requireUser(ctx), args.pageId)),
    restoreVersion: (_, args, ctx) =>
      guard(versions.restore(requireUser(ctx), args.id)),
  },
}
