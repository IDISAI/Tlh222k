import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from "@nestjs/common"
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger"

import { CurrentUser } from "../auth/current-user.decorator"
import type { CurrentUser as CurrentUserType } from "../auth/clerk"
import { NotionService } from "./notion.service"
import {
  CreateDocumentDto,
  MoveDocumentDto,
  NotionDocResponseDto,
  ReorderDocumentsDto,
  UpdateDocumentDto,
} from "./dto"

@ApiTags("Notion")
@Controller("api/notion")
export class NotionController {
  constructor(private readonly service: NotionService) {}

  // ── Literal routes first (Nest matches in declaration order) ───────────────

  @Get("trash")
  @ApiOperation({ summary: "List archived documents (admin only)" })
  @ApiResponse({ status: 200, type: [NotionDocResponseDto] })
  getTrash(@CurrentUser() user: CurrentUserType | null) {
    return this.service.getTrash(user)
  }

  @Get("search")
  @ApiOperation({ summary: "Search corpus: non-archived docs (admin only)" })
  @ApiResponse({ status: 200, type: [NotionDocResponseDto] })
  getSearch(@CurrentUser() user: CurrentUserType | null) {
    return this.service.getSearch(user)
  }

  @Get("by-slug/:slug")
  @ApiOperation({ summary: "Root doc by article slug (viewers: published only)" })
  @ApiParam({ name: "slug" })
  @ApiResponse({ status: 200, type: NotionDocResponseDto })
  getBySlug(
    @Param("slug") slug: string,
    @CurrentUser() user: CurrentUserType | null
  ) {
    return this.service.getBySlug(user, slug)
  }

  @Patch("reorder")
  @ApiOperation({ summary: "Persist sibling reorder (admin only)" })
  reorder(
    @Body() body: ReorderDocumentsDto,
    @CurrentUser() user: CurrentUserType | null
  ) {
    return this.service.reorder(user, body.parentDocumentId, body.orderedIds)
  }

  // ── Collection ─────────────────────────────────────────────────────────────

  @Post()
  @ApiOperation({ summary: "Create a document (admin only)" })
  @ApiResponse({ status: 201, type: NotionDocResponseDto })
  create(
    @Body() body: CreateDocumentDto,
    @CurrentUser() user: CurrentUserType | null
  ) {
    return this.service.create(user, user?.userId ?? "unknown", body)
  }

  @Patch()
  @ApiOperation({ summary: "Update a document (admin only)" })
  @ApiResponse({ status: 200, type: NotionDocResponseDto })
  update(
    @Body() body: UpdateDocumentDto,
    @CurrentUser() user: CurrentUserType | null
  ) {
    return this.service.update(user, body)
  }

  // ── Item ───────────────────────────────────────────────────────────────────

  @Get(":id/children")
  @ApiOperation({ summary: "Child documents (viewers: published only)" })
  @ApiParam({ name: "id", description: "Parent document id" })
  @ApiResponse({ status: 200, type: [NotionDocResponseDto] })
  getChildren(
    @Param("id") parentId: string,
    @CurrentUser() user: CurrentUserType | null
  ) {
    return this.service.getChildren(user, parentId)
  }

  @Get(":id")
  @ApiOperation({ summary: "Document by id (published or admin)" })
  @ApiParam({ name: "id" })
  @ApiResponse({ status: 200, type: NotionDocResponseDto })
  getById(
    @Param("id") id: string,
    @CurrentUser() user: CurrentUserType | null
  ) {
    return this.service.getById(user, id)
  }

  @Post(":id/archive")
  @ApiOperation({ summary: "Soft-delete a doc + subtree (admin only)" })
  @ApiParam({ name: "id" })
  archive(@Param("id") id: string, @CurrentUser() user: CurrentUserType | null) {
    return this.service.archive(user, id)
  }

  @Post(":id/restore")
  @ApiOperation({ summary: "Restore a doc + subtree (admin only)" })
  @ApiParam({ name: "id" })
  restore(@Param("id") id: string, @CurrentUser() user: CurrentUserType | null) {
    return this.service.restore(user, id)
  }

  @Post(":id/remove-icon")
  @ApiOperation({ summary: "Clear the icon (admin only)" })
  @ApiParam({ name: "id" })
  removeIcon(@Param("id") id: string, @CurrentUser() user: CurrentUserType | null) {
    return this.service.removeIcon(user, id)
  }

  @Post(":id/remove-cover")
  @ApiOperation({ summary: "Clear the cover image (admin only)" })
  @ApiParam({ name: "id" })
  removeCoverImage(
    @Param("id") id: string,
    @CurrentUser() user: CurrentUserType | null
  ) {
    return this.service.removeCoverImage(user, id)
  }

  @Patch(":id/move")
  @ApiOperation({ summary: "Re-parent a doc, null = top level (admin only)" })
  @ApiParam({ name: "id" })
  @ApiResponse({ status: 200, type: NotionDocResponseDto })
  move(
    @Param("id") id: string,
    @Body() body: MoveDocumentDto,
    @CurrentUser() user: CurrentUserType | null
  ) {
    return this.service.move(user, id, body.parentDocumentId)
  }

  @Delete(":id")
  @ApiOperation({ summary: "Permanent delete a doc + subtree (admin only)" })
  @ApiParam({ name: "id" })
  remove(@Param("id") id: string, @CurrentUser() user: CurrentUserType | null) {
    return this.service.remove(user, id)
  }
}
