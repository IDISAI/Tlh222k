import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"
import { Transform } from "class-transformer"
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  ValidateIf,
} from "class-validator"

const MAX_ID_LENGTH = 200
const MAX_SLUG_LENGTH = 200
const MAX_TITLE_LENGTH = 200
const MAX_CONTENT_LENGTH = 2_000_000
const MAX_REORDER_DOCUMENTS = 500
const HTTP_URL_OPTIONS = {
  protocols: ["http", "https"],
  require_protocol: true,
}

// ── Response ────────────────────────────────────────────────────────────────

export class NotionDocResponseDto {
  @ApiProperty({ example: "doc-art-tu-duy-python" }) id!: string
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: "Set only on ROOT docs backing a roadmap article slug",
    example: "tu-duy-python",
  })
  slug!: string | null
  @ApiProperty({ example: "Tư duy lập trình Python" }) title!: string
  @ApiProperty({ example: false }) isArchived!: boolean
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: "doc-chuong-python",
  })
  parentDocumentId!: string | null
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: "BlockNote block array as a JSON string",
    example:
      '[{"type":"heading","props":{"level":1},"content":[{"type":"text","text":"Tư duy lập trình Python","styles":{}}]},{"type":"paragraph","content":[{"type":"text","text":"Python đề cao code dễ đọc.","styles":{}}]}]',
  })
  content!: string | null
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: "https://blob.vercel-storage.com/notion/cover-abc123.png",
  })
  coverImage!: string | null
  @ApiPropertyOptional({ type: String, nullable: true, example: "💡" })
  icon!: string | null
  @ApiProperty({ example: true }) isPublished!: boolean
  @ApiProperty({ example: 0, description: "Sibling sort key" })
  position!: number
  @ApiProperty({ example: "2026-07-14T09:12:33.000Z" }) createdAt!: string
  @ApiProperty({ example: "2026-07-16T15:40:01.000Z" }) updatedAt!: string
}

// ── Request ─────────────────────────────────────────────────────────────────

export class CreateDocumentDto {
  @ApiPropertyOptional({ example: "Tư duy lập trình Python" })
  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_TITLE_LENGTH)
  title?: string

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: "null/omit for top level",
    example: "doc-chuong-python",
  })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_ID_LENGTH)
  parentDocumentId?: string | null

  @ApiPropertyOptional({
    description: "Only for the root doc of an article slug",
    example: "tu-duy-python",
  })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_SLUG_LENGTH)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug?: string
}

export class UpdateDocumentDto {
  @ApiProperty({ example: "doc-art-tu-duy-python" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_ID_LENGTH)
  id!: string

  @ApiPropertyOptional({ example: "Tư duy lập trình Python (v2)" })
  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_TITLE_LENGTH)
  title?: string

  @ApiPropertyOptional({
    description: "BlockNote block array as a JSON string",
    example:
      '[{"type":"paragraph","content":[{"type":"text","text":"Nội dung mới.","styles":{}}]}]',
  })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_CONTENT_LENGTH)
  content?: string

  @ApiPropertyOptional({ example: "💡" })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  icon?: string

  @ApiPropertyOptional({
    example: "https://blob.vercel-storage.com/notion/cover-abc123.png",
  })
  @IsOptional()
  @IsUrl(HTTP_URL_OPTIONS)
  coverImage?: string

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean
}

export class MoveDocumentDto {
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: "null = top level",
    example: "doc-chuong-python",
  })
  @ValidateIf((_object, value) => value !== null)
  @IsString()
  @MaxLength(MAX_ID_LENGTH)
  parentDocumentId!: string | null
}

export class ReorderDocumentsDto {
  @ApiProperty({ example: "doc-chuong-python" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_ID_LENGTH)
  parentDocumentId!: string

  @ApiProperty({
    type: [String],
    example: ["doc-art-tu-duy-python", "doc-art-python-co-ban"],
  })
  @IsArray()
  @ArrayMaxSize(MAX_REORDER_DOCUMENTS)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(MAX_ID_LENGTH, { each: true })
  orderedIds!: string[]
}
