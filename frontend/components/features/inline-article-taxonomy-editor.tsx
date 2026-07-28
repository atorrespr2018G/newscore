'use client'

import { useTranslations } from 'next-intl'
import type { Dispatch, SetStateAction } from 'react'
import type { ICategoryOut } from '@/lib/api/category-client'
import { CategoryChipGroup } from '@/components/features/category-chip-group'
import { INTERNATIONAL_POTENTIAL_OPTIONS } from '@/lib/helpers/category-selection'

interface IInlineArticleTaxonomyEditorProps {
  categories: ICategoryOut[]
  selectedCategoryIds: string[]
  setSelectedCategoryIds: Dispatch<SetStateAction<string[]>>
  internationalPotential: number | null
  setInternationalPotential: Dispatch<SetStateAction<number | null>>
}

/**
 * Category and international-potential controls for a selected story.
 *
 * Save is owned by the consolidated inline editor that hosts this component,
 * so a single action persists taxonomy and media changes together.
 *
 * @param props Category options and selection state.
 * @returns The taxonomy editing controls.
 */
export function InlineArticleTaxonomyEditor({
  categories,
  selectedCategoryIds,
  setSelectedCategoryIds,
  internationalPotential,
  setInternationalPotential,
}: IInlineArticleTaxonomyEditorProps): JSX.Element {
  return (
    <div className="space-y-4">
      <CategoryChipGroup
        categories={categories}
        selectedCategoryIds={selectedCategoryIds}
        setSelectedCategoryIds={setSelectedCategoryIds}
        messagePrefix="editor.taxonomy"
      />
      <EditorInternationalPotentialSelect
        internationalPotential={internationalPotential}
        setInternationalPotential={setInternationalPotential}
      />
    </div>
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
