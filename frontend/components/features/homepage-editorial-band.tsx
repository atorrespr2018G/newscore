'use client'

import type { IArticle } from '@/interfaces/article'
import type { IFeedSlot } from '@/interfaces/feed'
import { EditorialArticleLink } from '@/components/ui/editorial-article-link'
import { ArchiveSectionLink } from '@/components/ui/archive-section-link'
import { HomepageStoryThumb } from '@/components/ui/homepage-story-thumb'
import {
  COMPACT_SIDE_THUMB_HEIGHT,
  COMPACT_SIDE_THUMB_WIDTH,
} from '@/components/ui/story-card'
import { HomepageStoryCard } from '@/components/ui/homepage-story-card'
import { PlacementSlotScope } from '@/context/editor-placement-context'
import { PlacementOverlay, PlacementSectionDropZone } from '@/components/features/placement-overlay'
import { useSectionLabels } from '@/hooks/use-section-labels'
import {
  EDITORIAL_LEAD_IMAGE_COUNT,
  isMoreTopStoriesPositionKey,
  MORE_TOP_STORIES_PINNED_LIMIT,
  splitEditorialColumnArticles,
} from '@/lib/helpers/feed-layout'
import { sectionAnchorId } from '@/lib/helpers/section-labels'
import { politicsArchiveHref } from '@/lib/helpers/politics-archive'
import { worldArchiveHref } from '@/lib/helpers/world-archive'
import { useTranslations } from 'next-intl'
import { AdSlot } from '@/components/ui/ad-slot'
import { usePageAds } from '@/context/page-ads-context'

export const MORE_TOP_STORIES_KEY = 'more-top-stories'

const POLITICS_PAGE_NAME = 'politics'
const COMPACT_SIDE_THUMB_ENLARGE_SCALE = 1.2
const POLITICS_COMPACT_NEWS_SCREEN_SCALE = 1.5
const COMPACT_SIDE_THUMB_WIDTH_ENLARGED = Math.round(
  COMPACT_SIDE_THUMB_WIDTH * COMPACT_SIDE_THUMB_ENLARGE_SCALE,
)

interface ICompactNewsScreenThumbSize {
  width: number
  height?: number
}

/**
 * Compact side-thumb size for editorial-column news screens.
 *
 * Politics Congress, Elections, and White House thumbs are 50% larger than
 * the default enlarged editorial thumbs.
 *
 * @param pageName Layout page name such as `politics`.
 * @returns Width and optional height for compact news-screen thumbs.
 */
function compactNewsScreenThumbSize(pageName?: string): ICompactNewsScreenThumbSize {
  if (pageName?.trim().toLowerCase() === POLITICS_PAGE_NAME) {
    return {
      width: Math.round(COMPACT_SIDE_THUMB_WIDTH_ENLARGED * POLITICS_COMPACT_NEWS_SCREEN_SCALE),
      height: Math.round(COMPACT_SIDE_THUMB_HEIGHT * POLITICS_COMPACT_NEWS_SCREEN_SCALE),
    }
  }

  return { width: COMPACT_SIDE_THUMB_WIDTH_ENLARGED }
}

/**
 * Archive href for an editorial-column heading on World or Politics.
 *
 * @param pageName Layout page name such as `world` or `politics`.
 * @param positionKey Slot position key such as `more-top-stories`.
 * @returns Nested archive path, or null when the heading should stay plain.
 */
function editorialColumnArchiveHref(
  pageName: string | undefined,
  positionKey: string,
): string | null {
  return (
    worldArchiveHref(pageName, positionKey) ??
    politicsArchiveHref(pageName, positionKey)
  )
}

interface IHomepageEditorialBandProps {
  moreTopStoriesSlot: IFeedSlot
  spotlightSlot: IFeedSlot
  rightRailSlot?: IFeedSlot
  /** Layout page name for page-specific section labels (e.g. world). */
  pageName?: string
  /** Omit text-only headline links in the lead column (e.g. World USA/Canada). */
  hideLeadHeadlineLinks?: boolean
  /** Picture story with side thumbnail at the bottom of each editorial column (World regions). */
  showTrailingNewsScreen?: boolean
}

