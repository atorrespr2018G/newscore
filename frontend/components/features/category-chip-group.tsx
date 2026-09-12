'use client'

import { useTranslations } from 'next-intl'
import type { Dispatch, SetStateAction } from 'react'
import type { ICategoryOut } from '@/lib/api/category-client'
import { useSectionLabels } from '@/hooks/use-section-labels'
import { useQuery } from '@tanstack/react-query'
import {
  MAX_CATEGORY_COUNT,
  BUSINESS_CATEGORY_SLUG,
  GOVERNMENT_CATEGORY_SLUG,
  ENTERTAINMENT_CATEGORY_SLUG,
  HEALTH_CATEGORY_SLUG,
  SPORTS_CATEGORY_SLUG,
  WORLD_CATEGORY_SLUG,
  findCategoryBySlug,
  toggleCategory,
  toggleRootCategory,
} from '@/lib/helpers/category-selection'
import { resolveBusinessSubcategories, loadBusinessTopicSlugs } from '@/lib/helpers/business-category-options'
import {
  loadEntertainmentTopicSlugs,
  resolveEntertainmentSubcategories,
} from '@/lib/helpers/entertainment-category-options'
import {
  loadHealthTopicSlugs,
  resolveHealthSubcategories,
} from '@/lib/helpers/health-category-options'
import {
  loadGovernmentTopicSlugs,
  resolveGovernmentSubcategories,
} from '@/lib/helpers/government-category-options'
import {
  loadSportSlugs,
  resolveSportSubcategories,
  rootSectionCategories,
} from '@/lib/helpers/sports-category-options'
import {
  loadWorldRegionSlugs,
  resolveWorldRegionSubcategories,
} from '@/lib/helpers/world-category-options'

interface ICategoryChipGroupProps {
  categories: ICategoryOut[]
  selectedCategoryIds: string[]
  setSelectedCategoryIds: Dispatch<SetStateAction<string[]>>
  /**
   * Translation namespace prefix for labels.
   * Editor uses `editor.taxonomy`; reporter uses `reporter.fields`.
   */
  messagePrefix: 'editor.taxonomy' | 'reporter.fields'
  /** Market whose Sports list drives the subcategory (defaults to all editor markets). */
  marketCode?: string
}

interface IRootChildIdMap {
  sportsParentId?: string
  sportsChildIds: string[]
  worldParentId?: string
  worldChildIds: string[]
  businessParentId?: string
  businessChildIds: string[]
  governmentParentId?: string
  governmentChildIds: string[]
  entertainmentParentId?: string
  entertainmentChildIds: string[]
  healthParentId?: string
  healthChildIds: string[]
}

/**
 * Child ids to clear when unchecking a parent section chip.
 *
 * @param categoryId Root category being toggled.
 * @param childIds Parent-to-child id map for Sports, World, and Economy.
 * @returns Child ids belonging to that parent, or an empty list.
 */
function extraChildIdsForRoot(categoryId: string, childIds: IRootChildIdMap): string[] {
  if (categoryId === childIds.sportsParentId) {
    return childIds.sportsChildIds
  }
  if (categoryId === childIds.worldParentId) {
    return childIds.worldChildIds
  }
  if (categoryId === childIds.businessParentId) {
    return childIds.businessChildIds
  }
  if (categoryId === childIds.governmentParentId) {
    return childIds.governmentChildIds
  }
  if (categoryId === childIds.entertainmentParentId) {
    return childIds.entertainmentChildIds
  }
  if (categoryId === childIds.healthParentId) {
    return childIds.healthChildIds
  }
  return []
}

/**
 * Section chips with a Sports subcategory list when Sports is selected.
 *
 * @param props Categories, selection state, and message prefix.
 * @returns Hierarchical category picker.
 */
