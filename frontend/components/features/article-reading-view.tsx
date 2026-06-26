'use client'

import { useFormatter, useTranslations } from 'next-intl'
import type { IArticleDetail } from '@/interfaces/article'
import { ArticleGallery } from '@/components/ui/article-gallery'
import { articleBodyHtmlChunks } from '@/lib/helpers/article-body-html'

/** Number of distinct ad creatives cycled through the article rail/ribbon. */
const AD_VARIANT_COUNT = 3

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
 * Pick the rail ad creative for a given body-chunk index.
 *
 * @param index - Zero-based body-chunk index.
 * @returns The localized title and subtitle for the rail ad.
 */
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

  return ads[index % AD_VARIANT_COUNT]
}

/**
 * Pick the ribbon ad message for a given body-chunk index.
 *
 * @param index - Zero-based body-chunk index.
 * @returns The localized ribbon message.
 */
function useRibbonMessage(index: number): string {
  const t = useTranslations('home')
  const messages = [
    t('articleAds.ribbonMessages.fullWidth'),
    t('articleAds.ribbonMessages.crossScreen'),
    t('articleAds.ribbonMessages.editorialPartner'),
  ]

  return messages[index % AD_VARIANT_COUNT]
}

/**
 * Render the sticky sidebar rail advertisement.
 *
 * @param props - The body-chunk index used to vary the creative.
 * @returns The rail ad aside.
 */
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

/**
 * Render the full-width ribbon advertisement between body chunks.
 *
 * @param props - The body-chunk index used to vary the message.
 * @returns The ribbon ad section.
 */
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
  const t = useTranslations('common')
  const body = articleBodyText(article)
  const headline = articleHeadline(article, t('untitledStory'))
  const chunks = articleBodyHtmlChunks({ body, headline })

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