/**
 * CNN-style three-column band below the hero: More Top Stories | spotlight topic | Today rail or ads + stories.
 */
export function HomepageEditorialBand(props: IHomepageEditorialBandProps): JSX.Element | null {
  const { moreTopStoriesSlot, spotlightSlot } = props

  if (moreTopStoriesSlot.articles.length === 0 && spotlightSlot.articles.length === 0) {
    return null
  }

  return (
    <section
      id={sectionAnchorId(moreTopStoriesSlot.positionKey)}
      className="scroll-mt-24 border-t border-neutral-200 pt-10"
    >
      <EditorialBandColumns {...props} />
    </section>
  )
}

/**
 * Render the three editorial band columns from resolved slot data.
 */
function EditorialBandColumns({
  moreTopStoriesSlot,
  spotlightSlot,
  rightRailSlot,
  pageName,
  hideLeadHeadlineLinks = false,
  showTrailingNewsScreen = false,
}: IHomepageEditorialBandProps): JSX.Element {
  const { homepageSectionTitle } = useSectionLabels(pageName)
  const isMoreTopStories = isMoreTopStoriesPositionKey(moreTopStoriesSlot.positionKey)
  const moreArticles = isMoreTopStories
    ? moreTopStoriesSlot.articles.slice(0, MORE_TOP_STORIES_PINNED_LIMIT)
    : moreTopStoriesSlot.articles
  const compactThumb = compactNewsScreenThumbSize(pageName)

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-3 lg:gap-8">
      {moreArticles.length > 0 ? (
        <PlacementSlotScope slotId={moreTopStoriesSlot.id}>
          <div>
            <EditorialColumn
              title={homepageSectionTitle(moreTopStoriesSlot.positionKey, moreTopStoriesSlot.displayName)}
              href={editorialColumnArchiveHref(pageName, moreTopStoriesSlot.positionKey)}
              articles={moreArticles}
              showHeadlineLinks={!hideLeadHeadlineLinks}
              showTrailingNewsScreen={showTrailingNewsScreen}
              maxArticles={isMoreTopStories ? MORE_TOP_STORIES_PINNED_LIMIT : undefined}
              compactThumb={compactThumb}
            />
            <PlacementSectionDropZone />
          </div>
        </PlacementSlotScope>
      ) : null}

      {spotlightSlot.articles.length > 0 ? (
        <PlacementSlotScope slotId={spotlightSlot.id}>
          <div>
            <EditorialColumn
              title={homepageSectionTitle(spotlightSlot.positionKey, spotlightSlot.displayName)}
              href={editorialColumnArchiveHref(pageName, spotlightSlot.positionKey)}
              articles={spotlightSlot.articles}
              showTrailingNewsScreen={showTrailingNewsScreen}
              compactThumb={compactThumb}
            />
            <PlacementSectionDropZone />
          </div>
        </PlacementSlotScope>
      ) : null}

      {rightRailSlot ? (
        <PlacementSlotScope slotId={rightRailSlot.id}>
          <div>
            <RightRailColumn
              title={homepageSectionTitle(rightRailSlot.positionKey, rightRailSlot.displayName)}
              href={editorialColumnArchiveHref(pageName, rightRailSlot.positionKey)}
              positionKey={rightRailSlot.positionKey}
              articles={rightRailSlot.articles}
              showTrailingNewsScreen={showTrailingNewsScreen}
              compactThumb={compactThumb}
            />
            <PlacementSectionDropZone />
          </div>
        </PlacementSlotScope>
      ) : (
        <RightRailColumn
          positionKey={undefined}
          articles={[]}
          showTrailingNewsScreen={showTrailingNewsScreen}
          compactThumb={compactThumb}
        />
      )}
    </div>
  )
}

interface IEditorialColumnProps {
  title: string
  href?: string | null
  articles: IArticle[]
  /** Picture lead stories at the top of the column. Defaults to the editorial lead count. */
  leadImageCount?: number
  showHeadlineLinks?: boolean
  showTrailingNewsScreen?: boolean
  /** Optional article cap before splitting into lead, compact, and headline zones. */
  maxArticles?: number
  /** Side-thumb size for the compact news screens below the lead. */
  compactThumb: ICompactNewsScreenThumbSize
}

