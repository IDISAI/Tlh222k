import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"
import { Transform, Type } from "class-transformer"
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator"

const MAX_ID_LENGTH = 200
const MAX_SLUG_LENGTH = 200
const MAX_TITLE_LENGTH = 200
const MAX_DESCRIPTION_LENGTH = 5_000
const MAX_SAVE_NODES = 500
const HTTP_URL_OPTIONS = {
  protocols: ["http", "https"],
  require_protocol: true,
}

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
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_SLUG_LENGTH)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug!: string

  @ApiProperty({ example: "Frontend Developer" })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_TITLE_LENGTH)
  title!: string

  @ApiPropertyOptional({ example: "Learn frontend development" })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_DESCRIPTION_LENGTH)
  description?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl(HTTP_URL_OPTIONS)
  thumbnailUrl?: string
}

export class UpdateRoadmapDto {
  @ApiPropertyOptional({ example: "test title" })
  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_TITLE_LENGTH)
  title?: string

  @ApiPropertyOptional({ example: "test description" })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_DESCRIPTION_LENGTH)
  description?: string

  @ApiPropertyOptional({ example: "https://example.com/thumbnail.png" })
  @IsOptional()
  @IsUrl(HTTP_URL_OPTIONS)
  thumbnailUrl?: string

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean
}

export class CreateNodeDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_ID_LENGTH)
  roadmapId!: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(MAX_ID_LENGTH)
  parentId?: string | null

  @ApiProperty()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_TITLE_LENGTH)
  title!: string

  @ApiProperty({ enum: NodeTypeEnum })
  @IsEnum(NodeTypeEnum)
  nodeType!: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(MAX_SLUG_LENGTH)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(MAX_DESCRIPTION_LENGTH)
  description?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(MAX_ID_LENGTH)
  notionPageId?: string

  @ApiPropertyOptional({ enum: ArticleTypeEnum })
  @IsOptional()
  @IsEnum(ArticleTypeEnum)
  articleType?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl(HTTP_URL_OPTIONS)
  jupyterUrl?: string

  @ApiProperty()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  positionX!: number

  @ApiProperty()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  positionY!: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  order?: number
}

export class UpdateNodeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_TITLE_LENGTH)
  title?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(MAX_DESCRIPTION_LENGTH)
  description?: string

  @ApiPropertyOptional({ enum: ArticleTypeEnum })
  @IsOptional()
  @IsEnum(ArticleTypeEnum)
  articleType?: string | null

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(MAX_ID_LENGTH)
  notionPageId?: string | null

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl(HTTP_URL_OPTIONS)
  jupyterUrl?: string | null

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  positionX?: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  positionY?: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  order?: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(MAX_ID_LENGTH)
  parentId?: string | null
}

export class SaveNodeDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_ID_LENGTH)
  id!: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(MAX_ID_LENGTH)
  parentId?: string | null

  @ApiProperty()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  positionX!: number

  @ApiProperty()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  positionY!: number
}

export class SaveRoadmapDto {
  @ApiProperty({ type: [SaveNodeDto] })
  @IsArray()
  @ArrayMaxSize(MAX_SAVE_NODES)
  @ArrayUnique((node: SaveNodeDto) => node.id)
  @ValidateNested({ each: true })
  @Type(() => SaveNodeDto)
  nodes!: SaveNodeDto[]
}

export class SetNodeStatusDto {
  @ApiProperty({ enum: NodeStatusEnum })
  @IsEnum(NodeStatusEnum)
  status!: string
}
