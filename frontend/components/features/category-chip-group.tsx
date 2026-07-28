'use client'

import { useTranslations } from 'next-intl'
import type { Dispatch, SetStateAction } from 'react'
import type { ICategoryOut } from '@/lib/api/category-client'
import { useSectionLabels } from '@/hooks/use-section-labels'
import { useQuery } from '@tanstack/react-query'
import {
  MAX_CATEGORY_COUNT,
  SPORTS_CATEGORY_SLUG,
  findCategoryBySlug,
  toggleCategory,
  toggleRootCategory,
} from '@/lib/helpers/category-selection'
import {
  loadSportSlugs,
  resolveSportSubcategories,
  rootSectionCategories,
} from '@/lib/helpers/sports-category-options'

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
  const sportSlugs = sportsSectionsQuery.data ?? []
  const sportsParent = findCategoryBySlug(categories, SPORTS_CATEGORY_SLUG)
  const sportsSelected = sportsParent != null && selectedCategoryIds.includes(sportsParent.id)
  const sportsChildren = resolveSportSubcategories(categories, sportSlugs)
  const roots = rootSectionCategories(categories, sportSlugs)
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
                          : [],
                      ),
                    )
                  }
                />
              )
            })}
          </div>
          {sportsSelected ? (
            <div>
              <p className="text-xs font-medium text-neutral-600">
                {t(`${messagePrefix}.sportSubcategory`)}
              </p>
              {sportsChildren.length > 0 ? (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {sportsChildren.map((category) => {
                    const checked = selectedCategoryIds.includes(category.id)
                    const disabled = !checked && atLimit
                    return (
                      <CategoryChip
                        key={category.id}
                        label={categoryLabel(category.slug, category.name)}
                        checked={checked}
                        disabled={disabled}
                        onToggle={() =>
                          setSelectedCategoryIds((current) => toggleCategory(current, category.id))
                        }
                      />
                    )
                  })}
                </div>
              ) : (
                <p className="mt-1.5 text-xs text-neutral-500">
                  {sportsSectionsQuery.isLoading
                    ? t(`${messagePrefix}.loadingCategories`)
                    : t(`${messagePrefix}.sportSubcategoryEmpty`)}
                </p>
              )}
            </div>
          ) : null}
        </div>
      ) : (
        <p className="mt-2 text-sm text-neutral-500">{t(`${messagePrefix}.loadingCategories`)}</p>
      )}
    </fieldset>
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