const EDITORIAL_STORY_CARD_PROPS = { plainTitle: true } as const

function ColumnHeading({ title, href }: { title: string; href?: string | null }): JSX.Element {
  return (
    <h2 className="border-b-2 border-neutral-950 pb-2 text-xl font-normal tracking-tight text-neutral-950">
      {href ? (
        <ArchiveSectionLink href={href} className="hover:underline">
          {title}
        </ArchiveSectionLink>
      ) : (
        title
      )}
    </h2>
  )
}

function LeadRailCards({ articles }: { articles: IArticle[] }): JSX.Element {
  return (
    <div className="mt-4 space-y-4">
      {articles.map((article) => (
        <HomepageStoryCard key={article.id} article={article} variant="rail" {...EDITORIAL_STORY_CARD_PROPS} />
      ))}
    </div>
  )
}

function CompactSideCards({
  articles,
  compactThumb,
}: {
  articles: IArticle[]
  compactThumb?: ICompactNewsScreenThumbSize
}): JSX.Element {
  return (
    <div className="mt-4 space-y-4">
      {articles.map((article) => (
        <HomepageStoryCard
          key={article.id}
          article={article}
          variant="compact"
          layout="side"
          sideThumbWidth={compactThumb?.width}
          sideThumbHeight={compactThumb?.height}
          {...EDITORIAL_STORY_CARD_PROPS}
        />
      ))}
    </div>
  )
}

function HeadlineList({
  articles,
  className,
  compact = false,
}: {
  articles: IArticle[]
  className: string
  compact?: boolean
}): JSX.Element {
  return (
    <ul className={className}>
      {articles.map((article) => (
        <HomepageStoryCard
          key={article.id}
          article={article}
          variant="headline-only"
          compact={compact}
          {...EDITORIAL_STORY_CARD_PROPS}
        />
      ))}
    </ul>
  )
}

function EditorialColumn({
  title,
  href,
  articles,
  leadImageCount = EDITORIAL_LEAD_IMAGE_COUNT,
  showHeadlineLinks = true,
  showTrailingNewsScreen = false,
  maxArticles,
  compactThumb,
}: IEditorialColumnProps): JSX.Element {
  const { leads, compacts, headlines, trailingArticle } = splitEditorialColumnArticles({
    articles,
    leadImageCount,
    showHeadlineLinks,
    showTrailingNewsScreen,
    maxArticles,
  })

  return (
    <div className="flex flex-col">
      <ColumnHeading title={title} href={href} />
      <LeadRailCards articles={leads} />
      {compacts.length > 0 ? (
        <CompactSideCards articles={compacts} compactThumb={compactThumb} />
      ) : null}
      {showHeadlineLinks && headlines.length > 0 ? (
        <HeadlineList articles={headlines} className="mt-4 divide-y divide-neutral-200" />
      ) : null}
      {trailingArticle ? (
        <CompactSideCards articles={[trailingArticle]} compactThumb={compactThumb} />
      ) : null}
    </div>
  )
}

const RIGHT_RAIL_LEAD_IMAGE_COUNT = 3
const TODAY_RAIL_POSITION_KEY = 'editorial-rail'

function isTodayRailColumn(positionKey: string | undefined): boolean {
  return positionKey?.trim().toLowerCase() === TODAY_RAIL_POSITION_KEY
}

interface IRightRailColumnProps {
  title?: string
  href?: string | null
  positionKey?: string
  articles: IArticle[]
  showTrailingNewsScreen?: boolean
  compactThumb: ICompactNewsScreenThumbSize
}

interface IRightRailSlices {
  featuredArticle: IArticle | undefined
  leads: IArticle[]
  headlines: IArticle[]
  trailingArticle: IArticle | undefined
}

/**
 * Split right-rail articles into the featured screen, lead cards, headlines, and trailing card.
 *
 * @param articles Right-rail slot article list.
 * @param usesNewsScreen Whether the first article renders as a picture "news screen".
 * @param showTrailingNewsScreen Whether the last lead article becomes a trailing card.
 * @returns Featured article plus lead, headline, and trailing zones.
 */
