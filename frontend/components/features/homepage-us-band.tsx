'use client'

import Image from 'next/image'
import type { IArticle } from '@/interfaces/article'
import { EditorialArticleLink } from '@/components/ui/editorial-article-link'
import type { IFeedSlot } from '@/interfaces/feed'
import { articleImageSrc, isDataUri } from '@/lib/helpers/image-src'
import { PlacementSlotScope, useEditorPlacement } from '@/context/editor-placement-context'
import { PlacementOverlay, PlacementSectionDropZone } from '@/components/features/placement-overlay'
import { useSectionLabels } from '@/hooks/use-section-labels'
import { ArchiveSectionLink } from '@/components/ui/archive-section-link'
import { homepageSectionLandingHref, sectionAnchorId } from '@/lib/helpers/section-labels'
import { useTranslations } from 'next-intl'
import { splitUsFeaturedArticles } from '@/lib/helpers/feed-layout'
import { belowMediaTextClass } from '@/lib/helpers/text-helpers'
import { AdSlot } from '@/components/ui/ad-slot'
import { usePageAds } from '@/context/page-ads-context'

interface IHomepageUsBandProps {
  slot: IFeedSlot
  /** When set (e.g. early homepage band), overrides slot displayName and position-key label. */
  title?: string
  /** Layout page name so homepage World headings can open `/world`. */
  pageName?: string
}

/**
 * Three-column US module: stacked side stories flanking a center hero with headline below media.
 */
export function HomepageUsBand({
  slot,
  title: titleOverride,
  pageName,
}: IHomepageUsBandProps): JSX.Element | null {
  const { homepageSectionTitle } = useSectionLabels()
  const t = useTranslations('common')
  const editor = useEditorPlacement()
  const { center, centerTop, left, leftLinks, right, rightLinks } = splitUsFeaturedArticles(slot.articles)
  const title = titleOverride ?? homepageSectionTitle(slot.positionKey, slot.displayName)
  const anchorId = sectionAnchorId(slot.positionKey)
  const headingHref = homepageSectionLandingHref(pageName, slot.positionKey)
  const showEmptyPlacementShell = !center && editor != null

  if (!center && !showEmptyPlacementShell) {
    return null
  }

  if (!center) {
    return (
      <PlacementSlotScope slotId={slot.id}>
        <section id={anchorId} className="scroll-mt-24 border-t border-neutral-200 pt-10">
          <UsBandHeading title={title} latestLabel={t('latest')} href={headingHref} />
          <div className="rounded border border-dashed border-neutral-300 bg-neutral-50 p-4">
            <PlacementSectionDropZone />
          </div>
        </section>
      </PlacementSlotScope>
    )
  }

  return (
    <PlacementSlotScope slotId={slot.id}>
      <section id={anchorId} className="scroll-mt-24 border-t border-neutral-200 pt-10">
        <UsBandHeading title={title} latestLabel={t('latest')} href={headingHref} />

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
        <PlacementSectionDropZone />
      </section>
    </PlacementSlotScope>
  )
}

/**
 * US-band section title. Homepage World (and other dedicated pages) are clickable.
 *
 * @param props Heading copy, latest label, and optional landing href.
 * @returns Section heading row.
 */
function UsBandHeading({
  title,
  latestLabel,
  href,
}: {
  title: string
  latestLabel: string
  href: string | null
}): JSX.Element {
  const latestClassName = 'text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500'

  return (
    <div className="mb-5 flex items-end justify-between border-b-2 border-neutral-950 pb-2">
      <h2 className="text-2xl font-normal tracking-tight text-neutral-950">
        {href ? (
          <ArchiveSectionLink href={href} className="hover:underline">
            {title}
          </ArchiveSectionLink>
        ) : (
          title
        )}
      </h2>
      {href ? (
        <ArchiveSectionLink href={href} className={`${latestClassName} hover:underline`}>
          {latestLabel}
        </ArchiveSectionLink>
      ) : (
        <span className={latestClassName}>{latestLabel}</span>
      )}
    </div>
  )
}

function UsPictureNewsScreen({ article }: { article: IArticle }): JSX.Element {
  const imgSrc = articleImageSrc(article)

  return (
    <PlacementOverlay article={article} editorDroppable>
      <article className="group">
        <EditorialArticleLink article={article} className="block">
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
        </EditorialArticleLink>
      </article>
    </PlacementOverlay>
  )
}

/** US featured-band square ad unit. */
function UsBandAdScreen(): JSX.Element | null {
  const { shouldRender, variantFor } = usePageAds()
  if (!shouldRender('us_band')) {
    return null
  }
  return (
    <div className="overflow-hidden border border-neutral-200">
      <AdSlot
        slotKey="homepage-us-band"
        variant={variantFor('us_band', 'square')}
        className="rounded-none border-0"
      />
    </div>
  )
}

function UsSideTextLinks({ articles }: { articles: IArticle[] }): JSX.Element {
  return (
    <ul className="space-y-6 border-t border-neutral-200 pt-8">
      {articles.map((article) => (
          <li key={article.id}>
            <PlacementOverlay article={article} editorDroppable>
              <EditorialArticleLink
                article={article}
                className="group block font-sans text-[17px] font-normal leading-snug text-neutral-950 hover:text-neutral-950 hover:underline"
              >
                <span className="line-clamp-3">{article.title}</span>
              </EditorialArticleLink>
            </PlacementOverlay>
          </li>
        ))}
    </ul>
  )
}

function UsSideStory({ article }: { article: IArticle }): JSX.Element {
  const imgSrc = articleImageSrc(article)

  return (
    <PlacementOverlay article={article} editorDroppable>
      <article className="group">
        <EditorialArticleLink article={article} className="block">
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
        </EditorialArticleLink>
      </article>
    </PlacementOverlay>
  )
}

function UsSpotlightHero({ article }: { article: IArticle }): JSX.Element {
  const imgSrc = articleImageSrc(article)

  return (
    <PlacementOverlay article={article} editorDroppable>
      <article className="group">
        <EditorialArticleLink article={article} className="block">
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
        </EditorialArticleLink>
      </article>
    </PlacementOverlay>
  )
}
