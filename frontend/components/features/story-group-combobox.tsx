'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { IStoryGroupOut } from '@/lib/api/story-group-client'

interface IStoryGroupComboboxProps {
  value: string
  groups: IStoryGroupOut[]
  onChange: (value: string) => void
}

/**
 * Filter story groups by a case-insensitive match on id or sample title.
 *
 * @param groups All available story groups.
 * @param query Trimmed search text typed by the editor.
 * @returns Groups whose id or sample title contains the query.
 */
function filterStoryGroups(groups: IStoryGroupOut[], query: string): IStoryGroupOut[] {
  const normalized = query.trim().toLowerCase()
  if (!normalized) {
    return groups
  }
  return groups.filter(
    (group) =>
      group.id.toLowerCase().includes(normalized) ||
      group.sampleTitle.toLowerCase().includes(normalized),
  )
}

/**
 * Close the dropdown whenever a pointer event lands outside the container.
 *
 * @param ref Container whose outside clicks should close the dropdown.
 * @param onOutside Callback invoked on an outside pointer event.
 */
function useOutsideClose(ref: React.RefObject<HTMLElement>, onOutside: () => void): void {
  useEffect(() => {
    function handlePointerDown(event: PointerEvent): void {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onOutside()
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [ref, onOutside])
}

/**
 * Searchable combobox for assigning an article to a story group.
 *
 * Editors can pick an existing group (showing its representative title and
 * article count) or type a brand-new id to create a group. Clearing the field
 * unassigns the article from any group.
 *
 * @param props Current value, available groups, and the change handler.
 * @returns The story group combobox UI.
 */
export function StoryGroupCombobox(props: IStoryGroupComboboxProps): JSX.Element {
  const { value, groups, onChange } = props
  const t = useTranslations('admin')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  useOutsideClose(containerRef, () => setOpen(false))

  const matches = useMemo(() => filterStoryGroups(groups, value), [groups, value])
  const trimmed = value.trim()
  const showCreate = trimmed.length > 0 && !groups.some((group) => group.id === trimmed)

  /**
   * Apply a chosen or typed group id and close the dropdown.
   *
   * @param nextValue Group id to assign.
   */
  function selectValue(nextValue: string): void {
    onChange(nextValue)
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="mt-1 flex items-center gap-2">
        <input
          type="text"
          value={value}
          onChange={(event) => {
            onChange(event.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder={t('editor.detail.storyGroupSearchPlaceholder')}
          className="w-full rounded border border-neutral-300 px-3 py-2"
        />
        {trimmed.length > 0 ? (
          <button
            type="button"
            onClick={() => selectValue('')}
            className="shrink-0 rounded border border-neutral-300 px-2 py-2 text-xs text-neutral-600 hover:bg-neutral-100"
          >
            {t('editor.detail.storyGroupClear')}
          </button>
        ) : null}
      </div>
      {open ? (
        <StoryGroupOptions
          matches={matches}
          showCreate={showCreate}
          createValue={trimmed}
          onSelect={selectValue}
        />
      ) : null}
    </div>
  )
}

interface IStoryGroupOptionsProps {
  matches: IStoryGroupOut[]
  showCreate: boolean
  createValue: string
  onSelect: (value: string) => void
}

/**
 * Dropdown list of matching groups plus an optional create-new affordance.
 *
 * @param props Matching groups, create-new state, and the select handler.
 * @returns The combobox dropdown, or an empty-state row when nothing matches.
 */
function StoryGroupOptions(props: IStoryGroupOptionsProps): JSX.Element {
  const { matches, showCreate, createValue, onSelect } = props
  const t = useTranslations('admin')

  return (
    <ul
      role="listbox"
      className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded border border-neutral-200 bg-white shadow-lg"
    >
      {matches.length === 0 && !showCreate ? (
        <li className="px-3 py-2 text-sm text-neutral-500">{t('editor.detail.storyGroupNoMatches')}</li>
      ) : null}
      {matches.map((group) => (
        <li key={group.id}>
          <button
            type="button"
            role="option"
            aria-selected={false}
            onClick={() => onSelect(group.id)}
            className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-neutral-50"
          >
            <span className="min-w-0">
              <span className="block truncate font-mono text-xs text-neutral-700">{group.id}</span>
              <span className="block truncate text-xs text-neutral-500">{group.sampleTitle}</span>
            </span>
            <span className="shrink-0 rounded-full bg-brand/10 px-2 py-0.5 text-xs font-semibold text-brand">
              {t('editor.detail.storyGroupArticleCount', { count: group.articleCount })}
            </span>
          </button>
        </li>
      ))}
      {showCreate ? (
        <li className="border-t border-neutral-100">
          <button
            type="button"
            onClick={() => onSelect(createValue)}
            className="w-full px-3 py-2 text-left text-sm text-brand hover:bg-brand/5"
          >
            {t('editor.detail.storyGroupCreateNew', { id: createValue })}
          </button>
        </li>
      ) : null}
    </ul>
  )
}