function splitRightRailColumnArticles(
  articles: IArticle[],
  usesNewsScreen: boolean,
  showTrailingNewsScreen: boolean,
): IRightRailSlices {
  const featuredArticle = usesNewsScreen ? articles[0] : undefined
  const railArticles = usesNewsScreen ? articles.slice(1) : articles
  const hasTrailing = showTrailingNewsScreen && railArticles.length > RIGHT_RAIL_LEAD_IMAGE_COUNT
  const railPool = hasTrailing ? railArticles.slice(0, -1) : railArticles

  return {
    featuredArticle,
    leads: railPool.slice(0, RIGHT_RAIL_LEAD_IMAGE_COUNT),
    headlines: railPool.slice(RIGHT_RAIL_LEAD_IMAGE_COUNT),
    trailingArticle: hasTrailing ? railArticles[railArticles.length - 1] : undefined,
  }
}

function RightRailTop({
  usesNewsScreen,
  featuredArticle,
  hasTitle,
}: {
  usesNewsScreen: boolean
  featuredArticle: IArticle | undefined
  hasTitle: boolean
}): JSX.Element | null {
  if (usesNewsScreen) {
    if (!featuredArticle) {
      return null
    }
    return (
      <div className={hasTitle ? 'mt-4' : undefined}>
        <TodayFeaturedNewsScreen article={featuredArticle} />
      </div>
    )
  }

  return <EditorialBandAds hasTitle={hasTitle} />
}

/**
 * Config-gated editorial-band ad units.
 */
function EditorialBandAds({ hasTitle }: { hasTitle: boolean }): JSX.Element | null {
  const { shouldRender, variantFor } = usePageAds()
  if (!shouldRender('editorial_band')) {
    return null
  }
  const variant = variantFor('editorial_band', 'ribbon')
  return (
    <div className={hasTitle ? 'mt-4 space-y-4' : 'space-y-4'}>
      <AdSlot
        slotKey="homepage-editorial-band"
        index={0}
        variant={variant}
        className="!min-h-[120px]"
      />
      <AdSlot slotKey="homepage-editorial-band" index={1} variant="tall" />
    </div>
  )
}

function RightRailColumn({
  title,
  href,
  positionKey,
  articles,
  showTrailingNewsScreen = false,
  compactThumb,
}: IRightRailColumnProps): JSX.Element {
  const tHome = useTranslations('home')
  const sponsoredAndFeaturedLabel = tHome('editorialBand.sponsoredAndFeatured')
  const usesNewsScreen = isTodayRailColumn(positionKey)
  const { featuredArticle, leads, headlines, trailingArticle } = splitRightRailColumnArticles(
    articles,
    usesNewsScreen,
    showTrailingNewsScreen,
  )
  const sideThumb = usesNewsScreen ? compactThumb : undefined

  return (
    <div className="flex flex-col" aria-label={title ?? sponsoredAndFeaturedLabel}>
      {title ? <ColumnHeading title={title} href={href} /> : null}
      <RightRailTop usesNewsScreen={usesNewsScreen} featuredArticle={featuredArticle} hasTitle={Boolean(title)} />
      {usesNewsScreen && headlines.length > 0 ? (
        <HeadlineList articles={headlines} className="mt-4 divide-y divide-neutral-200" compact />
      ) : null}
      {leads.length > 0 ? <CompactSideCards articles={leads} compactThumb={sideThumb} /> : null}
      {!usesNewsScreen && headlines.length > 0 ? (
        <HeadlineList articles={headlines} className="mt-4 space-y-3" compact />
      ) : null}
      {trailingArticle ? <CompactSideCards articles={[trailingArticle]} compactThumb={sideThumb} /> : null}
    </div>
  )
}

function TodayFeaturedNewsScreen({ article }: { article: IArticle }): JSX.Element {
  return (
    <PlacementOverlay article={article}>
      <article className="group">
        <EditorialArticleLink article={article} className="block" ariaLabel={article.title}>
          <HomepageStoryThumb article={article} />
        </EditorialArticleLink>
      </article>
    </PlacementOverlay>
  )
}

