import { Args, Mutation, Query, Resolver } from "@nestjs/graphql"

import { CurrentUser } from "../auth/current-user.decorator"
import type { CurrentUser as CurrentUserType } from "../auth/clerk"
import type { NodeStatus } from "./hierarchy"
import {
  RoadmapService,
  type CreateNodeInput,
  type CreateFieldInput,
  type CreateRoadmapInput,
  type SaveNodeInput,
  type UpdateNodeInput,
  type UpdateFieldInput,
  type UpdateRoadmapInput,
  type ReplaceCompositionMemberInput,
  type ReplaceCompositionEdgeInput,
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

  @Query("fieldNodeIds")
  fieldNodeIds(
    @Args("fieldId") fieldId: string,
    @CurrentUser() user: CurrentUserType | null
  ) {
    return this.service.fieldNodeIds(fieldId, user)
  }

  // Public LEGO inventory — every published role/skill block, no auth.
  // `fieldIds` is optional; when present it narrows to blocks carrying ANY of
  // those discovery labels.
  @Query("publicBlocks")
  publicBlocks(
    @Args("fieldIds") fieldIds: string[] | null | undefined,
    @CurrentUser() user: CurrentUserType | null
  ) {
    return this.service.publicBlocks(fieldIds, user)
  }

  // Public discovery labels for the /roadmaps tab strip — no auth.
  @Query("fields")
  fields(
    @Args("includeUnpublished") includeUnpublished: boolean | undefined,
    @CurrentUser() user: CurrentUserType | null
  ) {
    return this.service.listFields(
      Boolean(includeUnpublished) &&
        (user?.role === "admin" || user?.role === "super-admin")
    )
  }

  @Query("field")
  field(@Args("slug") slug: string) {
    return this.service.fieldBySlug(slug)
  }

  // Public per-block composition (viewer drill) — one block + direct children.
  @Query("publicBlockGraph")
  publicBlockGraph(
    @Args("id") id: string,
    @CurrentUser() user: CurrentUserType | null
  ) {
    return this.service.publicBlockGraph(id, user)
  }

  @Query("myProgress")
  myProgress(@CurrentUser() user: CurrentUserType | null) {
    return this.service.myProgress(user)
  }

  @Query("composition")
  composition(
    @Args("ownerId") ownerId: string,
    @Args("scope") scope: "DRAFT" | "PUBLISHED",
    @CurrentUser() user: CurrentUserType | null
  ) {
    return this.service.composition(ownerId, scope, user)
  }

  // ── Mutations ──
  // Find-or-create: the admin label picker creates inline, so a repeated title
  // returns the existing label instead of minting a duplicate.
  @Mutation("createField")
  createField(
    @Args("input") input: CreateFieldInput,
    @CurrentUser() user: CurrentUserType | null
  ) {
    return this.service.createField(user, input)
  }

  @Mutation("updateField")
  updateField(
    @Args("id") id: string,
    @Args("input") input: UpdateFieldInput,
    @CurrentUser() user: CurrentUserType | null
  ) {
    return this.service.updateField(user, id, input)
  }

  @Mutation("deleteField")
  deleteField(
    @Args("id") id: string,
    @CurrentUser() user: CurrentUserType | null
  ) {
    return this.service.deleteField(user, id)
  }

  @Mutation("reorderFieldMembership")
  reorderFieldMembership(
    @Args("fieldId") fieldId: string,
    @Args("nodeIds") nodeIds: string[],
    @CurrentUser() user: CurrentUserType | null
  ) {
    return this.service.reorderFieldMembership(fieldId, nodeIds, user)
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

  @Mutation("addCompositionMember")
  addCompositionMember(
    @Args("ownerId") ownerId: string,
    @Args("nodeId") nodeId: string,
    @Args("positionX") positionX: number,
    @Args("positionY") positionY: number,
    @Args("isRequired") isRequired: boolean,
    @CurrentUser() user: CurrentUserType | null
  ) {
    return this.service.addCompositionMember(
      ownerId,
      nodeId,
      positionX,
      positionY,
      isRequired,
      user
    )
  }

  @Mutation("moveCompositionMember")
  moveCompositionMember(
    @Args("ownerId") ownerId: string,
    @Args("nodeId") nodeId: string,
    @Args("positionX") positionX: number,
    @Args("positionY") positionY: number,
    @CurrentUser() user: CurrentUserType | null
  ) {
    return this.service.moveCompositionMember(
      ownerId,
      nodeId,
      positionX,
      positionY,
      user
    )
  }

  @Mutation("removeCompositionMember")
  removeCompositionMember(
    @Args("ownerId") ownerId: string,
    @Args("nodeId") nodeId: string,
    @CurrentUser() user: CurrentUserType | null
  ) {
    return this.service.removeCompositionMember(ownerId, nodeId, user)
  }

  @Mutation("addCompositionEdge")
  addCompositionEdge(
    @Args("ownerId") ownerId: string,
    @Args("sourceId") sourceId: string,
    @Args("targetId") targetId: string,
    @Args("kind") kind: "solid" | "dashed",
    @CurrentUser() user: CurrentUserType | null
  ) {
    return this.service.addCompositionEdge(
      ownerId,
      sourceId,
      targetId,
      kind,
      user
    )
  }

  @Mutation("updateCompositionEdgeKind")
  updateCompositionEdgeKind(
    @Args("ownerId") ownerId: string,
    @Args("edgeId") edgeId: string,
    @Args("kind") kind: "solid" | "dashed",
    @CurrentUser() user: CurrentUserType | null
  ) {
    return this.service.updateCompositionEdgeKind(ownerId, edgeId, kind, user)
  }

  @Mutation("removeCompositionEdge")
  removeCompositionEdge(
    @Args("ownerId") ownerId: string,
    @Args("edgeId") edgeId: string,
    @CurrentUser() user: CurrentUserType | null
  ) {
    return this.service.removeCompositionEdge(ownerId, edgeId, user)
  }

  @Mutation("replaceComposition")
  replaceComposition(
    @Args("ownerId") ownerId: string,
    @Args("members") members: ReplaceCompositionMemberInput[],
    @Args("edges") edges: ReplaceCompositionEdgeInput[],
    @CurrentUser() user: CurrentUserType | null
  ) {
    return this.service.replaceComposition(ownerId, members, edges, user)
  }

  @Mutation("publishComposition")
  publishComposition(
    @Args("ownerId") ownerId: string,
    @CurrentUser() user: CurrentUserType | null
  ) {
    return this.service.publishComposition(ownerId, user)
  }

  @Mutation("discardCompositionDraft")
  discardCompositionDraft(
    @Args("ownerId") ownerId: string,
    @CurrentUser() user: CurrentUserType | null
  ) {
    return this.service.discardCompositionDraft(ownerId, user)
  }

  @Mutation("setNodeStatus")
  setNodeStatus(
    @Args("nodeId") nodeId: string,
    @Args("status") status: NodeStatus,
    @CurrentUser() user: CurrentUserType | null
  ) {
    return this.service.setNodeStatus(nodeId, status, user)
  }

  @Mutation("markNodeOpened")
  markNodeOpened(
    @Args("nodeId") nodeId: string,
    @CurrentUser() user: CurrentUserType | null
  ) {
    return this.service.markNodeOpened(nodeId, user)
  }

  @Query("myFavoriteRoadmapIds")
  myFavoriteRoadmapIds(@CurrentUser() user: CurrentUserType | null) {
    return this.service.myFavoriteRoadmapIds(user)
  }

  @Query("archivedNodes")
  archivedNodes(@CurrentUser() user: CurrentUserType | null) {
    return this.service.archivedNodes(user)
  }

  @Query("myNotifications")
  myNotifications(@CurrentUser() user: CurrentUserType | null) {
    return this.service.myNotifications(user)
  }

  @Query("myEmailOptIn")
  myEmailOptIn(@CurrentUser() user: CurrentUserType | null) {
    return this.service.myEmailOptIn(user)
  }

  @Mutation("markNotificationRead")
  markNotificationRead(
    @Args("id") id: string,
    @CurrentUser() user: CurrentUserType | null
  ) {
    return this.service.markNotificationRead(id, user)
  }

  @Mutation("setEmailOptIn")
  setEmailOptIn(
    @Args("optedIn") optedIn: boolean,
    @CurrentUser() user: CurrentUserType | null
  ) {
    return this.service.setEmailOptIn(optedIn, user)
  }

  @Query("learnerActivity")
  learnerActivity(
    @Args("clerkUserId") clerkUserId: string,
    @CurrentUser() user: CurrentUserType | null
  ) {
    return this.service.learnerActivity(clerkUserId, user)
  }

  @Query("nodeAttachments")
  nodeAttachments(
    @Args("nodeId") nodeId: string,
    @CurrentUser() user: CurrentUserType | null
  ) {
    return this.service.nodeAttachments(nodeId, user)
  }

  @Mutation("addNodeAttachment")
  addNodeAttachment(
    @Args("nodeId") nodeId: string,
    @Args("name") name: string,
    @Args("url") url: string,
    @Args("contentType") contentType: string,
    @Args("sizeBytes") sizeBytes: number,
    @CurrentUser() user: CurrentUserType | null
  ) {
    return this.service.addNodeAttachment(
      { nodeId, name, url, contentType, sizeBytes },
      user
    )
  }

  @Mutation("deleteNodeAttachment")
  deleteNodeAttachment(
    @Args("id") id: string,
    @CurrentUser() user: CurrentUserType | null
  ) {
    return this.service.deleteNodeAttachment(id, user)
  }

  @Mutation("setNodeKeyResults")
  setNodeKeyResults(
    @Args("nodeId") nodeId: string,
    @Args("texts") texts: string[],
    @CurrentUser() user: CurrentUserType | null
  ) {
    return this.service.setNodeKeyResults(nodeId, texts, user)
  }

  @Mutation("restoreNode")
  restoreNode(
    @Args("id") id: string,
    @CurrentUser() user: CurrentUserType | null
  ) {
    return this.service.restoreNode(id, user)
  }

  @Mutation("setRoadmapFavorite")
  setRoadmapFavorite(
    @Args("ownerNodeId") ownerNodeId: string,
    @Args("favorite") favorite: boolean,
    @CurrentUser() user: CurrentUserType | null
  ) {
    return this.service.setRoadmapFavorite(ownerNodeId, favorite, user)
  }
}
