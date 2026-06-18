import Link from 'next/link'
import { getTranslations } from '@/lib/locale-server'
import { sectionNavHref } from '@/lib/helpers/section-labels'

const FOOTER_SECTION_KEYS = [
  'politics',
  'world',
  'technology',
  'health',
  'finance',
  'entertainment',
] as const

const COMPANY_LINK_KEYS = [
  { href: '/about', key: 'about' },
  { href: '/contact', key: 'contact' },
  { href: '/careers', key: 'careers' },
  { href: '/advertise', key: 'advertise' },
] as const

const LEGAL_LINK_KEYS = [
  { href: '/terms', key: 'terms' },
  { href: '/privacy', key: 'privacy' },
  { href: '/cookies', key: 'cookies' },
  { href: '/accessibility', key: 'accessibility' },
] as const

/**
 * Site-wide footer with section navigation and general information.
 */
export async function Footer(): Promise<JSX.Element> {
  const tCommon = await getTranslations('common')
  const tNav = await getTranslations('navigation')
  const year = new Date().getFullYear()

  const sectionLabel = (positionKey: string): string =>
    tNav(`sectionLabels.${positionKey}` as `sectionLabels.${string}`)

  return (
    <footer className="mt-16 bg-[color:var(--brand-navy)] text-white">
      <div className="site-container py-12 md:py-14">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-1">
            <Link href="/" className="inline-flex focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--brand-navy)]">
              <span className="inline-flex rounded-sm bg-[color:var(--brand-red)] px-2 py-1 text-xs font-black tracking-[0.28em] text-white">
                NEWSCORE
              </span>
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/75">
              {tCommon('tagline')}
            </p>
          </div>

          <div>
            <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-white/90">{tCommon('sectionsHeading')}</h2>
            <ul className="mt-4 space-y-2">
              {FOOTER_SECTION_KEYS.map((key) => (
                <li key={key}>
                  <Link
                    href={sectionNavHref(key)}
                    className="text-sm text-white/75 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--brand-navy)]"
                  >
                    {sectionLabel(key)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-white/90">{tCommon('companyHeading')}</h2>
            <ul className="mt-4 space-y-2">
              {COMPANY_LINK_KEYS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-white/75 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--brand-navy)]"
                  >
                    {tCommon(`footerCompany.${link.key}`)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-white/90">{tCommon('legalHeading')}</h2>
            <ul className="mt-4 space-y-2">
              {LEGAL_LINK_KEYS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-white/75 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--brand-navy)]"
                  >
                    {tCommon(`footerLegal.${link.key}`)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-white/15 pt-6">
          <p className="text-xs text-white/60">
            {tCommon('copyright', { year })}
          </p>
          <p className="mt-2 max-w-3xl text-xs leading-relaxed text-white/50">
            {tCommon('disclaimer')}
          </p>
        </div>
      </div>
    </footer>
  )
}
