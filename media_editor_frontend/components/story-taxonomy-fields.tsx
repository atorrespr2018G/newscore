'use client'

import type { IMediaStory } from '@/lib/media-editor-client'
import { FLORIDA_COUNTY_OPTIONS, FLORIDA_STATE_CODE } from '@/lib/taxonomy/florida-counties'
import { PUERTO_RICO_TOWN_OPTIONS } from '@/lib/taxonomy/puerto-rico-towns'
import {
  INTERNATIONAL_POTENTIAL_OPTIONS,
  MARKET_OPTIONS,
  ROOT_CATEGORY_OPTIONS,
  SPORT_CATEGORY_OPTIONS,
  BUSINESS_CATEGORY_OPTIONS,
  GOVERNMENT_CATEGORY_OPTIONS,
  SPORTS_CATEGORY_SLUG,
  BUSINESS_CATEGORY_SLUG,
  GOVERNMENT_CATEGORY_SLUG,
  marketHasCounty,
  marketHasLocality,
  storyRegionCode,
  type MarketCode,
} from '@/lib/taxonomy/story-taxonomy'
import { US_MARKET_CODE, US_STATE_OPTIONS } from '@/lib/taxonomy/us-states'

interface IStoryTaxonomyFieldsProps {
  story: IMediaStory
  onPatch: (partial: Partial<IMediaStory>) => void
  /** Toggle one category slug on/off from the latest story state. */
  onToggleCategory: (slug: string) => void
}

interface ICategoryChipProps {
  label: string
  checked: boolean
  onToggle: () => void
}

interface ILocationFieldsProps {
  story: IMediaStory
  onPatch: (partial: Partial<IMediaStory>) => void
}

interface ICategoryFieldsProps {
  categorySlugs: string[]
  onToggleCategory: (slug: string) => void
}

/**
 * One selectable category chip — click to turn on, click again to turn off.
 * @param props - Label, checked state, and toggle handler.
 * @returns Accessible toggle button styled as a chip.
 */
function CategoryChip({ label, checked, onToggle }: ICategoryChipProps): JSX.Element {
  return (
    <button
      type="button"
      aria-pressed={checked}
      onClick={onToggle}
      className={[
        'rounded-lg border px-2.5 py-1 text-xs font-medium transition',
        checked
          ? 'border-brand bg-brand text-white'
          : 'border-brand-line bg-white text-slate-700 hover:border-slate-300',
      ].join(' ')}
    >
      {label}
    </button>
  )
}

/**
 * Country / state / town / county cascade matching the reporter desk.
 * @param props - Story location values and patch helper.
 * @returns Location fieldset.
 */
