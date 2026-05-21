import Link from 'next/link'

interface IMastheadProps {
  activeSection?: string
}

/**
 * Newsroom-style masthead with brand + section nav.
 */
export function Masthead({ activeSection }: IMastheadProps): JSX.Element {
  const sections = ['US', 'World', 'Politics', 'Business', 'Health', 'Entertainment', 'Style', 'Travel', 'Sports', 'More']

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
            {sections.map((s) => {
              const isActive = activeSection?.toLowerCase() === s.toLowerCase()
              return (
                <Link
                  key={s}
                  href="/"
                  className={[
                    'text-[13px] font-semibold text-neutral-800 hover:text-neutral-950',
                    isActive ? 'underline decoration-[color:var(--brand-red)] decoration-2 underline-offset-8' : '',
                  ].join(' ')}
                >
                  {s}
                </Link>
              )
            })}
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

