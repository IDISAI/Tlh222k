import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"

// ── Enums ──────────────────────────────────────────────────────────────────────

export enum NodeTypeEnum {
  role = "role",
  skill = "skill",
  chapter = "chapter",
  article = "article",
}

export enum ArticleTypeEnum {
  notion = "notion",
  jupyter = "jupyter",
}

export enum NodeStatusEnum {
  locked = "locked",
  in_progress = "in_progress",
  done = "done",
}

// ── Response DTOs ──────────────────────────────────────────────────────────────

export class RoadmapResponseDto {
  @ApiProperty({ example: "cm-abc12345" })
  id!: string

  @ApiProperty({ example: "frontend" })
  slug!: string

  @ApiProperty({ example: "Frontend Developer" })
  title!: string

  @ApiPropertyOptional({ example: "Learn frontend development" })
  description!: string | null

  @ApiPropertyOptional({ example: "https://example.com/thumb.png" })
  thumbnailUrl!: string | null

  @ApiProperty({ example: true })
  isPublished!: boolean

  @ApiProperty({ example: 13 })
  nodeCount!: number
}

export class RoadmapNodeResponseDto {
  @ApiProperty() id!: string
  @ApiProperty() roadmapId!: string
  @ApiPropertyOptional() parentId!: string | null
  @ApiProperty() title!: string
  @ApiProperty() slug!: string
  @ApiPropertyOptional() description!: string | null
  @ApiProperty({ enum: NodeTypeEnum }) nodeType!: string
  @ApiPropertyOptional() notionPageId!: string | null
  @ApiPropertyOptional({ enum: ArticleTypeEnum }) articleType!: string | null
  @ApiPropertyOptional() jupyterUrl!: string | null
  @ApiProperty() positionX!: number
  @ApiProperty() positionY!: number
  @ApiProperty() order!: number
  @ApiProperty({ enum: NodeStatusEnum }) status!: string
  @ApiProperty() isDeleted!: boolean
  @ApiProperty() childrenCount!: number
}

export class RoadmapGraphResponseDto {
  @ApiProperty({ type: RoadmapResponseDto })
  roadmap!: RoadmapResponseDto

  @ApiProperty({ type: [RoadmapNodeResponseDto] })
  nodes!: RoadmapNodeResponseDto[]
}

export class RoadmapProgressResponseDto {
  @ApiProperty() roadmapId!: string
  @ApiProperty() roadmapTitle!: string
  @ApiProperty() doneCount!: number
  @ApiProperty() totalCount!: number
}

// ── Request DTOs ───────────────────────────────────────────────────────────────

export class CreateRoadmapDto {
  @ApiProperty({ example: "frontend" })
  slug!: string

  @ApiProperty({ example: "Frontend Developer" })
  title!: string

  @ApiPropertyOptional({ example: "Learn frontend development" })
  description?: string

  @ApiPropertyOptional()
  thumbnailUrl?: string
}

export class UpdateRoadmapDto {
  @ApiPropertyOptional({ example: "test title" }) title?: string
  @ApiPropertyOptional({ example: "test description" }) description?: string
  @ApiPropertyOptional({ example: "test thumbnailUrl" }) thumbnailUrl?: string
  @ApiPropertyOptional({ example: true }) isPublished?: boolean
}

export class CreateNodeDto {
  @ApiProperty() roadmapId!: string
  @ApiPropertyOptional() parentId?: string
  @ApiProperty() title!: string
  @ApiProperty({ enum: NodeTypeEnum }) nodeType!: string
  @ApiPropertyOptional() slug?: string
  @ApiPropertyOptional() description?: string
  @ApiPropertyOptional() notionPageId?: string
  @ApiPropertyOptional({ enum: ArticleTypeEnum }) articleType?: string
  @ApiPropertyOptional() jupyterUrl?: string
  @ApiProperty() positionX!: number
  @ApiProperty() positionY!: number
  @ApiPropertyOptional() order?: number
}

export class UpdateNodeDto {
  @ApiPropertyOptional() title?: string
  @ApiPropertyOptional() description?: string
  @ApiPropertyOptional({ enum: ArticleTypeEnum }) articleType?: string
  @ApiPropertyOptional() notionPageId?: string
  @ApiPropertyOptional() jupyterUrl?: string
  @ApiPropertyOptional() positionX?: number
  @ApiPropertyOptional() positionY?: number
  @ApiPropertyOptional() order?: number
  @ApiPropertyOptional() parentId?: string
}

export class SaveNodeDto {
  @ApiProperty() id!: string
  @ApiPropertyOptional() parentId?: string
  @ApiProperty() positionX!: number
  @ApiProperty() positionY!: number
}

export class SaveRoadmapDto {
  @ApiProperty({ type: [SaveNodeDto] })
  nodes!: SaveNodeDto[]
}

export class SetNodeStatusDto {
  @ApiProperty({ enum: NodeStatusEnum })
  status!: string
}
