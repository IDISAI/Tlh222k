import Link from "next/link"
import { DollarSign, Globe } from "lucide-react"

const COLUMNS: { heading: string; links: string[] }[] = [
  {
    heading: "Support",
    links: [
      "Help Center",
      "Getting started",
      "Learner guarantee",
      "Report a concern",
    ],
  },
  {
    heading: "Community",
    links: [
      "About",
      "Discussion forums",
      "Become a mentor",
      "Study groups",
    ],
  },
  {
    heading: "lh222k",
    links: ["About", "Newsroom", "New features", "Careers"],
  },
]

/**
 * Airbnb-style footer: surface-soft band, one hairline on top, three link
 * columns, then a legal strip carrying the copyright and the locale/currency
 * pickers. Flat — the system's one shadow tier is not used here.
 */
export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-secondary">
      <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-6 px-5 py-12 sm:grid-cols-3 md:px-10">
        {COLUMNS.map(({ heading, links }) => (
          <div key={heading}>
            <h4 className="mb-4 text-base font-medium">{heading}</h4>
            <ul className="flex list-none flex-col gap-3 p-0">
              {links.map((label) => (
                <li key={label}>
                  <Link
                    href="#"
                    className="text-sm text-muted-foreground transition-opacity hover:opacity-75"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-border">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-4 px-5 py-6 md:px-10">
          <div className="flex flex-wrap items-center gap-2.5 text-[13px] text-muted-foreground">
            <span>© 2026 lh222k, Inc.</span>
            <Link href="#">Privacy</Link>
            <span>·</span>
            <Link href="#">Terms</Link>
            <span>·</span>
            <Link href="#">Sitemap</Link>
          </div>
          <div className="flex items-center gap-5">
            <button
              type="button"
              className="flex items-center gap-1.5 text-[13px] font-semibold"
            >
              <Globe className="size-4" />
              English (US)
            </button>
            <button
              type="button"
              className="flex items-center gap-1.5 text-[13px] font-semibold"
            >
              <DollarSign className="size-4" />
              USD
            </button>
          </div>
        </div>
      </div>
    </footer>
  )
}
