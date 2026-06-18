'use client'

import type { IArticleDetail } from '@/interfaces/article'
import { useArticle } from '@/hooks/use-article'
import { ArticleLeadMedia, ArticleLeadMediaHasVideo } from '@/components/ui/article-lead-media'
import { useFormatter, useTranslations } from 'next-intl'

const BODY_CHUNK_SIZE = 4
const MIN_BODY_SETS = 4
const MIN_PARAGRAPH_COUNT = BODY_CHUNK_SIZE * MIN_BODY_SETS

const FALLBACK_PARAGRAPHS = [
  'NewsCore continues to follow the latest developments and update this report as new details are confirmed by reporters and public officials.',
  'Editors are organizing the key facts, the local reaction, and the broader national context so readers can follow the story with clear updates throughout the day.',
  'Additional reporting is expected to expand on the timeline, explain what changed, and highlight the people, places, and decisions at the center of this event.',
  'Audience interest remains strong, so this article view includes extended copy blocks to preview the full long-form presentation and advertising layout.',
]

interface IArticleClientProps {
  slug: string
  initialArticle?: IArticleDetail
}

function articleHeadline(article: IArticleDetail): string {
  return typeof article.title === 'string' && article.title.trim() ? article.title.trim() : ''
}

function articleAuthor(article: IArticleDetail): string {
  return typeof article.authorName === 'string' && article.authorName.trim()
    ? article.authorName.trim()
    : ''
}

function articleTopTag(article: IArticleDetail): string {
  return Array.isArray(article.tags) && article.tags[0] ? article.tags[0] : ''
}

function articleBodyText(article: IArticleDetail): string {
  return typeof article.body === 'string' ? article.body : ''
}

function paddedParagraphs(paragraphs: string[], headline: string): string[] {
  const normalizedParagraphs = paragraphs.filter((paragraph) => paragraph.trim().length > 0)
  if (normalizedParagraphs.length >= MIN_PARAGRAPH_COUNT) {
    return normalizedParagraphs
  }

  const padded = [...normalizedParagraphs]
  let idx = 0

  while (padded.length < MIN_PARAGRAPH_COUNT) {
    const template = FALLBACK_PARAGRAPHS[idx % FALLBACK_PARAGRAPHS.length]
    padded.push(`${headline}: ${template}`)
    idx += 1
  }

  return padded
}

