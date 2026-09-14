'use client'

import { useTranslations } from 'next-intl'
import type { IArticle } from '@/interfaces/article'
import { PlacementOverlay, PlacementSectionDropZone } from '@/components/features/placement-overlay'
import { ArticleLeadMedia } from '@/components/ui/article-lead-media'
import { EditorialArticleLink } from '@/components/ui/editorial-article-link'
import { HomepageStoryCard } from '@/components/ui/homepage-story-card'
import { HeroVideoAdScope } from '@/context/hero-video-ad-context'
import { splitDefaultHeroArticles } from '@/lib/helpers/feed-layout'
import { deckBelowTitle, HOMEPAGE_SIDE_TEXT_CLASS } from '@/lib/helpers/text-helpers'

interface IHeroBlockProps {
  articles: IArticle[]
  /** Arm the centered video ad when a public homepage hero story is opened. */
  enableVideoAd?: boolean
}

/**
 * Dark promo card at the top of the homepage hero right rail.
 *
 * @returns The right-rail promo block.
 */
function RightPromo(): JSX.Element {
  const t = useTranslations('home')
  return (
    <div className="overflow-hidden rounded border border-neutral-200 bg-neutral-950">
      <div className="p-4">
        <div className="inline-flex rounded bg-brand px-2 py-1 text-[10px] font-black tracking-[0.24em] text-white">
          NEWSCORE
        </div>
        <h3 className="mt-3 text-xl font-black leading-tight text-white">{t('rightPromo.title')}</h3>
        <p className="mt-2 text-sm font-semibold text-white/80">{t('rightPromo.subtitle')}</p>
      </div>
      <div className="border-t border-white/10 bg-white/5 p-4">
        <p className="text-sm font-semibold text-white">{t('rightPromo.footer')}</p>
      </div>
    </div>
  )
}

/**
 * Left rail of stacked hero-lead story cards.
 *
 * @param props.articles Stories for the first hero column.
 * @returns The left hero column.
 */
function HeroLeftRail({ articles }: { articles: IArticle[] }): JSX.Element {
  const tHome = useTranslations('home')
  return (
    <aside className="lg:col-span-3">
      <div className="space-y-4">
        {articles.map((article, idx) => (
          <HomepageStoryCard
            key={article.id}
            article={article}
            editorDroppable
            variant="hero-lead"
            kicker={idx === 0 ? tHome('hero.topKicker') : undefined}
            layout="stacked"
            titleFirst={idx === 0}
            showSummary={idx === 0}
            titleClassName={HOMEPAGE_SIDE_TEXT_CLASS}
            summaryClassName={HOMEPAGE_SIDE_TEXT_CLASS}
          />
        ))}
      </div>
    </aside>
  )
}

/**
 * Center hero headline, media, and deck.
 *
 * @param props.hero Lead article for the center column.
 * @returns The center hero story.
 */
function HeroLead({ hero }: { hero: IArticle }): JSX.Element {
  const heroSummary = deckBelowTitle(hero.title, hero.summary, 200)
  return (
    <PlacementOverlay article={hero} editorDroppable>
      <EditorialArticleLink article={hero} className="group block" ariaLabel={hero.title}>
        <h2 className="font-sans text-[34px] font-normal leading-[1.05] tracking-tight text-neutral-950">
          {hero.title}
        </h2>

        <div className="mt-4 overflow-hidden rounded border border-neutral-200 bg-neutral-100">
          <div className="relative aspect-[16/9]">
            <ArticleLeadMedia article={hero} mode="teaser" priority imageSizes="(max-width: 1024px) 100vw, 50vw" />
          </div>
        </div>

        {heroSummary ? (
          <p className="mt-4 font-sans text-sm font-normal leading-relaxed text-neutral-800">
            <span className="line-clamp-3">{heroSummary}</span>
          </p>
        ) : null}
      </EditorialArticleLink>
    </PlacementOverlay>
  )
}

