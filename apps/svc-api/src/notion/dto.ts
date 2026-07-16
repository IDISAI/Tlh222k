import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"

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
  @ApiProperty({ example: "user_2abcDEF3ghiJKL", description: "Clerk user id" })
  authorId!: string
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
  @ApiProperty({ example: 0, description: "Sibling sort key" }) position!: number
  @ApiProperty({ example: "2026-07-14T09:12:33.000Z" }) createdAt!: string
  @ApiProperty({ example: "2026-07-16T15:40:01.000Z" }) updatedAt!: string
}

// ── Request ─────────────────────────────────────────────────────────────────

export class CreateDocumentDto {
  @ApiPropertyOptional({ example: "Tư duy lập trình Python" }) title?: string
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: "null/omit for top level",
    example: "doc-chuong-python",
  })
  parentDocumentId?: string | null
  @ApiPropertyOptional({
    description: "Only for the root doc of an article slug",
    example: "tu-duy-python",
  })
  slug?: string
}

export class UpdateDocumentDto {
  @ApiProperty({ example: "doc-art-tu-duy-python" }) id!: string
  @ApiPropertyOptional({ example: "Tư duy lập trình Python (v2)" }) title?: string
  @ApiPropertyOptional({
    description: "BlockNote block array as a JSON string",
    example:
      '[{"type":"paragraph","content":[{"type":"text","text":"Nội dung mới.","styles":{}}]}]',
  })
  content?: string
  @ApiPropertyOptional({ example: "💡" }) icon?: string
  @ApiPropertyOptional({
    example: "https://blob.vercel-storage.com/notion/cover-abc123.png",
  })
  coverImage?: string
  @ApiPropertyOptional({ example: true }) isPublished?: boolean
}

export class MoveDocumentDto {
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: "null = top level",
    example: "doc-chuong-python",
  })
  parentDocumentId!: string | null
}

export class ReorderDocumentsDto {
  @ApiProperty({ example: "doc-chuong-python" }) parentDocumentId!: string
  @ApiProperty({
    type: [String],
    example: ["doc-art-tu-duy-python", "doc-art-python-co-ban"],
  })
  orderedIds!: string[]
}
