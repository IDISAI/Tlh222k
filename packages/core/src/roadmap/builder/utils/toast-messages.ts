import {
  RoadmapServiceError,
  type NodeType,
  type RoadmapErrorCode,
} from "../../types"

/** All user-facing feedback is Vietnamese (Glossary: Toast). */
export const TOAST_MESSAGES: Record<RoadmapErrorCode, string> & {
  SAVE_SUCCESS: string
  DELETE_SUCCESS: string
  CREATE_SUCCESS: string
  UPDATE_SUCCESS: string
  ARTICLE_NO_LINK: string
  NODE_DELETED_FROM_SYSTEM: string
  LEAF_NO_CHILDREN: string
  NODE_ALREADY_ON_CANVAS: string
} = {
  PERMISSION_DENIED: "Bạn không có quyền thực hiện thao tác này",
  INVALID_NODE_TYPE: "Loại node không hợp lệ",
  INVALID_HIERARCHY: "Kết nối không hợp lệ giữa hai cấp node",
  LEAF_NODE_CANNOT_HAVE_CHILDREN: "`article` là node lá, không thể có node con",
  CHILDREN_LIMIT_EXCEEDED: "Đã đạt giới hạn 100 node con trực tiếp",
  NOT_FOUND: "Không tìm thấy dữ liệu yêu cầu",
  TIMEOUT: "Thao tác quá 10 giây, vui lòng thử lại",
  SAVE_SUCCESS: "Đã lưu roadmap thành công",
  DELETE_SUCCESS: "Đã xóa thành công",
  CREATE_SUCCESS: "Đã tạo node mới",
  UPDATE_SUCCESS: "Đã lưu thay đổi",
  ARTICLE_NO_LINK: "Tài liệu chưa được liên kết",
  NODE_DELETED_FROM_SYSTEM: "Node này đã bị xóa khỏi hệ thống",
  LEAF_NO_CHILDREN: "`article` là node lá, không thể có node con",
  NODE_ALREADY_ON_CANVAS: "Node đã có trên Canvas — đã di chuyển đến vị trí của node",
}

/** Req 2.4/3.8: name the offending pair explicitly. */
export function invalidHierarchyMessage(
  source: NodeType,
  target: NodeType
): string {
  if (source === "article") return TOAST_MESSAGES.LEAF_NO_CHILDREN
  const bridge: Partial<Record<NodeType, NodeType>> = {
    role: "skill",
    skill: "chapter",
    chapter: "article",
  }
  const via = bridge[source]
  return via && via !== target
    ? `Không thể kết nối \`${source}\` → \`${target}\`, cần qua \`${via}\` trước`
    : `Không thể kết nối \`${source}\` → \`${target}\``
}

/** Translate a thrown service error into its Vietnamese toast body. */
export function serviceErrorMessage(error: unknown): string {
  if (error instanceof RoadmapServiceError) {
    if (error.code === "INVALID_HIERARCHY" && error.message !== error.code) {
      return `Không thể kết nối \`${error.message.replace(" → ", "\` → \`")}\``
    }
    return TOAST_MESSAGES[error.code]
  }
  return "Đã xảy ra lỗi không xác định, vui lòng thử lại"
}
