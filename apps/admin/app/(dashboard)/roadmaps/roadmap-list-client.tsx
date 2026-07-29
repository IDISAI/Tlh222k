"use client"

import { RoadmapListAdmin, type CallerRole } from "@workspace/core"

import { uploadBlockCover } from "./actions"
import { inspectBlockCoverImage } from "./block-cover-policy"

function blockCoverMessage(code: string) {
  if (code === "FILE_TOO_LARGE") return "Ảnh phải nhỏ hơn 3 MB."
  if (code === "UNSUPPORTED_FILE_TYPE") return "Chỉ nhận ảnh JPG, PNG hoặc WebP."
  if (code === "INVALID_DIMENSIONS") return "Ảnh cần tối thiểu 320×240."
  return "Không tìm thấy ảnh để tải lên."
}

async function uploadCover(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const policy = inspectBlockCoverImage({ name: file.name, size: file.size, type: file.type, width: bitmap.width, height: bitmap.height })
  bitmap.close()
  if (!policy.ok) throw new Error(blockCoverMessage(policy.code))
  const form = new FormData()
  form.set("file", file)
  const uploaded = await uploadBlockCover(form)
  return uploaded.url
}

export function RoadmapListClient({ role, builderBasePath }: { role: CallerRole; builderBasePath: string }) {
  return <RoadmapListAdmin role={role} builderBasePath={builderBasePath} uploadCover={uploadCover} />
}
