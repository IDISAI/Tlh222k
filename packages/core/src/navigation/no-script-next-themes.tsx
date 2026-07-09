"use client"

import * as React from "react"

interface ValueObject {
  [themeName: string]: string
}

type DataAttribute = `data-${string}`
export type Attribute = DataAttribute | "class"

interface ScriptProps extends React.DetailedHTMLProps<
  React.ScriptHTMLAttributes<HTMLScriptElement>,
  HTMLScriptElement
> {
  [dataAttribute: DataAttribute]: unknown
}

export interface UseThemeProps {
  themes: string[]
  forcedTheme?: string
  setTheme: React.Dispatch<React.SetStateAction<string>>
  theme?: string
  resolvedTheme?: string
  systemTheme?: "dark" | "light"
}

export interface ThemeProviderProps extends React.PropsWithChildren {
  themes?: string[]
  forcedTheme?: string
  enableSystem?: boolean
  disableTransitionOnChange?: boolean
  enableColorScheme?: boolean
  storageKey?: string
  defaultTheme?: string
  attribute?: Attribute | Attribute[]
  value?: ValueObject
  nonce?: string
  scriptProps?: ScriptProps
}

const DEFAULT_THEMES = ["light", "dark"]
const MEDIA = "(prefers-color-scheme: dark)"
const ThemeContext = React.createContext<UseThemeProps | undefined>(undefined)

const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? React.useEffect : React.useLayoutEffect

function getSystemTheme(): "dark" | "light" {
  return window.matchMedia(MEDIA).matches ? "dark" : "light"
}

function readStoredTheme(storageKey: string, fallback: string): string {
  try {
    return localStorage.getItem(storageKey) || fallback
  } catch {
    return fallback
  }
}

function disableTransitions(nonce?: string) {
  const style = document.createElement("style")
  if (nonce) style.setAttribute("nonce", nonce)
  style.appendChild(
    document.createTextNode("*,*::before,*::after{transition:none!important}")
  )
  document.head.appendChild(style)
  return () => {
    window.getComputedStyle(document.body)
    setTimeout(() => document.head.removeChild(style), 1)
  }
}

function applyAttribute(
  attribute: Attribute | Attribute[],
  themes: string[],
  themeName: string,
  value?: ValueObject
) {
  const root = document.documentElement
  const attrs = Array.isArray(attribute) ? attribute : [attribute]
  const attrValue = value?.[themeName] ?? themeName
  const values = value ? Object.values(value) : themes

  for (const attr of attrs) {
    if (attr === "class") {
      root.classList.remove(...values)
      root.classList.add(attrValue)
    } else if (attrValue) {
      root.setAttribute(attr, attrValue)
    } else {
      root.removeAttribute(attr)
    }
  }
}

export function ThemeProvider({
  children,
  themes = DEFAULT_THEMES,
  forcedTheme,
  enableSystem = true,
  disableTransitionOnChange = false,
  enableColorScheme = true,
  storageKey = "theme",
  defaultTheme = enableSystem ? "system" : "light",
  attribute = "data-theme",
  value,
  nonce,
}: ThemeProviderProps) {
  const [theme, setThemeState] = React.useState<string | undefined>()
  const [systemTheme, setSystemTheme] = React.useState<"dark" | "light">(
    "light"
  )

  useIsomorphicLayoutEffect(() => {
    setThemeState(readStoredTheme(storageKey, defaultTheme))
    setSystemTheme(getSystemTheme())
  }, [defaultTheme, storageKey])

  React.useEffect(() => {
    const media = window.matchMedia(MEDIA)
    const onChange = () => setSystemTheme(getSystemTheme())
    media.addEventListener("change", onChange)
    return () => media.removeEventListener("change", onChange)
  }, [])

  const setTheme = React.useCallback<
    React.Dispatch<React.SetStateAction<string>>
  >(
    (nextTheme) => {
      setThemeState((previousTheme) => {
        const resolvedNext =
          typeof nextTheme === "function"
            ? nextTheme(previousTheme ?? defaultTheme)
            : nextTheme

        try {
          localStorage.setItem(storageKey, resolvedNext)
        } catch {
          // localStorage can be unavailable in private or restricted contexts.
        }

        return resolvedNext
      })
    },
    [defaultTheme, storageKey]
  )

  const selectedTheme = forcedTheme ?? theme ?? defaultTheme
  const resolvedTheme =
    selectedTheme === "system" && enableSystem ? systemTheme : selectedTheme

  useIsomorphicLayoutEffect(() => {
    if (!resolvedTheme) return

    const restoreTransitions = disableTransitionOnChange
      ? disableTransitions(nonce)
      : undefined

    applyAttribute(attribute, themes, resolvedTheme, value)

    if (
      enableColorScheme &&
      (resolvedTheme === "light" || resolvedTheme === "dark")
    ) {
      document.documentElement.style.colorScheme = resolvedTheme
    }

    restoreTransitions?.()
  }, [
    attribute,
    disableTransitionOnChange,
    enableColorScheme,
    nonce,
    resolvedTheme,
    themes,
    value,
  ])

  const context = React.useMemo<UseThemeProps>(
    () => ({
      theme,
      setTheme,
      forcedTheme,
      resolvedTheme,
      themes: enableSystem ? [...themes, "system"] : themes,
      systemTheme: enableSystem ? systemTheme : undefined,
    }),
    [
      enableSystem,
      forcedTheme,
      resolvedTheme,
      setTheme,
      systemTheme,
      theme,
      themes,
    ]
  )

  return (
    <ThemeContext.Provider value={context}>{children}</ThemeContext.Provider>
  )
}

export function useTheme(): UseThemeProps {
  return (
    React.useContext(ThemeContext) ?? {
      themes: [],
      setTheme: () => {},
    }
  )
}
