'use client'

import { useFormatter, useTranslations } from 'next-intl'
import type { IArticleDetail } from '@/interfaces/article'
import { ArticleGallery } from '@/components/ui/article-gallery'
import { AdSlot } from '@/components/ui/ad-slot'
import { ARTICLE_RIBBON_AD_SHELL_CLASS } from '@/lib/ad-config'
import { articleBodyHtmlChunks } from '@/lib/helpers/article-body-html'

/**
 * Resolve the article headline, falling back to a localized placeholder.
 *
 * @param article - Full article detail.
 * @param fallback - Localized "untitled" label.
 * @returns The trimmed headline or the fallback.
 */
function articleHeadline(article: IArticleDetail, fallback: string): string {
  return typeof article.title === 'string' && article.title.trim() ? article.title.trim() : fallback
}

/**
 * Resolve the byline author, falling back to a localized placeholder.
 *
 * @param article - Full article detail.
 * @param fallback - Localized "staff" label.
 * @returns The trimmed author name or the fallback.
 */
function articleAuthor(article: IArticleDetail, fallback: string): string {
  return typeof article.authorName === 'string' && article.authorName.trim()
    ? article.authorName.trim()
    : fallback
}

/**
 * Resolve the lead tag/kicker, falling back to a localized placeholder.
 *
 * @param article - Full article detail.
 * @param fallback - Localized "latest news" label.
 * @returns The first tag or the fallback.
 */
function articleTopTag(article: IArticleDetail, fallback: string): string {
  return Array.isArray(article.tags) && article.tags[0] ? article.tags[0] : fallback
}

/**
 * Read the raw stored body string from an article.
 *
 * @param article - Full article detail.
 * @returns The body HTML string, or an empty string when absent.
 */
function articleBodyText(article: IArticleDetail): string {
  return typeof article.body === 'string' ? article.body : ''
}

/**
 * Build the localized "published at" label for an article header.
 *
 * @param article - Full article detail.
 * @returns A formatted timestamp or a localized "updated recently" fallback.
 */
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

/**
 * Render the article masthead: kicker, headline, byline, and timestamp.
 *
 * @param props - The full article detail to render.
 * @returns The article header element.
 */
export function ArticleHeader({ article }: { article: IArticleDetail }): JSX.Element {
  const t = useTranslations('common')
  const headline = articleHeadline(article, t('untitledStory'))
  const topTag = articleTopTag(article, t('latestNews'))
  const author = articleAuthor(article, t('newsCoreStaff'))
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

interface IArticleTextColumnProps {
  article: IArticleDetail
  html: string
  showLeadMedia?: boolean
}

/**
 * Render one body chunk as long-form prose, optionally with the lead gallery.
 *
 * @param props - The article, sanitized chunk HTML, and lead-media flag.
 * @returns The prose column.
 */
function ArticleTextColumn({ article, html, showLeadMedia = false }: IArticleTextColumnProps): JSX.Element {
  return (
    <section className="lg:col-span-2">
      <div className="border-l border-neutral-200 pl-6 sm:pl-8">
        {showLeadMedia ? <ArticleGallery article={article} /> : null}
        {/* Body is reporter-authored, sanitized HTML rendered as long-form prose. */}
        <div
          className="prose prose-lg max-w-none leading-8 text-neutral-900"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </section>
  )
}

/**
 * Render the sticky sidebar rail advertisement.
 *
 * @param props - The body-chunk index used to vary the creative.
 * @returns The rail ad aside.
 */
function ArticleRailAd({ index }: { index: number }): JSX.Element {
  return (
    <aside className="lg:col-span-1">
      <div className="lg:sticky lg:top-24">
        <AdSlot slotKey="article-rail" index={index} className="min-h-[320px]" />
      </div>
    </aside>
  )
}

/**
 * Render the full-width ribbon advertisement between body chunks.
 *
 * @param props - The body-chunk index used to vary the creative.
 * @returns The ribbon ad section.
 */
function ArticleAdRibbon({ index }: { index: number }): JSX.Element {
  const t = useTranslations('common')

  return (
    <section aria-label={t('advertisement')} className="border-b border-neutral-200 py-4">
      <AdSlot
        slotKey="article-in-content"
        index={index}
        className={ARTICLE_RIBBON_AD_SHELL_CLASS}
      />
    </section>
  )
}

/**
 * Render the full article body: gallery, prose chunks, and interleaved ads.
 *
 * This is the canonical reading layout shared by the article page and the
 * inline-expanded story follow-ups, so both present the same format.
 *
 * @param props - The full article detail to lay out.
 * @returns The article body layout.
 */
export function ArticleBodyLayout({ article }: { article: IArticleDetail }): JSX.Element {
  const body = articleBodyText(article)
  const chunks = articleBodyHtmlChunks(body)

  return (
    <div className="mt-8 space-y-8">
      {chunks.map((chunk, index) => (
        <div key={`chunk-${index}`} className="space-y-8">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3 lg:gap-10">
            <ArticleTextColumn article={article} html={chunk} showLeadMedia={index === 0} />
            <ArticleRailAd index={index} />
          </div>
          <ArticleAdRibbon index={index} />
        </div>
      ))}
    </div>
  )
}
