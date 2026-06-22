'use client'

import { useTranslations } from 'next-intl'
import type { Dispatch, SetStateAction } from 'react'
import type { ICategoryOut } from '@/lib/api/category-client'
import { useSectionLabels } from '@/hooks/use-section-labels'
import {
  INTERNATIONAL_POTENTIAL_OPTIONS,
  MAX_CATEGORY_COUNT,
  toggleCategory,
} from '@/lib/helpers/category-selection'

interface IInlineArticleTaxonomyEditorProps {
  categories: ICategoryOut[]
  selectedCategoryIds: string[]
  setSelectedCategoryIds: Dispatch<SetStateAction<string[]>>
  internationalPotential: number | null
  setInternationalPotential: Dispatch<SetStateAction<number | null>>
  saving: boolean
  onSave: () => void
}

/**
 * Inline editor revealed under a selected story card for tagging categories
 * and the optional international potential score.
 *
 * @param props Category options, selection state, and the save callback.
 * @returns The inline taxonomy editing panel.
 */
export function InlineArticleTaxonomyEditor({
  categories,
  selectedCategoryIds,
  setSelectedCategoryIds,
  internationalPotential,
  setInternationalPotential,
  saving,
  onSave,
}: IInlineArticleTaxonomyEditorProps): JSX.Element {
  const t = useTranslations('admin')
  return (
    <div className="space-y-4 border-t border-neutral-100 bg-neutral-50 p-3">
      <EditorCategorySelector
        categories={categories}
        selectedCategoryIds={selectedCategoryIds}
        setSelectedCategoryIds={setSelectedCategoryIds}
      />
      <EditorInternationalPotentialSelect
        internationalPotential={internationalPotential}
        setInternationalPotential={setInternationalPotential}
      />
      <button
        type="button"
        disabled={saving}
        onClick={onSave}
        className="rounded bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand/90 disabled:opacity-60"
      >
        {t('editor.taxonomy.save')}
      </button>
    </div>
  )
}

interface IEditorCategorySelectorProps {
  categories: ICategoryOut[]
  selectedCategoryIds: string[]
  setSelectedCategoryIds: Dispatch<SetStateAction<string[]>>
}

/**
 * Reselectable category chips enforcing the 1–3 section editorial rule.
 *
 * @param props Available categories and the current selection state.
 * @returns The category selection fieldset.
 */
function EditorCategorySelector({
  categories,
  selectedCategoryIds,
  setSelectedCategoryIds,
}: IEditorCategorySelectorProps): JSX.Element {
  const t = useTranslations('admin')
  const { categoryLabel } = useSectionLabels()
  const atLimit = selectedCategoryIds.length >= MAX_CATEGORY_COUNT
  return (
    <fieldset>
      <legend className="text-sm font-medium text-neutral-700">
        {t('editor.taxonomy.categories')}{' '}
        <span className="font-normal text-neutral-500">{t('editor.taxonomy.categoriesHint')}</span>
      </legend>
      <p className="mt-1 text-xs text-neutral-500">
        {t('editor.taxonomy.selectedCount', {
          count: selectedCategoryIds.length,
          max: MAX_CATEGORY_COUNT,
        })}
        {atLimit ? (
          <span className="ml-1 text-neutral-400">{t('editor.taxonomy.uncheckHint')}</span>
        ) : null}
      </p>
      {categories.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {categories.map((category) => {
            const checked = selectedCategoryIds.includes(category.id)
            const disabled = !checked && atLimit
            return (
              <label
                key={category.id}
                className={`flex items-center gap-1.5 rounded border border-neutral-200 px-2 py-1 text-xs ${
                  disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={() =>
                    setSelectedCategoryIds((current) => toggleCategory(current, category.id))
                  }
                />
                <span>{categoryLabel(category.slug, category.name)}</span>
              </label>
            )
          })}
        </div>
      ) : (
        <p className="mt-2 text-sm text-neutral-500">{t('editor.taxonomy.loadingCategories')}</p>
      )}
    </fieldset>
  )
}

interface IEditorInternationalPotentialSelectProps {
  internationalPotential: number | null
  setInternationalPotential: Dispatch<SetStateAction<number | null>>
}

/**
 * Dropdown to reselect the optional 1–10 international potential score.
 *
 * @param props The current score and its setter.
 * @returns The international potential select control.
 */
function EditorInternationalPotentialSelect({
  internationalPotential,
  setInternationalPotential,
}: IEditorInternationalPotentialSelectProps): JSX.Element {
  const t = useTranslations('admin')
  return (
    <label className="block text-sm font-medium text-neutral-700">
      {t('editor.taxonomy.internationalPotential')}
      <span className="font-normal text-neutral-500">
        {' '}
        {t('editor.taxonomy.internationalPotentialHint')}
      </span>
      <select
        value={internationalPotential ?? ''}
        onChange={(event) =>
          setInternationalPotential(event.target.value === '' ? null : Number(event.target.value))
        }
        className="mt-1 block w-32 rounded border border-neutral-300 px-3 py-2"
      >
        <option value="">{t('editor.taxonomy.notRated')}</option>
        {INTERNATIONAL_POTENTIAL_OPTIONS.map((score) => (
          <option key={score} value={score}>
            {score}
          </option>
        ))}
      </select>
    </label>
  )
}
