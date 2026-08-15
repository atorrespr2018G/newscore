'use client'

import type { CSSProperties, MouseEvent, ReactNode } from 'react'
import Link from 'next/link'
import type { IArticle } from '@/interfaces/article'
import { useAds } from '@/context/ad-provider'
import { useEditorialArticlePreview } from '@/context/editorial-article-preview-context'
import {
  isUnmodifiedPrimaryClick,
  useHeroVideoAd,
  useHeroVideoAdScope,
} from '@/context/hero-video-ad-context'
import { markHeroVideoAdPending } from '@/lib/helpers/hero-video-ad'

interface IEditorialArticleLinkProps {
  article: IArticle
  className?: string
  style?: CSSProperties
  ariaLabel?: string
  /** Explicit click handler; falls back to the editorial preview context when omitted. */
  onArticleClick?: (article: IArticle) => void
  children: ReactNode
}

/**
 * Render an article as a public link or an in-editor read overlay trigger.
 *
 * In Placement and Preview the editorial preview provider is mounted, so clicks
 * open the read overlay instead of navigating to the public article page. That
 * matters for draft and review stories, which have no public article route.
 *
 * On the public homepage, a primary click opens the centered video ad first.
 *
 * @param props Article, styling, optional click handler, and child content.
 * @returns A link on the public site or a button in editorial preview surfaces.
 */
export function EditorialArticleLink({
  article,
  className,
  style,
  ariaLabel,
  onArticleClick,
  children,
}: IEditorialArticleLinkProps): JSX.Element {
  const preview = useEditorialArticlePreview()
  const clickHandler = onArticleClick ?? preview?.openPreview
  const onPublicClick = usePublicHeroVideoAdClick(article.slug)

  if (clickHandler) {
    return (
      <button
        type="button"
        className={[className, 'w-full cursor-pointer text-left'].filter(Boolean).join(' ')}
        style={style}
        aria-label={ariaLabel ?? article.title}
        onClick={() => clickHandler(article)}
      >
        {children}
      </button>
    )
  }

  return (
    <Link
      href={`/article/${encodeURIComponent(article.slug)}`}
      className={className}
      style={style}
      aria-label={ariaLabel}
      onClick={onPublicClick}
    >
      {children}
    </Link>
  )
}

/**
 * Intercept homepage story clicks so the video ad can play before navigation.
 *
 * @param slug Article slug to open after the overlay.
 * @returns Click handler for the public article link, or undefined off-homepage.
 */
function usePublicHeroVideoAdClick(
  slug: string,
): ((event: MouseEvent<HTMLAnchorElement>) => void) | undefined {
  const intercept = useHeroVideoAdScope()
  const videoAd = useHeroVideoAd()
  const { mode } = useAds()

  if (!intercept || !videoAd || mode === 'off') {
    return undefined
  }

  return (event: MouseEvent<HTMLAnchorElement>) => {
    if (!isUnmodifiedPrimaryClick(event)) {
      markHeroVideoAdPending(slug)
      return
    }
    event.preventDefault()
    videoAd.open(slug)
  }
}
