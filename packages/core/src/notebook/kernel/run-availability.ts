// Why a notebook can or cannot be run here, in words a young learner can read.
//
// Both the web viewer and the admin editor decide this the same way, so the
// wording lives here rather than being retyped in each app — the two used to
// disagree, and one of them said "kernel server", which means nothing to a
// student.

import { languageSpec, type NotebookLanguage } from "./languages"

/** Languages that run entirely in the browser, with no execution backend. */
export const BROWSER_LANGUAGES: readonly NotebookLanguage[] = [
  "python",
  "javascript",
]

export type RunAvailability =
  | { runnable: true }
  | {
      runnable: false
      /** One short line for the kernel bar. */
      title: string
      /** The reason, and what the reader can still do. */
      detail: string
    }

function isBrowserLanguage(language: NotebookLanguage): boolean {
  return BROWSER_LANGUAGES.includes(language)
}

/**
 * Decide whether cells can run, and if not, say why.
 *
 * `hasKernelServer` — a Jupyter kernel server is configured and reachable.
 * `hasBrowserWorker` — the host app supplied a worker factory for in-browser
 * languages. Absent, Python/JavaScript cannot run either, and that is a
 * configuration mistake rather than something the reader can act on.
 */
export function runAvailability(
  language: string | undefined,
  {
    hasKernelServer,
    hasBrowserWorker = true,
  }: { hasKernelServer: boolean; hasBrowserWorker?: boolean }
): RunAvailability {
  const spec = languageSpec(language)
  if (!spec) {
    return {
      runnable: false,
      title: `Chưa hỗ trợ ngôn ngữ "${language ?? "không rõ"}"`,
      detail:
        "Notebook này dùng một ngôn ngữ mà hệ thống chưa biết cách chạy. Bạn vẫn đọc được nội dung và kết quả đã lưu.",
    }
  }

  if (hasKernelServer) return { runnable: true }

  if (isBrowserLanguage(spec.language)) {
    if (hasBrowserWorker) return { runnable: true }
    return {
      runnable: false,
      title: `Chưa chạy được ${spec.label}`,
      detail: `Thiếu cấu hình worker cho ${spec.label}. Đây là lỗi cài đặt của hệ thống, không phải do notebook.`,
    }
  }

  return {
    runnable: false,
    title: `${spec.label} chưa chạy được trên bản web này`,
    detail:
      `Python và JavaScript chạy thẳng trong trình duyệt nên bấm Run là được. ` +
      `${spec.label} thì cần một máy chủ riêng để biên dịch, mà bản web này không có. ` +
      `Bạn vẫn đọc được toàn bộ bài và kết quả đã lưu sẵn; muốn tự chạy thử thì mở dự án trên máy tính có Docker.`,
  }
}
