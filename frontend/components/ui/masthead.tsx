import Link from 'next/link'
import { sectionAnchorId } from '@/lib/helpers/section-labels'

/** Masthead nav entries aligned with CNN.com section modules. */
const MASTHEAD_SECTIONS: Array<{ label: string; positionKey: string }> = [
  { label: 'US', positionKey: 'us' },
  { label: 'World', positionKey: 'world' },
  { label: 'Politics', positionKey: 'politics' },
  { label: 'Business', positionKey: 'business' },
  { label: 'Health', positionKey: 'health' },
  { label: 'Entertainment', positionKey: 'entertainment' },
  { label: 'Style', positionKey: 'style' },
  { label: 'Travel', positionKey: 'travel' },
  { label: 'Sports', positionKey: 'sports' },
]

interface IMastheadProps {
  activeSection?: string
}

/**
 * Newsroom-style masthead with brand + section nav.
 */
export function Masthead({ activeSection }: IMastheadProps): JSX.Element {
  return (
    <header className="border-b border-neutral-200">
      <div className="bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-6 py-2">
          <Link href="/" className="flex items-center gap-2">
            <span className="inline-flex rounded-sm bg-[color:var(--brand-red)] px-2 py-1 text-xs font-black tracking-[0.28em] text-white">
              NEWSCORE
            </span>
          </Link>

          <nav className="hidden flex-1 items-center gap-4 md:flex">
            {MASTHEAD_SECTIONS.map((s) => {
              const isActive = activeSection?.toLowerCase() === s.positionKey.toLowerCase()
              return (
                <Link
                  key={s.positionKey}
                  href={`/#${sectionAnchorId(s.positionKey)}`}
                  className={[
                    'text-[13px] font-semibold text-neutral-800 hover:text-neutral-950',
                    isActive ? 'underline decoration-[color:var(--brand-red)] decoration-2 underline-offset-8' : '',
                  ].join(' ')}
                >
                  {s.label}
                </Link>
              )
            })}
            <Link
              href="/#section-more-top-stories"
              className="text-[13px] font-semibold text-neutral-800 hover:text-neutral-950"
            >
              More
            </Link>
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <span className="hidden rounded-sm border border-neutral-200 bg-neutral-50 px-2 py-1 text-xs font-semibold text-neutral-700 md:inline-flex">
              Watch
            </span>
            <span className="hidden rounded-sm border border-neutral-200 bg-neutral-50 px-2 py-1 text-xs font-semibold text-neutral-700 md:inline-flex">
              Listen
            </span>
            <span className="rounded-sm border border-neutral-300 px-2 py-1 text-xs font-semibold text-neutral-900">
              Sign in
            </span>
          </div>
        </div>
      </div>
    </header>
  )
}

