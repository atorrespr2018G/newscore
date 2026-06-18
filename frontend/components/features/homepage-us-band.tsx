'use client'

import Image from 'next/image'
import Link from 'next/link'
import type { IArticle } from '@/interfaces/article'
import type { IFeedSlot } from '@/interfaces/feed'
import { articleImageSrc, isDataUri } from '@/lib/helpers/image-src'
import { useSectionLabels } from '@/hooks/use-section-labels'
import { sectionAnchorId } from '@/lib/helpers/section-labels'
import { useTranslations } from 'next-intl'
import { splitUsFeaturedArticles } from '@/lib/helpers/feed-layout'
import { belowMediaTextClass } from '@/lib/helpers/text-helpers'

interface IHomepageUsBandProps {
  slot: IFeedSlot
  /** When set (e.g. early homepage band), overrides slot displayName and position-key label. */
  title?: string
}

/**
 * Three-column US module: stacked side stories flanking a center hero with headline below media.
 */
export function HomepageUsBand({ slot, title: titleOverride }: IHomepageUsBandProps): JSX.Element | null {
  const { homepageSectionTitle } = useSectionLabels()
  const t = useTranslations('common')
  const { center, centerTop, left, leftLinks, right, rightLinks } = splitUsFeaturedArticles(slot.articles)

  if (!center) {
    return null
  }

  const title = titleOverride ?? homepageSectionTitle(slot.positionKey, slot.displayName)
  const anchorId = sectionAnchorId(slot.positionKey)

  return (
    <section id={anchorId} className="scroll-mt-24 border-t border-neutral-200 pt-10">
      <div className="mb-5 flex items-end justify-between border-b-2 border-neutral-950 pb-2">
        <h2 className="text-2xl font-normal tracking-tight text-neutral-950">{title}</h2>
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">{t('latest')}</span>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-8">
        <aside className="lg:col-span-3">
          <div className="space-y-8">
            {left.map((article) => (
              <UsSideStory key={article.id} article={article} />
            ))}
            {leftLinks.length > 0 ? <UsSideTextLinks articles={leftLinks} /> : null}
          </div>
        </aside>

        <div className="lg:col-span-6">
          {centerTop.length > 0 ? (
            <div className="mb-6 grid grid-cols-1 gap-4 min-[520px]:grid-cols-2">
              {centerTop.map((article) => (
                <UsPictureNewsScreen key={article.id} article={article} />
              ))}
            </div>
          ) : null}
          <UsSpotlightHero article={center} />
        </div>

        <aside className="lg:col-span-3">
          <div className="space-y-8">
            <UsBandAdScreen />
            {right.map((article) => (
              <UsSideStory key={article.id} article={article} />
            ))}
            {rightLinks.length > 0 ? <UsSideTextLinks articles={rightLinks} /> : null}
          </div>
        </aside>
      </div>
    </section>
  )
}

function UsPictureNewsScreen({ article }: { article: IArticle }): JSX.Element {
  const href = `/article/${encodeURIComponent(article.slug)}`
  const imgSrc = articleImageSrc(article)

  return (
    <article className="group">
      <Link href={href} className="block">
        <div className="overflow-hidden rounded border border-neutral-200 bg-neutral-100">
          <div className="relative aspect-[16/9] w-full">
            <Image
              src={imgSrc}
              alt={article.title}
              fill
              className="object-cover transition-transform duration-200 group-hover:scale-[1.02]"
              unoptimized={isDataUri(imgSrc)}
              sizes="(max-width: 1024px) 50vw, 25vw"
            />
          </div>
        </div>
        <p
          className={[
            'mt-2 overflow-hidden font-sans text-[15px] font-normal leading-snug text-neutral-950 group-hover:underline',
            belowMediaTextClass(),
          ].join(' ')}
        >
          {article.title}
        </p>
      </Link>
    </article>
  )
}

function UsBandAdScreen(): JSX.Element {
  const t = useTranslations('common')

  return (
    <div
      className="overflow-hidden border border-neutral-200 bg-neutral-100"
      role="img"
      aria-label={t('advertisement')}
    >
      <div className="relative flex aspect-[4/3] w-full items-center justify-center px-4">
        <span className="text-[11px] font-black tracking-[0.28em] text-neutral-500">{t('advertisement').toUpperCase()}</span>
      </div>
    </div>
  )
}

function UsSideTextLinks({ articles }: { articles: IArticle[] }): JSX.Element {
  return (
    <ul className="space-y-6 border-t border-neutral-200 pt-8">
      {articles.map((article) => {
        const href = `/article/${encodeURIComponent(article.slug)}`

        return (
          <li key={article.id}>
            <Link
              href={href}
              className="group block font-sans text-[17px] font-normal leading-snug text-neutral-950 hover:text-neutral-950 hover:underline"
            >
              <span className="line-clamp-3">{article.title}</span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

function UsSideStory({ article }: { article: IArticle }): JSX.Element {
  const href = `/article/${encodeURIComponent(article.slug)}`
  const imgSrc = articleImageSrc(article)

  return (
    <article className="group">
      <Link href={href} className="block">
        <div className="overflow-hidden bg-neutral-100">
          <div className="relative aspect-[4/3] w-full">
            <Image
              src={imgSrc}
              alt={article.title}
              fill
              className="object-cover transition-transform duration-200 group-hover:scale-[1.02]"
              unoptimized={isDataUri(imgSrc)}
              sizes="(max-width: 1024px) 100vw, 25vw"
            />
          </div>
        </div>
        <p className="mt-3 line-clamp-3 overflow-hidden font-sans text-[17px] font-normal leading-snug text-neutral-950 group-hover:underline">
          {article.title}
        </p>
      </Link>
    </article>
  )
}

function UsSpotlightHero({ article }: { article: IArticle }): JSX.Element {
  const href = `/article/${encodeURIComponent(article.slug)}`
  const imgSrc = articleImageSrc(article)

  return (
    <article className="group">
      <Link href={href} className="block">
        <div className="overflow-hidden bg-neutral-100">
          <div className="relative aspect-[16/10] w-full sm:aspect-[4/3]">
            <Image
              src={imgSrc}
              alt={article.title}
              fill
              className="object-cover transition-transform duration-200 group-hover:scale-[1.01]"
              unoptimized={isDataUri(imgSrc)}
              sizes="(max-width: 1024px) 100vw, 50vw"
              priority
            />
          </div>
        </div>
        <p
          className={[
            'mt-3 overflow-hidden font-sans text-[26px] font-normal leading-[1.08] tracking-tight text-neutral-950 group-hover:underline sm:text-[30px] lg:text-[34px]',
            belowMediaTextClass(),
          ].join(' ')}
        >
          {article.title}
        </p>
      </Link>
    </article>
  )
}
