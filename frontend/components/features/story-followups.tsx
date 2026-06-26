'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useFormatter, useTranslations } from 'next-intl'
import type { IArticleDetail } from '@/interfaces/article'
import { ArticleBodyLayout, ArticleHeader } from '@/components/features/article-reading-view'
import { isDataUri } from '@/lib/helpers/image-src'

const FOLLOWUP_SUMMARY_MAX_LENGTH = 240
const FOLLOWUP_THUMB_WIDTH = 360
const FOLLOWUP_THUMB_HEIGHT = 240

/**
 * Truncate a plain-text excerpt to the follow-up card length.
 *
 * @param summary - Plain-text summary derived from the article body.
 * @returns A trimmed excerpt, or null when there is nothing to show.
 */
function followupExcerpt(summary: string | null): string | null {
  if (!summary || !summary.trim()) {
    return null
  }
  const trimmed = summary.trim()
  if (trimmed.length <= FOLLOWUP_SUMMARY_MAX_LENGTH) {
    return trimmed
  }
  return `${trimmed.slice(0, FOLLOWUP_SUMMARY_MAX_LENGTH).trimEnd()}…`
}

interface IFollowupTimestampProps {
  article: IArticleDetail
}

/**
 * Render a relative "time ago" label for a follow-up article.
 *
 * @param props - Props containing the follow-up article.
 * @returns The relative timestamp element, or null when no date is available.
 */
function FollowupTimestamp({ article }: IFollowupTimestampProps): JSX.Element | null {
  const format = useFormatter()
  const value = article.publishedAt ?? article.createdAt
  const timestamp = typeof value === 'string' ? Date.parse(value) : Number.NaN
  if (Number.isNaN(timestamp)) {
    return null
  }
  return (
    <time
      dateTime={new Date(timestamp).toISOString()}
      className="text-[11px] font-black uppercase tracking-[0.2em] text-neutral-500"
    >
      {format.relativeTime(timestamp)}
    </time>
  )
}

interface IFollowupToggleProps {
  expanded: boolean
  label: string
  onToggle: () => void
}

/**
 * Render the expand/collapse control that opens a follow-up inline.
 *
 * @param props - Expanded state, localized label, and toggle handler.
 * @returns The toggle button.
 */
function FollowupToggle({ expanded, label, onToggle }: IFollowupToggleProps): JSX.Element {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      className="mt-3 inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-brand hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
    >
      {label}
      <span aria-hidden="true">{expanded ? '↑' : '↓'}</span>
    </button>
  )
}

interface IFollowupCardProps {
  article: IArticleDetail
  readMoreLabel: string
  onToggle: () => void
}

/**
 * Render the collapsed follow-up teaser: large thumbnail, title, excerpt.
 *
 * @param props - The follow-up article, "read more" label, and toggle handler.
 * @returns The collapsed follow-up card.
 */
function FollowupCard({ article, readMoreLabel, onToggle }: IFollowupCardProps): JSX.Element {
  const excerpt = followupExcerpt(article.summary)

  return (
    <div className="group flex flex-col gap-5 sm:flex-row">
      {article.thumbnailUrl ? (
        <button
          type="button"
          onClick={onToggle}
          aria-label={article.title}
          className="shrink-0 overflow-hidden rounded border border-neutral-200 bg-neutral-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
        >
          <Image
            src={article.thumbnailUrl}
            alt={article.title}
            width={FOLLOWUP_THUMB_WIDTH}
            height={FOLLOWUP_THUMB_HEIGHT}
            unoptimized={isDataUri(article.thumbnailUrl)}
            className="h-[200px] w-full object-cover transition-transform duration-200 group-hover:scale-[1.02] sm:h-[240px] sm:w-[360px]"
          />
        </button>
      ) : null}
      <div className="min-w-0 flex-1">
        <FollowupTimestamp article={article} />
        <h3 className="mt-1 text-2xl font-black leading-tight text-neutral-950 sm:text-3xl">
          <button type="button" onClick={onToggle} className="text-left hover:text-brand">
            {article.title}
          </button>
        </h3>
        {excerpt ? (
          <p className="mt-3 line-clamp-3 text-base leading-relaxed text-neutral-700">{excerpt}</p>
        ) : null}
        <FollowupToggle expanded={false} label={readMoreLabel} onToggle={onToggle} />
      </div>
    </div>
  )
}

interface IFollowupExpandedProps {
  article: IArticleDetail
  showLessLabel: string
  onToggle: () => void
}

/**
 * Render an expanded follow-up inline using the shared article reading format.
 *
 * @param props - The follow-up article, "show less" label, and toggle handler.
 * @returns The full inline article view followed by a collapse control.
 */
function FollowupExpanded({ article, showLessLabel, onToggle }: IFollowupExpandedProps): JSX.Element {
  return (
    <div>
      <ArticleHeader article={article} />
      <ArticleBodyLayout article={article} />
      <FollowupToggle expanded label={showLessLabel} onToggle={onToggle} />
    </div>
  )
}

interface IFollowupItemProps {
  article: IArticleDetail
  expanded: boolean
  readMoreLabel: string
  showLessLabel: string
  onToggle: () => void
}

/**
 * Render a single follow-up entry, collapsed teaser or expanded article.
 *
 * @param props - The article, expanded state, labels, and toggle handler.
 * @returns The follow-up entry wrapper.
 */
function FollowupItem({
  article,
  expanded,
  readMoreLabel,
  showLessLabel,
  onToggle,
}: IFollowupItemProps): JSX.Element {
  return (
    <article className="border-b border-neutral-200 py-8 last:border-b-0">
      {expanded ? (
        <FollowupExpanded article={article} showLessLabel={showLessLabel} onToggle={onToggle} />
      ) : (
        <FollowupCard article={article} readMoreLabel={readMoreLabel} onToggle={onToggle} />
      )}
    </article>
  )
}

interface IStoryFollowupsProps {
  updates: IArticleDetail[]
}

/**
 * Render the stacked list of other articles in the same story, newest-first.
 *
 * Each follow-up shows as a large teaser; "Read more" expands it inline in the
 * same article format, extending the page instead of navigating away. Renders
 * nothing when the article is not part of a story.
 *
 * @param props - The follow-up articles to display (already newest-first).
 * @returns The follow-up section, or null when there are no updates.
 */
export function StoryFollowups({ updates }: IStoryFollowupsProps): JSX.Element | null {
  const t = useTranslations('common')
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(() => new Set<string>())

  if (!Array.isArray(updates) || updates.length === 0) {
    return null
  }

  // Toggle a single follow-up's expansion; multiple may be open at once.
  const toggle = (id: string): void => {
    setExpandedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  return (
    <section aria-label={t('earlierInThisStory')} className="mt-12 border-t-2 border-neutral-950 pt-6">
      <h2 className="text-sm font-black uppercase tracking-[0.28em] text-neutral-950">
        {t('earlierInThisStory')}
      </h2>
      <div className="mt-4">
        {updates.map((article) => (
          <FollowupItem
            key={article.id}
            article={article}
            expanded={expandedIds.has(article.id)}
            readMoreLabel={t('readMore')}
            showLessLabel={t('showLess')}
            onToggle={() => toggle(article.id)}
          />
        ))}
      </div>
    </section>
  )
}
