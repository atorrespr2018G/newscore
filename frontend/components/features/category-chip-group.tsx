'use client'

import { useTranslations } from 'next-intl'
import type { Dispatch, SetStateAction } from 'react'
import type { ICategoryOut } from '@/lib/api/category-client'
import { useSectionLabels } from '@/hooks/use-section-labels'
import { useQuery } from '@tanstack/react-query'
import {
  MAX_CATEGORY_COUNT,
  SPORTS_CATEGORY_SLUG,
  WORLD_CATEGORY_SLUG,
  findCategoryBySlug,
  toggleCategory,
  toggleRootCategory,
} from '@/lib/helpers/category-selection'
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
  const sportSlugs = sportsSectionsQuery.data ?? []
  const worldRegionSlugs = worldSectionsQuery.data ?? []
  const sportsParent = findCategoryBySlug(categories, SPORTS_CATEGORY_SLUG)
  const worldParent = findCategoryBySlug(categories, WORLD_CATEGORY_SLUG)
  const sportsSelected = sportsParent != null && selectedCategoryIds.includes(sportsParent.id)
  const worldSelected = worldParent != null && selectedCategoryIds.includes(worldParent.id)
  const sportsChildren = resolveSportSubcategories(categories, sportSlugs)
  const worldChildren = resolveWorldRegionSubcategories(categories, worldRegionSlugs)
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
                        sportsParent && category.id === sportsParent.id
                          ? sportsChildren.map((sport) => sport.id)
                          : worldParent && category.id === worldParent.id
                            ? worldChildren.map((region) => region.id)
                            : [],
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
