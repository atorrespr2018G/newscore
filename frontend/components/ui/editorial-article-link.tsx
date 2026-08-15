'use client'

import type { CSSProperties, ReactNode } from 'react'
import Link from 'next/link'
import type { IArticle } from '@/interfaces/article'
import { useAds } from '@/context/ad-provider'
import { useEditorialArticlePreview } from '@/context/editorial-article-preview-context'
import { useHeroVideoAdScope } from '@/context/hero-video-ad-context'
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
 * On the public homepage hero, a click still navigates to the article; the
 * video ad opens after that article has rendered.
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
  const onHeroNavigate = useHeroVideoAdArm(article.slug)

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
      onClick={onHeroNavigate}
    >
      {children}
    </Link>
  )
}

/**
 * Arm the article-page video ad when a homepage hero story is opened.
 *
 * Navigation is not blocked; the overlay waits until the article has rendered.
 *
 * @param slug Article slug being opened.
 * @returns Click handler, or undefined outside the homepage hero.
 */
function useHeroVideoAdArm(slug: string): (() => void) | undefined {
  const intercept = useHeroVideoAdScope()
  const { mode } = useAds()

  if (!intercept || mode === 'off') {
    return undefined
  }

  return () => {
    markHeroVideoAdPending(slug)
  }
}