function LocationFields({ story, onPatch }: ILocationFieldsProps): JSX.Element {
  const marketCode = story.market_code
  const showLocality = marketHasLocality(marketCode)
  const showCounty = marketHasCounty(marketCode, story.town_id)
  return (
    <fieldset className="rounded-xl border border-brand-line bg-brand-paper/70 p-4">
      <legend className="px-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
        Story location
      </legend>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-xs font-medium text-slate-700">
          Country
          <select
            className="me-input mt-1"
            value={marketCode}
            onChange={(event) =>
              onPatch({
                market_code: event.target.value as MarketCode,
                town_id: null,
                county_id: null,
              })
            }
          >
            {MARKET_OPTIONS.map((market) => (
              <option key={market.code} value={market.code}>
                {market.label}
              </option>
            ))}
          </select>
        </label>
        {showLocality ? (
          <LocalitySelect story={story} onPatch={onPatch} />
        ) : null}
        {showCounty ? (
          <label className="text-xs font-medium text-slate-700">
            County
            <select
              className="me-input mt-1"
              value={story.county_id ?? ''}
              onChange={(event) => onPatch({ county_id: event.target.value || null })}
            >
              <option value="">County</option>
              {FLORIDA_COUNTY_OPTIONS.map((county) => (
                <option key={county.code} value={county.code}>
                  {county.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
    </fieldset>
  )
}

/**
 * State (US) or town (PR) selector under the active country.
 * @param props - Story location values and patch helper.
 * @returns Locality select control.
 */
function LocalitySelect({ story, onPatch }: ILocationFieldsProps): JSX.Element {
  const marketCode = story.market_code
  const options = marketCode === US_MARKET_CODE ? US_STATE_OPTIONS : PUERTO_RICO_TOWN_OPTIONS
  return (
    <label className="text-xs font-medium text-slate-700">
      {marketCode === US_MARKET_CODE ? 'State' : 'Town'}
      <select
        className="me-input mt-1"
        value={story.town_id ?? ''}
        onChange={(event) => {
          const townId = event.target.value || null
          onPatch({
            town_id: townId,
            county_id:
              marketCode === US_MARKET_CODE && townId === FLORIDA_STATE_CODE
                ? story.county_id
                : null,
          })
        }}
      >
        <option value="">{marketCode === US_MARKET_CODE ? 'USA' : 'Puerto Rico'}</option>
        {options.map((option) => (
          <option key={option.code} value={option.code}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

/**
 * Category chips — root sections are independent; sport chips appear only when
 * Sports is selected, and Economía beats appear only when Economy is selected.
 * @param props - Selected slugs and per-slug toggle handler.
 * @returns Categories fieldset.
 */
function CategoryFields({ categorySlugs, onToggleCategory }: ICategoryFieldsProps): JSX.Element {
  const selectedCount = categorySlugs.length
  const sportsSelected = categorySlugs.includes(SPORTS_CATEGORY_SLUG)
  const businessSelected = categorySlugs.includes(BUSINESS_CATEGORY_SLUG)
  const governmentSelected = categorySlugs.includes(GOVERNMENT_CATEGORY_SLUG)
  return (
    <fieldset>
      <legend className="text-sm font-medium text-slate-700">Categories</legend>
      <p className="mt-1 text-xs text-slate-500">
        Click a category to turn it on or off
        {selectedCount > 0 ? ` · selected ${selectedCount}` : ''}
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {ROOT_CATEGORY_OPTIONS.map((category) => (
          <CategoryChip
            key={category.slug}
            label={category.label}
            checked={categorySlugs.includes(category.slug)}
            onToggle={() => onToggleCategory(category.slug)}
          />
        ))}
      </div>
      {sportsSelected ? (
        <div className="mt-3">
          <p className="text-xs font-medium text-slate-600">Sport</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {SPORT_CATEGORY_OPTIONS.map((sport) => (
              <CategoryChip
                key={sport.slug}
                label={sport.label}
                checked={categorySlugs.includes(sport.slug)}
                onToggle={() => onToggleCategory(sport.slug)}
              />
            ))}
          </div>
        </div>
      ) : null}
      {businessSelected ? (
        <div className="mt-3">
          <p className="text-xs font-medium text-slate-600">Beat</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {BUSINESS_CATEGORY_OPTIONS.map((beat) => (
              <CategoryChip
                key={beat.slug}
                label={beat.label}
                checked={categorySlugs.includes(beat.slug)}
                onToggle={() => onToggleCategory(beat.slug)}
              />
            ))}
          </div>
        </div>
      ) : null}
      {governmentSelected ? (
        <div className="mt-3">
          <p className="text-xs font-medium text-slate-600">Topic</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {GOVERNMENT_CATEGORY_OPTIONS.map((topic) => (
              <CategoryChip
                key={topic.slug}
                label={topic.label}
                checked={categorySlugs.includes(topic.slug)}
                onToggle={() => onToggleCategory(topic.slug)}
              />
            ))}
          </div>
        </div>
      ) : null}
    </fieldset>
  )
}

/**
 * Reporter-parity location, category, and international-potential controls.
 * @param props - Active story, patch handler, and independent category toggler.
 * @returns Story location + categories fieldset panel.
 */
export function StoryTaxonomyFields({
  story,
  onPatch,
  onToggleCategory,
}: IStoryTaxonomyFieldsProps): JSX.Element {
  const regionCode = storyRegionCode(story.market_code, story.town_id, story.county_id)
  const alreadySent = Boolean(story.sent_article_id?.trim())

  return (
    <section className="me-panel space-y-5 p-5 md:p-6">
      <div>
        <p className="me-label mb-0">Story placement</p>
        <h2 className="font-serif text-2xl text-brand-ink">Markets & categories</h2>
        <p className="mt-1 text-sm text-slate-500">
          Same options as the reporter desk · region{' '}
          <span className="font-medium text-slate-700">{regionCode}</span>
        </p>
        {alreadySent ? (
          <p className="mt-2 rounded-lg border border-brand-line bg-brand-paper px-3 py-2 text-xs text-slate-600">
            Already sent to Editor — category and location changes stay editable and sync to the
            NewsCore draft.
          </p>
        ) : null}
      </div>
      <LocationFields story={story} onPatch={onPatch} />
      <CategoryFields
        categorySlugs={story.category_slugs}
        onToggleCategory={onToggleCategory}
      />
      <label className="block text-sm font-medium text-slate-700">
        International potential{' '}
        <span className="font-normal text-slate-500">(optional, 1–10)</span>
        <select
          className="me-input mt-1 max-w-xs"
          value={story.international_potential ?? ''}
          onChange={(event) => {
            const raw = event.target.value
            onPatch({ international_potential: raw === '' ? null : Number(raw) })
          }}
        >
          <option value="">Not rated</option>
          {INTERNATIONAL_POTENTIAL_OPTIONS.map((score) => (
            <option key={score} value={score}>
              {score}
            </option>
          ))}
        </select>
      </label>
    </section>
  )
}
