import { Args, Mutation, Query, Resolver } from "@nestjs/graphql"

import { CurrentUser } from "../auth/current-user.decorator"
import type { CurrentUser as CurrentUserType } from "../auth/clerk"
import {
  NotionService,
  type CreateDocumentInput,
  type UpdateDocumentInput,
} from "./notion.service"

@Resolver()
export class NotionResolver {
  constructor(private readonly service: NotionService) {}

  // ── Queries ──
  @Query("notionDoc")
  notionDoc(
    @Args("id") id: string,
    @CurrentUser() user: CurrentUserType | null
  ) {
    return this.service.getById(user, id)
  }

  @Query("notionDocBySlug")
  notionDocBySlug(
    @Args("slug") slug: string,
    @CurrentUser() user: CurrentUserType | null
  ) {
    return this.service.getBySlug(user, slug)
  }

  @Query("notionChildren")
  notionChildren(
    @Args("parentDocumentId") parentDocumentId: string,
    @CurrentUser() user: CurrentUserType | null
  ) {
    return this.service.getChildren(user, parentDocumentId)
  }

  @Query("notionTrash")
  notionTrash(@CurrentUser() user: CurrentUserType | null) {
    return this.service.getTrash(user)
  }

  @Query("notionSearch")
  notionSearch(@CurrentUser() user: CurrentUserType | null) {
    return this.service.getSearch(user)
  }

  // ── Mutations ──
  @Mutation("createNotionDoc")
  createNotionDoc(
    @Args("input") input: CreateDocumentInput,
    @CurrentUser() user: CurrentUserType | null
  ) {
    return this.service.create(user, user?.userId ?? "unknown", input)
  }

  @Mutation("updateNotionDoc")
  updateNotionDoc(
    @Args("input") input: UpdateDocumentInput,
    @CurrentUser() user: CurrentUserType | null
  ) {
    return this.service.update(user, input)
  }

  @Mutation("archiveNotionDoc")
  async archiveNotionDoc(
    @Args("id") id: string,
    @CurrentUser() user: CurrentUserType | null
  ) {
    await this.service.archive(user, id)
    return true
  }

  @Mutation("restoreNotionDoc")
  async restoreNotionDoc(
    @Args("id") id: string,
    @CurrentUser() user: CurrentUserType | null
  ) {
    await this.service.restore(user, id)
    return true
  }

  @Mutation("removeNotionDoc")
  async removeNotionDoc(
    @Args("id") id: string,
    @CurrentUser() user: CurrentUserType | null
  ) {
    await this.service.remove(user, id)
    return true
  }

  @Mutation("moveNotionDoc")
  moveNotionDoc(
    @Args("id") id: string,
    @Args("parentDocumentId") parentDocumentId: string | null,
    @CurrentUser() user: CurrentUserType | null
  ) {
    return this.service.move(user, id, parentDocumentId)
  }

  @Mutation("reorderNotionDocs")
  async reorderNotionDocs(
    @Args("parentDocumentId") parentDocumentId: string,
    @Args("orderedIds") orderedIds: string[],
    @CurrentUser() user: CurrentUserType | null
  ) {
    await this.service.reorder(user, parentDocumentId, orderedIds)
    return true
  }

  @Mutation("removeNotionIcon")
  removeNotionIcon(
    @Args("id") id: string,
    @CurrentUser() user: CurrentUserType | null
  ) {
    return this.service.removeIcon(user, id)
  }

  @Mutation("removeNotionCover")
  removeNotionCover(
    @Args("id") id: string,
    @CurrentUser() user: CurrentUserType | null
  ) {
    return this.service.removeCoverImage(user, id)
  }
}
