import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from "@nestjs/common"
import {
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger"

import { CurrentUser } from "../auth/current-user.decorator"
import type { CurrentUser as CurrentUserType } from "../auth/clerk"
import type { NodeStatus } from "./hierarchy"
import {
  RoadmapService,
  type CreateNodeInput,
  type CreateRoadmapInput,
  type SaveNodeInput,
  type UpdateNodeInput,
  type UpdateRoadmapInput,
} from "./roadmap.service"
import {
  CreateNodeDto,
  CreateRoadmapDto,
  RoadmapGraphResponseDto,
  RoadmapNodeResponseDto,
  RoadmapProgressResponseDto,
  RoadmapResponseDto,
  SaveRoadmapDto,
  SetNodeStatusDto,
  UpdateNodeDto,
  UpdateRoadmapDto,
} from "./dto"

@ApiTags("Roadmap")
@Controller("api/roadmaps")
export class RoadmapRestController {
  constructor(private readonly service: RoadmapService) {}

  // ── Roadmap CRUD ──────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: "List roadmaps (published only by default)" })
  @ApiQuery({
    name: "includeUnpublished",
    required: false,
    type: Boolean,
    description: "Include unpublished roadmaps (admin only)",
  })
  @ApiResponse({ status: 200, type: [RoadmapResponseDto] })
  listRoadmaps(
    @Query("includeUnpublished") includeUnpublished?: string
  ) {
    return this.service.roadmaps(includeUnpublished === "true")
  }

  @Get(":slug/graph")
  @ApiOperation({ summary: "Get roadmap graph by slug" })
  @ApiParam({ name: "slug", description: "Roadmap or node slug" })
  @ApiResponse({ status: 200, type: RoadmapGraphResponseDto })
  @ApiResponse({ status: 404, description: "Roadmap not found" })
  roadmapGraph(
    @Param("slug") slug: string,
    @CurrentUser() user: CurrentUserType | null
  ) {
    return this.service.roadmapGraph(slug, user)
  }

  @Get("by-id/:id/graph")
  @ApiOperation({ summary: "Get roadmap graph by ID (admin only)" })
  @ApiParam({ name: "id", description: "Roadmap ID" })
  @ApiResponse({ status: 200, type: RoadmapGraphResponseDto })
  @ApiResponse({ status: 403, description: "Permission denied" })
  roadmapGraphById(
    @Param("id") id: string,
    @CurrentUser() user: CurrentUserType | null
  ) {
    return this.service.roadmapGraphById(id, user)
  }

  @Get(":slug")
  @ApiOperation({ summary: "Get roadmap metadata by slug" })
  @ApiParam({ name: "slug" })
  @ApiResponse({ status: 200, type: RoadmapResponseDto })
  roadmapBySlug(@Param("slug") slug: string) {
    return this.service.roadmapBySlug(slug)
  }

  @Post()
  @ApiOperation({ summary: "Create a new roadmap (admin only)" })
  @ApiResponse({ status: 201, type: RoadmapResponseDto })
  @ApiResponse({ status: 403, description: "Permission denied" })
  createRoadmap(
    @Body() input: CreateRoadmapDto,
    @CurrentUser() user: CurrentUserType | null
  ) {
    return this.service.createRoadmap(input as CreateRoadmapInput, user)
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update roadmap metadata (admin only)" })
  @ApiParam({ name: "id" })
  @ApiResponse({ status: 200, type: RoadmapResponseDto })
  updateRoadmap(
    @Param("id") id: string,
    @Body() input: UpdateRoadmapDto,
    @CurrentUser() user: CurrentUserType | null
  ) {
    return this.service.updateRoadmap(id, input as UpdateRoadmapInput, user)
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete a roadmap (admin only)" })
  @ApiParam({ name: "id" })
  @ApiResponse({ status: 200, type: Boolean })
  deleteRoadmap(
    @Param("id") id: string,
    @CurrentUser() user: CurrentUserType | null
  ) {
    return this.service.deleteRoadmap(id, user)
  }

  // ── Nodes ──────────────────────────────────────────────────────────────────

  @Get("nodes/all")
  @ApiOperation({ summary: "List all nodes in the system" })
  @ApiResponse({ status: 200, type: [RoadmapNodeResponseDto] })
  allNodes() {
    return this.service.allNodes()
  }

  @Post("nodes")
  @ApiOperation({ summary: "Create a node (admin only)" })
  @ApiResponse({ status: 201, type: RoadmapNodeResponseDto })
  createNode(
    @Body() input: CreateNodeDto,
    @CurrentUser() user: CurrentUserType | null
  ) {
    return this.service.createNode(input as CreateNodeInput, user)
  }

  @Patch("nodes/:id")
  @ApiOperation({ summary: "Update a node (admin only)" })
  @ApiParam({ name: "id" })
  @ApiResponse({ status: 200, type: RoadmapNodeResponseDto })
  updateNode(
    @Param("id") id: string,
    @Body() input: UpdateNodeDto,
    @CurrentUser() user: CurrentUserType | null
  ) {
    return this.service.updateNode(id, input as UpdateNodeInput, user)
  }

  @Delete("nodes/:id")
  @ApiOperation({ summary: "Delete a node (admin only)" })
  @ApiParam({ name: "id" })
  @ApiResponse({ status: 200, type: Boolean })
  deleteNode(
    @Param("id") id: string,
    @CurrentUser() user: CurrentUserType | null
  ) {
    return this.service.deleteNode(id, user)
  }

  @Put(":roadmapId/save")
  @ApiOperation({ summary: "Batch save all nodes of a roadmap (admin only)" })
  @ApiParam({ name: "roadmapId" })
  @ApiResponse({ status: 200, type: Boolean })
  saveRoadmap(
    @Param("roadmapId") roadmapId: string,
    @Body() body: SaveRoadmapDto,
    @CurrentUser() user: CurrentUserType | null
  ) {
    return this.service.saveRoadmap(
      roadmapId,
      body.nodes as SaveNodeInput[],
      user
    )
  }

  @Patch("nodes/:nodeId/status")
  @ApiOperation({ summary: "Set learning progress for a node" })
  @ApiParam({ name: "nodeId" })
  @ApiResponse({ status: 200, type: Boolean })
  setNodeStatus(
    @Param("nodeId") nodeId: string,
    @Body() body: SetNodeStatusDto,
    @CurrentUser() user: CurrentUserType | null
  ) {
    return this.service.setNodeStatus(
      nodeId,
      body.status as NodeStatus,
      user
    )
  }

  // ── Progress ───────────────────────────────────────────────────────────────

  @Get("progress/my")
  @ApiOperation({ summary: "Get current user learning progress" })
  @ApiResponse({ status: 200, type: [RoadmapProgressResponseDto] })
  myProgress(@CurrentUser() user: CurrentUserType | null) {
    return this.service.myProgress(user)
  }
}
