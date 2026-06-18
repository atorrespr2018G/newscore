import Link from 'next/link'
import type { Metadata } from 'next'

import { fetchArticleBySlug } from '@/lib/graphql/server-fetch'
import { getServerMarketCode } from '@/lib/market-server'
import { getTranslations } from '@/lib/locale-server'

import { ArticleClient } from './ui'

interface IArticlePageProps {
  params: { slug: string }
}

export async function generateMetadata({ params }: IArticlePageProps): Promise<Metadata> {
  const market = getServerMarketCode()
  const article = await fetchArticleBySlug(params.slug, market)
  const t = await getTranslations('common')

  if (!article) {
    return {
      title: t('articleNotFoundTitle'),
    }
  }

  const description = article.body.slice(0, 160).replace(/\s+/g, ' ').trim()

  return {
    title: `${article.title} — NewsCore`,
    description: description || undefined,
  }
}

export default async function ArticlePage({ params }: IArticlePageProps): Promise<JSX.Element> {
  const market = getServerMarketCode()
  const initialArticle = await fetchArticleBySlug(params.slug, market)
  const t = await getTranslations('common')

  return (
    <main id="main-content" className="site-container py-10">
      <nav className="mb-6" aria-label={t('breadcrumb')}>
        <Link
          href="/"
          className="text-sm font-semibold text-neutral-600 hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
        >
          {t('backToHomepage')}
        </Link>
      </nav>
      <ArticleClient slug={params.slug} initialArticle={initialArticle} />
    </main>
  )
}