export function CategoryChipGroup({
  categories,
  selectedCategoryIds,
  setSelectedCategoryIds,
  messagePrefix,
  marketCode,
}: ICategoryChipGroupProps): JSX.Element {
  const t = useTranslations('admin')
  const { categoryLabel } = useSectionLabels()
  const sportsSectionsQuery = useQuery({
    queryKey: ['editor', 'sports-page-section-slugs', marketCode ?? 'all'],
    queryFn: () => loadSportSlugs(marketCode),
  })
  const worldSectionsQuery = useQuery({
    queryKey: ['editor', 'world-page-section-slugs', marketCode ?? 'all'],
    queryFn: () => loadWorldRegionSlugs(marketCode),
  })
  const governmentSectionsQuery = useQuery({
    queryKey: ['editor', 'government-page-section-slugs', marketCode ?? 'all'],
    queryFn: () => loadGovernmentTopicSlugs(marketCode),
  })
  const entertainmentSectionsQuery = useQuery({
    queryKey: ['editor', 'entertainment-page-section-slugs', marketCode ?? 'all'],
    queryFn: () => loadEntertainmentTopicSlugs(marketCode),
  })
  const healthSectionsQuery = useQuery({
    queryKey: ['editor', 'health-page-section-slugs', marketCode ?? 'all'],
    queryFn: () => loadHealthTopicSlugs(marketCode),
  })
  const businessSectionsQuery = useQuery({
    queryKey: ['editor', 'business-page-section-slugs', marketCode ?? 'all'],
    queryFn: () => loadBusinessTopicSlugs(marketCode),
  })
  const sportSlugs = sportsSectionsQuery.data ?? []
  const worldRegionSlugs = worldSectionsQuery.data ?? []
  const governmentTopicSlugs = governmentSectionsQuery.data ?? []
  const entertainmentTopicSlugs = entertainmentSectionsQuery.data ?? []
  const healthTopicSlugs = healthSectionsQuery.data ?? []
  const businessTopicSlugs = businessSectionsQuery.data ?? []
  const sportsParent = findCategoryBySlug(categories, SPORTS_CATEGORY_SLUG)
  const worldParent = findCategoryBySlug(categories, WORLD_CATEGORY_SLUG)
  const businessParent = findCategoryBySlug(categories, BUSINESS_CATEGORY_SLUG)
  const governmentParent = findCategoryBySlug(categories, GOVERNMENT_CATEGORY_SLUG)
  const entertainmentParent = findCategoryBySlug(categories, ENTERTAINMENT_CATEGORY_SLUG)
  const healthParent = findCategoryBySlug(categories, HEALTH_CATEGORY_SLUG)
  const sportsSelected = sportsParent != null && selectedCategoryIds.includes(sportsParent.id)
  const worldSelected = worldParent != null && selectedCategoryIds.includes(worldParent.id)
  const businessSelected =
    businessParent != null && selectedCategoryIds.includes(businessParent.id)
  const governmentSelected =
    governmentParent != null && selectedCategoryIds.includes(governmentParent.id)
  const entertainmentSelected =
    entertainmentParent != null && selectedCategoryIds.includes(entertainmentParent.id)
  const healthSelected = healthParent != null && selectedCategoryIds.includes(healthParent.id)
  const sportsChildren = resolveSportSubcategories(categories, sportSlugs)
  const worldChildren = resolveWorldRegionSubcategories(categories, worldRegionSlugs)
  const businessChildren = resolveBusinessSubcategories(categories, businessTopicSlugs)
  const governmentChildren = resolveGovernmentSubcategories(categories, governmentTopicSlugs)
  const entertainmentChildren = resolveEntertainmentSubcategories(
    categories,
    entertainmentTopicSlugs,
  )
  const healthChildren = resolveHealthSubcategories(categories, healthTopicSlugs)
  const roots = rootSectionCategories(categories, sportSlugs, worldRegionSlugs)
  const atLimit = selectedCategoryIds.length >= MAX_CATEGORY_COUNT

  return (
    <fieldset>
      <legend className="text-sm font-medium text-neutral-700">
        {t(`${messagePrefix}.categories`)}{' '}
        <span className="font-normal text-neutral-500">{t(`${messagePrefix}.categoriesHint`)}</span>
      </legend>
      <p className="mt-1 text-xs text-neutral-500">
        {t(`${messagePrefix}.selectedCount`, {
          count: selectedCategoryIds.length,
          max: MAX_CATEGORY_COUNT,
        })}
        {atLimit ? (
          <span className="ml-1 text-neutral-400">{t(`${messagePrefix}.uncheckHint`)}</span>
        ) : null}
      </p>
      {categories.length > 0 ? (
        <div className="mt-2 space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {roots.map((category) => {
              const checked = selectedCategoryIds.includes(category.id)
              const disabled = !checked && atLimit
              return (
                <CategoryChip
                  key={category.id}
                  label={categoryLabel(category.slug, category.name)}
                  checked={checked}
                  disabled={disabled}
                  onToggle={() =>
                    setSelectedCategoryIds((current) =>
                      toggleRootCategory(
                        current,
                        category.id,
                        categories,
                        extraChildIdsForRoot(category.id, {
                          sportsParentId: sportsParent?.id,
                          sportsChildIds: sportsChildren.map((sport) => sport.id),
                          worldParentId: worldParent?.id,
                          worldChildIds: worldChildren.map((region) => region.id),
                          businessParentId: businessParent?.id,
                          businessChildIds: businessChildren.map((beat) => beat.id),
                          governmentParentId: governmentParent?.id,
                          governmentChildIds: governmentChildren.map((topic) => topic.id),
                          entertainmentParentId: entertainmentParent?.id,
                          entertainmentChildIds: entertainmentChildren.map((topic) => topic.id),
                          healthParentId: healthParent?.id,
                          healthChildIds: healthChildren.map((topic) => topic.id),
                        }),
                      ),
                    )
                  }
                />
              )
            })}
          </div>
          {sportsSelected ? (
            <SubcategoryChipRow
              title={t(`${messagePrefix}.sportSubcategory`)}
              categories={sportsChildren}
              selectedCategoryIds={selectedCategoryIds}
              atLimit={atLimit}
              isLoading={sportsSectionsQuery.isLoading}
              emptyLabel={t(`${messagePrefix}.sportSubcategoryEmpty`)}
              loadingLabel={t(`${messagePrefix}.loadingCategories`)}
              categoryLabel={categoryLabel}
              setSelectedCategoryIds={setSelectedCategoryIds}
            />
          ) : null}
          {worldSelected ? (
            <SubcategoryChipRow
              title={t(`${messagePrefix}.worldRegionSubcategory`)}
              categories={worldChildren}
              selectedCategoryIds={selectedCategoryIds}
              atLimit={atLimit}
              isLoading={worldSectionsQuery.isLoading}
              emptyLabel={t(`${messagePrefix}.worldRegionSubcategoryEmpty`)}
              loadingLabel={t(`${messagePrefix}.loadingCategories`)}
              categoryLabel={categoryLabel}
              setSelectedCategoryIds={setSelectedCategoryIds}
            />
          ) : null}
          {businessSelected ? (
            <SubcategoryChipRow
              title={t(`${messagePrefix}.businessBeatSubcategory`)}
              categories={businessChildren}
              selectedCategoryIds={selectedCategoryIds}
              atLimit={atLimit}
              isLoading={false}
              emptyLabel={t(`${messagePrefix}.businessBeatSubcategoryEmpty`)}
              loadingLabel={t(`${messagePrefix}.loadingCategories`)}
              categoryLabel={categoryLabel}
              setSelectedCategoryIds={setSelectedCategoryIds}
            />
          ) : null}
          {governmentSelected ? (
            <SubcategoryChipRow
              title={t(`${messagePrefix}.governmentTopicSubcategory`)}
              categories={governmentChildren}
              selectedCategoryIds={selectedCategoryIds}
              atLimit={atLimit}
              isLoading={governmentSectionsQuery.isLoading}
              emptyLabel={t(`${messagePrefix}.governmentTopicSubcategoryEmpty`)}
              loadingLabel={t(`${messagePrefix}.loadingCategories`)}
              categoryLabel={categoryLabel}
              setSelectedCategoryIds={setSelectedCategoryIds}
            />
          ) : null}
          {entertainmentSelected ? (
            <SubcategoryChipRow
              title={t(`${messagePrefix}.entertainmentTopicSubcategory`)}
              categories={entertainmentChildren}
              selectedCategoryIds={selectedCategoryIds}
              atLimit={atLimit}
              isLoading={entertainmentSectionsQuery.isLoading}
              emptyLabel={t(`${messagePrefix}.entertainmentTopicSubcategoryEmpty`)}
              loadingLabel={t(`${messagePrefix}.loadingCategories`)}
              categoryLabel={categoryLabel}
              setSelectedCategoryIds={setSelectedCategoryIds}
            />
          ) : null}
          {healthSelected ? (
            <SubcategoryChipRow
              title={t(`${messagePrefix}.healthTopicSubcategory`)}
              categories={healthChildren}
              selectedCategoryIds={selectedCategoryIds}
              atLimit={atLimit}
              isLoading={healthSectionsQuery.isLoading}
              emptyLabel={t(`${messagePrefix}.healthTopicSubcategoryEmpty`)}
              loadingLabel={t(`${messagePrefix}.loadingCategories`)}
              categoryLabel={categoryLabel}
              setSelectedCategoryIds={setSelectedCategoryIds}
            />
          ) : null}
        </div>
      ) : (
        <p className="mt-2 text-sm text-neutral-500">{t(`${messagePrefix}.loadingCategories`)}</p>
      )}
    </fieldset>
  )
}

