// Single source of truth for notebook languages: which nbformat language maps
// to which runtime profile (Docker image family) and which Jupyter kernelspec
// name lives inside that image. Go kernel-server mirrors the profile list in
// internal/profiles; keep both in sync when adding a language.

import type { RuntimeProfile } from "./types"

export type NotebookLanguage =
  | "python"
  | "javascript"
  | "cpp"
  | "java"
  | "rust"
  | "go"
  | "julia"

export interface LanguageSpec {
  /** nbformat `kernelspec.language` / `language_info.name`. */
  language: NotebookLanguage
  /** Human label for the editor selector. */
  label: string
  /** Session runtime profile (selects the Docker image). */
  profile: RuntimeProfile
  /** Jupyter kernelspec name registered inside the image. */
  kernelName: string
  /** Default kernelspec display name written into notebook metadata. */
  displayName: string
}

export const LANGUAGES: readonly LanguageSpec[] = [
  {
    language: "python",
    label: "Python",
    profile: "data-science",
    kernelName: "python3",
    displayName: "Python 3",
  },
  {
    language: "javascript",
    label: "JavaScript",
    profile: "javascript",
    kernelName: "deno",
    displayName: "Deno (JavaScript)",
  },
  {
    language: "cpp",
    label: "C++",
    profile: "cpp",
    kernelName: "xcpp17",
    displayName: "C++17 (xeus-cling)",
  },
  {
    language: "java",
    label: "Java",
    profile: "java",
    kernelName: "java",
    displayName: "Java (IJava)",
  },
  {
    language: "rust",
    label: "Rust",
    profile: "rust",
    kernelName: "evcxr",
    displayName: "Rust (evcxr)",
  },
  {
    language: "go",
    label: "Go",
    profile: "go",
    kernelName: "gophernotes",
    displayName: "Go (gophernotes)",
  },
  {
    language: "julia",
    label: "Julia",
    profile: "julia",
    kernelName: "julia",
    displayName: "Julia (IJulia)",
  },
]

export const RUNTIME_PROFILES: readonly RuntimeProfile[] = [
  "data-science",
  "ml-cpu",
  ...LANGUAGES.filter((l) => l.language !== "python").map((l) => l.profile),
]

export function isRuntimeProfile(value: string): value is RuntimeProfile {
  return (RUNTIME_PROFILES as readonly string[]).includes(value)
}

/** Spec for a supported nbformat language. Unknown values stay unsupported. */
export function languageSpec(
  language: string | undefined
): LanguageSpec | undefined {
  return LANGUAGES.find((candidate) => candidate.language === language)
}

/** Kernelspec name to start inside the image for a session profile. */
export function kernelNameForProfile(profile: RuntimeProfile): string {
  // Both Python profiles (data-science, ml-cpu) run the python3 kernel.
  const spec = LANGUAGES.find((l) => l.profile === profile)
  return spec?.kernelName ?? "python3"
}

/**
 * Session profile for a notebook: non-Python languages map 1:1 to their
 * profile; Python keeps the notebook's stored profile (data-science | ml-cpu).
 */
export function profileForNotebook(
  language: string | undefined,
  pythonProfile: RuntimeProfile = "data-science"
): RuntimeProfile | null {
  const spec = languageSpec(language)
  if (!spec) return null
  if (spec.language !== "python") return spec.profile
  return pythonProfile === "ml-cpu" ? "ml-cpu" : "data-science"
}
