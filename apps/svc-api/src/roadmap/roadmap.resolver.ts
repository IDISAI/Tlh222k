import { Args, Mutation, Query, Resolver } from "@nestjs/graphql"

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

@Resolver()
export class RoadmapResolver {
  constructor(private readonly service: RoadmapService) {}

  // ── Queries ──
  @Query("roadmaps")
  roadmaps(
    @Args("includeUnpublished") includeUnpublished: boolean | undefined,
    @CurrentUser() user: CurrentUserType | null
  ) {
    return this.service.roadmaps(Boolean(includeUnpublished), user)
  }

  @Query("roadmap")
  roadmap(@Args("slug") slug: string) {
    return this.service.roadmapBySlug(slug)
  }

  @Query("roadmapGraph")
  roadmapGraph(
    @Args("slug") slug: string,
    @CurrentUser() user: CurrentUserType | null
  ) {
    return this.service.roadmapGraph(slug, user)
  }

  @Query("roadmapGraphById")
  roadmapGraphById(
    @Args("id") id: string,
    @CurrentUser() user: CurrentUserType | null
  ) {
    return this.service.roadmapGraphById(id, user)
  }

  @Query("allNodes")
  allNodes(@CurrentUser() user: CurrentUserType | null) {
    return this.service.allNodes(user)
  }

  // Public LEGO inventory — every published role/skill block, no auth.
  // `fieldIds` is optional; when present it narrows to blocks carrying ANY of
  // those discovery labels.
  @Query("publicBlocks")
  publicBlocks(@Args("fieldIds") fieldIds?: string[] | null) {
    return this.service.publicBlocks(fieldIds)
  }

  // Public discovery labels for the /roadmaps tab strip — no auth.
  @Query("fields")
  fields() {
    return this.service.listFields()
  }

  // Public per-block composition (viewer drill) — one block + direct children.
  @Query("publicBlockGraph")
  publicBlockGraph(@Args("id") id: string) {
    return this.service.publicBlockGraph(id)
  }

  @Query("myProgress")
  myProgress(@CurrentUser() user: CurrentUserType | null) {
    return this.service.myProgress(user)
  }

  // ── Mutations ──
  // Find-or-create: the admin label picker creates inline, so a repeated name
  // returns the existing label instead of minting a duplicate.
  @Mutation("createField")
  createField(
    @Args("name") name: string,
    @CurrentUser() user: CurrentUserType | null
  ) {
    return this.service.createField(user, name)
  }

  @Mutation("updateField")
  updateField(
    @Args("id") id: string,
    @Args("name") name: string,
    @CurrentUser() user: CurrentUserType | null
  ) {
    return this.service.updateField(user, id, name)
  }

  @Mutation("deleteField")
  deleteField(
    @Args("id") id: string,
    @CurrentUser() user: CurrentUserType | null
  ) {
    return this.service.deleteField(user, id)
  }

  @Mutation("createRoadmap")
  createRoadmap(
    @Args("input") input: CreateRoadmapInput,
    @CurrentUser() user: CurrentUserType | null
  ) {
    return this.service.createRoadmap(input, user)
  }

  @Mutation("updateRoadmap")
  updateRoadmap(
    @Args("id") id: string,
    @Args("input") input: UpdateRoadmapInput,
    @CurrentUser() user: CurrentUserType | null
  ) {
    return this.service.updateRoadmap(id, input, user)
  }

  @Mutation("deleteRoadmap")
  deleteRoadmap(
    @Args("id") id: string,
    @CurrentUser() user: CurrentUserType | null
  ) {
    return this.service.deleteRoadmap(id, user)
  }

  @Mutation("createNode")
  createNode(
    @Args("input") input: CreateNodeInput,
    @CurrentUser() user: CurrentUserType | null
  ) {
    return this.service.createNode(input, user)
  }

  @Mutation("updateNode")
  updateNode(
    @Args("id") id: string,
    @Args("input") input: UpdateNodeInput,
    @CurrentUser() user: CurrentUserType | null
  ) {
    return this.service.updateNode(id, input, user)
  }

  @Mutation("deleteNode")
  deleteNode(
    @Args("id") id: string,
    @CurrentUser() user: CurrentUserType | null
  ) {
    return this.service.deleteNode(id, user)
  }

  @Mutation("moveNode")
  moveNode(
    @Args("nodeId") nodeId: string,
    @Args("roadmapId") roadmapId: string,
    @Args("positionX") positionX: number,
    @Args("positionY") positionY: number,
    @CurrentUser() user: CurrentUserType | null
  ) {
    return this.service.moveNode(nodeId, roadmapId, positionX, positionY, user)
  }

  @Mutation("saveRoadmap")
  saveRoadmap(
    @Args("roadmapId") roadmapId: string,
    @Args("nodes") nodes: SaveNodeInput[],
    @CurrentUser() user: CurrentUserType | null
  ) {
    return this.service.saveRoadmap(roadmapId, nodes, user)
  }

  @Mutation("setNodeStatus")
  setNodeStatus(
    @Args("nodeId") nodeId: string,
    @Args("status") status: NodeStatus,
    @CurrentUser() user: CurrentUserType | null
  ) {
    return this.service.setNodeStatus(nodeId, status, user)
  }
}