/**
 * Center hero column: lead, related headlines, and compact strip.
 *
 * @param props Hero article plus supporting stories.
 * @returns The center hero column.
 */
function HeroCenter({
  hero,
  relatedLinks,
  strip,
}: {
  hero: IArticle
  relatedLinks: IArticle[]
  strip: IArticle[]
}): JSX.Element {
  return (
    <section className="lg:col-span-6">
      <div className="border-b border-neutral-200 pb-5">
        <HeroLead hero={hero} />
        <HeroRelatedLinks articles={relatedLinks} />
      </div>
      <HeroStrip articles={strip} />
    </section>
  )
}

/**
 * Related headline list under the center hero lead.
 *
 * @param props.articles Related stories.
 * @returns The related-links list, or null when empty.
 */
function HeroRelatedLinks({ articles }: { articles: IArticle[] }): JSX.Element | null {
  if (articles.length === 0) {
    return null
  }
  return (
    <ul className="mt-4 divide-y divide-neutral-200 border-t border-neutral-200 pt-2">
      {articles.map((article) => (
        <HomepageStoryCard
          key={article.id}
          article={article}
          editorDroppable
          variant="headline-only"
        />
      ))}
    </ul>
  )
}

/**
 * Compact three-up strip under the center hero.
 *
 * @param props.articles Strip stories.
 * @returns The compact strip grid.
 */
function HeroStrip({ articles }: { articles: IArticle[] }): JSX.Element {
  return (
    <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
      {articles.map((article) => (
        <HomepageStoryCard
          key={article.id}
          article={article}
          editorDroppable
          variant="compact"
          layout="stacked"
        />
      ))}
    </div>
  )
}

/**
 * Right rail of the homepage hero: promo plus stacked rail cards.
 *
 * @param props.articles Stories for the third hero column.
 * @returns The right hero column.
 */
function HeroRightRail({ articles }: { articles: IArticle[] }): JSX.Element {
  return (
    <aside className="lg:col-span-3">
      <div className="space-y-6">
        <RightPromo />
        <div className="space-y-4">
          {articles.map((article, idx) => (
            <HomepageStoryCard
              key={article.id}
              article={article}
              editorDroppable
              variant="rail"
              titleFirst={idx === 0}
              showSummary={idx === 0}
              titleClassName={HOMEPAGE_SIDE_TEXT_CLASS}
              summaryClassName={HOMEPAGE_SIDE_TEXT_CLASS}
            />
          ))}
        </div>
      </div>
    </aside>
  )
}

/**
 * Three-column hero grid plus editor drop zone.
 *
 * @param props.articles Hero slot articles; the first is the lead.
 * @returns The hero layout.
 * @throws If the articles array has no lead.
 */
function HeroBlockLayout({ articles }: { articles: IArticle[] }): JSX.Element {
  const hero = articles[0]
  if (!hero) {
    throw new Error('HeroBlockLayout requires a lead article')
  }
  const { left, relatedLinks, strip, rightCards } = splitDefaultHeroArticles(articles)
  return (
    <div>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <HeroLeftRail articles={left} />
        <HeroCenter hero={hero} relatedLinks={relatedLinks} strip={strip} />
        <HeroRightRail articles={rightCards} />
      </div>
      <PlacementSectionDropZone />
    </div>
  )
}

/**
 * Homepage hero: left rail, center lead, and right rail.
 *
 * @param props.articles Hero slot articles.
 * @param props.enableVideoAd Arm the centered video ad on the public homepage.
 * @returns Hero layout or an empty drop zone when the slot has no lead.
 */
export function HeroBlock({ articles, enableVideoAd = false }: IHeroBlockProps): JSX.Element {
  if (!articles[0]) {
    return (
      <div className="rounded border border-dashed border-neutral-300 bg-neutral-50 p-4">
        <PlacementSectionDropZone />
      </div>
    )
  }

  const layout = <HeroBlockLayout articles={articles} />
  if (!enableVideoAd) {
    return layout
  }
  return <HeroVideoAdScope>{layout}</HeroVideoAdScope>
}
