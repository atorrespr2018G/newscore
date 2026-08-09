'use client'

import type { IMediaStory } from '@/lib/media-editor-client'
import { FLORIDA_COUNTY_OPTIONS, FLORIDA_STATE_CODE } from '@/lib/taxonomy/florida-counties'
import { PUERTO_RICO_TOWN_OPTIONS } from '@/lib/taxonomy/puerto-rico-towns'
import {
  INTERNATIONAL_POTENTIAL_OPTIONS,
  MARKET_OPTIONS,
  MAX_CATEGORY_COUNT,
  ROOT_CATEGORY_OPTIONS,
  SPORT_CATEGORY_OPTIONS,
  SPORTS_CATEGORY_SLUG,
  marketHasCounty,
  marketHasLocality,
  storyRegionCode,
  toggleCategorySlug,
  toggleRootCategorySlug,
  type MarketCode,
} from '@/lib/taxonomy/story-taxonomy'
import { US_MARKET_CODE, US_STATE_OPTIONS } from '@/lib/taxonomy/us-states'

interface IStoryTaxonomyFieldsProps {
  story: IMediaStory
  onPatch: (partial: Partial<IMediaStory>) => void
}

interface ICategoryChipProps {
  label: string
  checked: boolean
  disabled: boolean
  onToggle: () => void
}

interface ILocationFieldsProps {
  story: IMediaStory
  onPatch: (partial: Partial<IMediaStory>) => void
}

interface ICategoryFieldsProps {
  categorySlugs: string[]
  onPatch: (partial: Partial<IMediaStory>) => void
}

/**
 * One selectable category or sport chip.
 * @param props - Label, checked state, and toggle handler.
 * @returns Accessible toggle button styled as a chip.
 */
function CategoryChip({ label, checked, disabled, onToggle }: ICategoryChipProps): JSX.Element {
  return (
    <button
      type="button"
      aria-pressed={checked}
      disabled={disabled}
      onClick={onToggle}
      className={[
        'rounded-lg border px-2.5 py-1 text-xs font-medium transition',
        checked
          ? 'border-brand bg-brand text-white'
          : 'border-brand-line bg-white text-slate-700 hover:border-slate-300',
        disabled ? 'cursor-not-allowed opacity-40' : '',
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
 * Root category chips plus Sport subcategory when Sports is selected.
 * @param props - Selected slugs and patch helper.
 * @returns Categories fieldset.
 */
function CategoryFields({ categorySlugs, onPatch }: ICategoryFieldsProps): JSX.Element {
  const sportsSelected = categorySlugs.includes(SPORTS_CATEGORY_SLUG)
  const atLimit = categorySlugs.length >= MAX_CATEGORY_COUNT
  return (
    <fieldset>
      <legend className="text-sm font-medium text-slate-700">
        Categories <span className="font-normal text-slate-500">(choose 1–3)</span>
      </legend>
      <p className="mt-1 text-xs text-slate-500">
        Selected {categorySlugs.length}/{MAX_CATEGORY_COUNT}
        {atLimit ? ' · uncheck one to pick another' : ''}
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {ROOT_CATEGORY_OPTIONS.map((category) => {
          const checked = categorySlugs.includes(category.slug)
          return (
            <CategoryChip
              key={category.slug}
              label={category.label}
              checked={checked}
              disabled={!checked && atLimit}
              onToggle={() =>
                onPatch({ category_slugs: toggleRootCategorySlug(categorySlugs, category.slug) })
              }
            />
          )
        })}
      </div>
      {sportsSelected ? (
        <div className="mt-3">
          <p className="text-xs font-medium text-slate-600">Sport</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {SPORT_CATEGORY_OPTIONS.map((sport) => {
              const checked = categorySlugs.includes(sport.slug)
              return (
                <CategoryChip
                  key={sport.slug}
                  label={sport.label}
                  checked={checked}
                  disabled={!checked && atLimit}
                  onToggle={() =>
                    onPatch({ category_slugs: toggleCategorySlug(categorySlugs, sport.slug) })
                  }
                />
              )
            })}
          </div>
        </div>
      ) : null}
    </fieldset>
  )
}

/**
 * Reporter-parity location, category, and international-potential controls.
 * @param props - Active story and patch handler that merges against latest state.
 * @returns Story location + categories fieldset panel.
 */
export function StoryTaxonomyFields({ story, onPatch }: IStoryTaxonomyFieldsProps): JSX.Element {
  const regionCode = storyRegionCode(story.market_code, story.town_id, story.county_id)

  return (
    <section className="me-panel space-y-5 p-5 md:p-6">
      <div>
        <p className="me-label mb-0">Story placement</p>
        <h2 className="font-serif text-2xl text-brand-ink">Markets & categories</h2>
        <p className="mt-1 text-sm text-slate-500">
          Same options as the reporter desk · region{' '}
          <span className="font-medium text-slate-700">{regionCode}</span>
        </p>
      </div>
      <LocationFields story={story} onPatch={onPatch} />
      <CategoryFields categorySlugs={story.category_slugs} onPatch={onPatch} />
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