interface ISubcategoryChipRowProps {
  title: string
  categories: ICategoryOut[]
  selectedCategoryIds: string[]
  atLimit: boolean
  isLoading: boolean
  emptyLabel: string
  loadingLabel: string
  categoryLabel: (slug: string, name: string) => string
  setSelectedCategoryIds: Dispatch<SetStateAction<string[]>>
}

/**
 * Nested subcategory chips shown when a parent section such as Sports or World is selected.
 *
 * @param props Subcategory list, selection state, and labels.
 * @returns Subcategory chip row.
 */
function SubcategoryChipRow({
  title,
  categories,
  selectedCategoryIds,
  atLimit,
  isLoading,
  emptyLabel,
  loadingLabel,
  categoryLabel,
  setSelectedCategoryIds,
}: ISubcategoryChipRowProps): JSX.Element {
  return (
    <div>
      <p className="text-xs font-medium text-neutral-600">{title}</p>
      {categories.length > 0 ? (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {categories.map((category) => {
            const checked = selectedCategoryIds.includes(category.id)
            return (
              <CategoryChip
                key={category.id}
                label={categoryLabel(category.slug, category.name)}
                checked={checked}
                disabled={!checked && atLimit}
                onToggle={() =>
                  setSelectedCategoryIds((current) => toggleCategory(current, category.id))
                }
              />
            )
          })}
        </div>
      ) : (
        <p className="mt-1.5 text-xs text-neutral-500">{isLoading ? loadingLabel : emptyLabel}</p>
      )}
    </div>
  )
}

interface ICategoryChipProps {
  label: string
  checked: boolean
  disabled: boolean
  onToggle: () => void
}

/**
 * Single selectable category chip.
 *
 * @param props Chip label and toggle state.
 * @returns Labeled checkbox chip.
 */
function CategoryChip({ label, checked, disabled, onToggle }: ICategoryChipProps): JSX.Element {
  return (
    <label
      className={`flex items-center gap-1.5 rounded border border-neutral-200 px-2 py-1 text-xs ${
        disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'
      }`}
    >
      <input type="checkbox" checked={checked} disabled={disabled} onChange={onToggle} />
      <span>{label}</span>
    </label>
  )
}
