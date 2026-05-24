import Link from 'next/link'
import type { Metadata } from 'next'

import { fetchArticleBySlug } from '@/lib/graphql/server-fetch'
import { getServerMarketCode } from '@/lib/market-server'

import { ArticleClient } from './ui'

interface IArticlePageProps {
  params: { slug: string }
}

export async function generateMetadata({ params }: IArticlePageProps): Promise<Metadata> {
  const market = getServerMarketCode()
  const article = await fetchArticleBySlug(params.slug, market)

  if (!article) {
    return {
      title: 'Article not found — NewsCore',
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

  return (
    <main id="main-content" className="mx-auto max-w-3xl px-6 py-10">
      <nav className="mb-6" aria-label="Breadcrumb">
        <Link
          href="/"
          className="text-sm font-semibold text-neutral-600 hover:text-[color:var(--brand-red)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-red)] focus-visible:ring-offset-2"
        >
          ← Back to homepage
        </Link>
      </nav>
      <ArticleClient slug={params.slug} initialArticle={initialArticle} />
    </main>
  )
}
