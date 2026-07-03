import Link from 'next/link'
import { getTranslations } from '@/lib/locale-server'

/**
 * Custom 404 page for unknown routes and invalid locales.
 *
 * @returns Localized not-found UI with a link home.
 */
export default async function NotFoundPage(): Promise<JSX.Element> {
  const t = await getTranslations('common')

  return (
    <main id="main-content" className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-2xl font-black text-neutral-900">{t('articleNotFoundTitle')}</h1>
      <p className="mt-4 text-neutral-700">{t('notFound')}</p>
      <Link href="/" className="mt-6 inline-block text-sm font-semibold text-brand hover:underline">
        {t('backToHomepage')}
      </Link>
    </main>
  )
}