function splitArticleBody(body?: string | null): string[] {
  const normalized = typeof body === 'string' ? body.replace(/\r\n/g, '\n').trim() : ''
  if (!normalized) return []

  const paragraphBreaks = normalized
    .split(/\n\s*\n+/)
    .map((paragraph) => paragraph.replace(/\s*\n\s*/g, ' ').trim())
    .filter(Boolean)

  if (paragraphBreaks.length > 1) return paragraphBreaks

  return normalized
    .split(/\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
}

function paragraphChunks(paragraphs: string[]): string[][] {
  const chunks: string[][] = []

  for (let idx = 0; idx < paragraphs.length; idx += BODY_CHUNK_SIZE) {
    chunks.push(paragraphs.slice(idx, idx + BODY_CHUNK_SIZE))
  }

  return chunks
}

function usePublishedLabel(article: IArticleDetail): string {
  const format = useFormatter()
  const t = useTranslations('common')
  const publishedValue = article.publishedAt ?? article.createdAt
  const timestamp = typeof publishedValue === 'string' ? Date.parse(publishedValue) : Number.NaN

  if (Number.isNaN(timestamp)) {
    return t('updatedRecently')
  }

  return format.dateTime(timestamp, { dateStyle: 'medium', timeStyle: 'short' })
}

function ArticleHeader({ article }: { article: IArticleDetail }): JSX.Element {
  const t = useTranslations('common')
  const headline = articleHeadline(article) || t('untitledStory')
  const topTag = articleTopTag(article) || t('latestNews')
  const author = articleAuthor(article) || t('newsCoreStaff')
  const publishedLabel = usePublishedLabel(article)

  return (
    <header className="border-b border-neutral-200 pb-8">
      <p className="text-xs font-black uppercase tracking-[0.28em] text-brand">{topTag}</p>
      <h1 className="mt-3 max-w-5xl text-4xl font-black leading-tight tracking-tight sm:text-5xl">
        {headline}
      </h1>
      <p className="mt-4 text-sm font-semibold text-neutral-600">
        {t('byAuthor', { author })}{' '}
        <span className="font-normal text-neutral-400">• {publishedLabel}</span>
      </p>
    </header>
  )
}

function ArticleLeadMediaBlock({ article }: { article: IArticleDetail }): JSX.Element {
  const hasVideo = ArticleLeadMediaHasVideo(article)

  return (
    <div className="mb-6 overflow-hidden rounded border border-neutral-200 bg-neutral-100">
      <div className={hasVideo ? 'relative aspect-[16/9] bg-black' : 'relative aspect-[16/9]'}>
        <ArticleLeadMedia article={article} mode={hasVideo ? 'full' : 'teaser'} />
      </div>
    </div>
  )
}

function ArticleTextColumn({
  article,
  paragraphs,
  showLeadMedia = false,
}: {
  article: IArticleDetail
  paragraphs: string[]
  showLeadMedia?: boolean
}): JSX.Element {
  return (
    <section className="lg:col-span-2">
      <div className="border-l border-neutral-200 pl-6 sm:pl-8">
        {showLeadMedia ? <ArticleLeadMediaBlock article={article} /> : null}
        <div className="space-y-6">
          {paragraphs.map((paragraph, index) => (
            <p key={`${index}-${paragraph.slice(0, 24)}`} className="text-lg leading-8 text-neutral-900">
              {paragraph}
            </p>
          ))}
        </div>
      </div>
    </section>
  )
}

function useArticleAds(index: number): { title: string; subtitle: string } {
  const t = useTranslations('home')
  const ads = [
    {
      title: t('articleAds.sponsoredBriefing.title'),
      subtitle: t('articleAds.sponsoredBriefing.subtitle'),
    },
    {
      title: t('articleAds.brandSpotlight.title'),
      subtitle: t('articleAds.brandSpotlight.subtitle'),
    },
    {
      title: t('articleAds.newswirePartner.title'),
      subtitle: t('articleAds.newswirePartner.subtitle'),
    },
  ]

  return ads[index % ads.length]
}

function useRibbonMessage(index: number): string {
  const t = useTranslations('home')
  const messages = [
    t('articleAds.ribbonMessages.fullWidth'),
    t('articleAds.ribbonMessages.crossScreen'),
    t('articleAds.ribbonMessages.editorialPartner'),
  ]

  return messages[index % messages.length]
}

function ArticleRailAd({ index }: { index: number }): JSX.Element {
  const t = useTranslations('common')
  const ad = useArticleAds(index)

  return (
    <aside className="lg:col-span-1">
      <div className="space-y-4 lg:sticky lg:top-24">
        <div className="rounded border border-neutral-200 bg-neutral-950 p-5 text-white">
          <p className="text-[11px] font-black tracking-[0.28em] text-white/70">{t('advertisement').toUpperCase()}</p>
          <h2 className="mt-3 text-2xl font-black leading-tight">{ad.title}</h2>
          <p className="mt-2 text-sm leading-6 text-white/80">{ad.subtitle}</p>
        </div>
        <div
          className="flex min-h-[320px] items-center justify-center rounded border border-dashed border-neutral-300 bg-neutral-100 px-4"
          role="img"
          aria-label={t('advertisement')}
        >
          <span className="text-[11px] font-black tracking-[0.28em] text-neutral-500">{t('advertisement').toUpperCase()}</span>
        </div>
      </div>
    </aside>
  )
}

function ArticleAdRibbon({ index }: { index: number }): JSX.Element {
  const t = useTranslations('common')
  const message = useRibbonMessage(index)

  return (
    <section aria-label={t('advertisement')} className="border-b border-neutral-200 py-4">
      <div
        className="flex min-h-[192px] items-center justify-center rounded border border-dashed border-neutral-300 bg-neutral-100 px-4"
        role="img"
        aria-label={t('advertisement')}
      >
        <div className="text-center">
          <p className="text-[11px] font-black tracking-[0.28em] text-neutral-500">{t('advertisement').toUpperCase()}</p>
          <p className="mt-3 text-sm font-semibold text-neutral-700">{message}</p>
        </div>
      </div>
    </section>
  )
}

function ArticleBodyLayout({ article }: { article: IArticleDetail }): JSX.Element {
  const t = useTranslations('common')
  const body = articleBodyText(article)
  const headline = articleHeadline(article) || t('untitledStory')
  const paragraphs = paddedParagraphs(splitArticleBody(body), headline)
  const chunks = paragraphChunks(paragraphs)

  return (
    <div className="mt-8 space-y-8">
      {chunks.map((chunk, index) => (
        <div key={`${index}-${chunk[0]?.slice(0, 24) ?? 'body'}`} className="space-y-8">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3 lg:gap-10">
            <ArticleTextColumn article={article} paragraphs={chunk} showLeadMedia={index === 0} />
            <ArticleRailAd index={index} />
          </div>
          <ArticleAdRibbon index={index} />
        </div>
      ))}
    </div>
  )
}

/**
 * Render the interactive article detail view for the current slug.
 */
export function ArticleClient({ slug, initialArticle }: IArticleClientProps): JSX.Element {
  const t = useTranslations('common')
  const { data, loading, error } = useArticle(slug)
  const article = data ?? initialArticle

  if (loading && !article) {
    return <div className="text-neutral-600">{t('loading')}</div>
  }
  if (error && !article) {
    return <div className="text-red-700">{t('failedToLoad', { message: error.message })}</div>
  }
  if (!article) {
    return <div className="text-neutral-600">{t('notFound')}</div>
  }

  return (
    <article>
      <ArticleHeader article={article} />
      <ArticleBodyLayout article={article} />
    </article>
  )
}
