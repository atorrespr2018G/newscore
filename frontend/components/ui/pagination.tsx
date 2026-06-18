'use client'

import {
  buildPageTokens,
  pageItemRange,
  PAGINATION_ELLIPSIS,
  totalPagesFor,
} from '@/lib/helpers/pagination'

interface IPaginationProps {
  page: number
  pageSize: number
  total: number
  loading?: boolean
  itemLabel?: string
  pageSizeOptions?: readonly number[]
  onPageChange: (page: number) => void
  onPageSizeChange?: (pageSize: number) => void
}

const NAV_BUTTON_CLASS =
  'inline-flex min-h-9 min-w-9 items-center justify-center rounded border border-neutral-300 px-2.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40'

/**
 * Accessible pagination bar with first/prev/numbered/next/last controls.
 */
export function Pagination({
  page,
  pageSize,
  total,
  loading = false,
  itemLabel = 'items',
  pageSizeOptions,
  onPageChange,
  onPageSizeChange,
}: IPaginationProps): JSX.Element | null {
  const totalPages = totalPagesFor(total, pageSize)
  const { start, end } = pageItemRange(page, pageSize, total)
  const pageTokens = buildPageTokens(page, totalPages)
  const showPageControls = total > 0
  const showPageSizeSelector = Boolean(pageSizeOptions?.length && onPageSizeChange)

  if (!showPageControls && !showPageSizeSelector) {
    return null
  }

  const isDisabled = loading || !showPageControls

  function handlePageChange(nextPage: number) {
    if (loading || nextPage < 1 || nextPage > totalPages || nextPage === page) {
      return
    }
    onPageChange(nextPage)
  }

  function handlePageSizeChange(nextPageSize: number) {
    if (loading || !onPageSizeChange) {
      return
    }
    onPageSizeChange(nextPageSize)
  }

  return (
    <nav
      className="flex flex-col gap-3 border-t border-neutral-200 px-4 py-3 lg:flex-row lg:items-center lg:justify-between"
      aria-label="Pagination"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-neutral-600">
        {pageSizeOptions && pageSizeOptions.length > 0 && onPageSizeChange ? (
          <label className="inline-flex items-center gap-2">
            <span>Show</span>
            <select
              value={pageSize}
              disabled={loading}
              onChange={(event) => handlePageSizeChange(Number(event.target.value))}
              aria-label="Items per page"
              className="rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm font-medium text-neutral-900 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {pageSizeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <span>per page</span>
          </label>
        ) : null}
        <p>
          {start === 0 ? (
            <>No {itemLabel}</>
          ) : (
            <>
              Showing <span className="font-medium text-neutral-900">{start}</span>
              {' – '}
              <span className="font-medium text-neutral-900">{end}</span> of{' '}
              <span className="font-medium text-neutral-900">{total}</span> {itemLabel}
            </>
          )}
        </p>
      </div>

      {showPageControls ? (
        <div className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          aria-label="Go to first page"
          disabled={isDisabled || page <= 1}
          onClick={() => handlePageChange(1)}
          className={NAV_BUTTON_CLASS}
        >
          First
        </button>
        <button
          type="button"
          aria-label="Go to previous page"
          disabled={isDisabled || page <= 1}
          onClick={() => handlePageChange(page - 1)}
          className={NAV_BUTTON_CLASS}
        >
          Prev
        </button>

        <ol className="flex flex-wrap items-center gap-1" role="list">
          {pageTokens.map((token, index) => {
            if (token === PAGINATION_ELLIPSIS) {
              return (
                <li key={`ellipsis-${index}`} aria-hidden="true">
                  <span className="inline-flex min-h-9 min-w-9 items-center justify-center px-1 text-sm text-neutral-400">
                    …
                  </span>
                </li>
              )
            }

            const isCurrent = token === page
            return (
              <li key={token}>
                <button
                  type="button"
                  aria-label={`Go to page ${token}`}
                  aria-current={isCurrent ? 'page' : undefined}
                  disabled={isDisabled}
                  onClick={() => handlePageChange(token)}
                  className={[
                    'inline-flex min-h-9 min-w-9 items-center justify-center rounded border px-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                    isCurrent
                      ? 'border-brand bg-brand text-white'
                      : 'border-neutral-300 text-neutral-700 hover:bg-neutral-50',
                  ].join(' ')}
                >
                  {token}
                </button>
              </li>
            )
          })}
        </ol>

        <button
          type="button"
          aria-label="Go to next page"
          disabled={isDisabled || page >= totalPages}
          onClick={() => handlePageChange(page + 1)}
          className={NAV_BUTTON_CLASS}
        >
          Next
        </button>
        <button
          type="button"
          aria-label="Go to last page"
          disabled={isDisabled || page >= totalPages}
          onClick={() => handlePageChange(totalPages)}
          className={NAV_BUTTON_CLASS}
        >
          Last
        </button>
        </div>
      ) : null}
    </nav>
  )
}
