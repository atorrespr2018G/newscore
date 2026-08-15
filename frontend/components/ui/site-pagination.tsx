'use client'

import Link from 'next/link'
import {
  buildPageTokens,
  PAGINATION_ELLIPSIS,
  totalPagesFor,
  type PaginationTokenType,
} from '@/lib/helpers/pagination'
import { archivePageHref } from '@/lib/helpers/sport-archive'

interface ISitePaginationProps {
  page: number
  pageSize: number
  total: number
  basePath: string
  previousLabel: string
  nextLabel: string
  navLabel: string
  goToPageLabel: (page: number) => string
}

const PAGE_LINK_CLASS =
  'inline-flex h-9 min-w-9 items-center justify-center rounded-md px-2 text-sm font-medium transition-colors'
const INACTIVE_PAGE_CLASS = `${PAGE_LINK_CLASS} text-neutral-700 hover:bg-neutral-100`
const CURRENT_PAGE_CLASS = `${PAGE_LINK_CLASS} bg-[color:var(--brand-red)] text-white`
const NEXT_LINK_CLASS =
  'inline-flex items-center gap-1 rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-800 hover:bg-neutral-50'

interface IPaginationNumberProps {
  token: Exclude<PaginationTokenType, typeof PAGINATION_ELLIPSIS>
  currentPage: number
  href: string
  label: string
}

/**
 * Numbered page link for public archive pagination.
 *
 * @param props Page token, current page, href, and accessible label.
 * @returns A page number link or current-page marker.
 */
function PaginationNumber({ token, currentPage, href, label }: IPaginationNumberProps): JSX.Element {
  if (token === currentPage) {
    return (
      <span aria-current="page" className={CURRENT_PAGE_CLASS}>
        {token}
      </span>
    )
  }
  return (
    <Link href={href} aria-label={label} className={INACTIVE_PAGE_CLASS}>
      {token}
    </Link>
  )
}

interface IPaginationTokenListProps {
  tokens: PaginationTokenType[]
  currentPage: number
  hrefForPage: (page: number) => string
  goToPageLabel: (page: number) => string
}

/**
 * Render numbered tokens and ellipsis gaps for archive pagination.
 *
 * @param props Token list and href/label builders.
 * @returns Ordered list of page controls.
 */
function PaginationTokenList({
  tokens,
  currentPage,
  hrefForPage,
  goToPageLabel,
}: IPaginationTokenListProps): JSX.Element {
  return (
    <ol className="flex flex-wrap items-center gap-1" role="list">
      {tokens.map((token, index) => {
        if (token === PAGINATION_ELLIPSIS) {
          return (
            <li key={`ellipsis-${index}`} aria-hidden="true">
              <span className="inline-flex min-h-9 min-w-9 items-center justify-center px-1 text-sm text-neutral-400">
                …
              </span>
            </li>
          )
        }
        return (
          <li key={token}>
            <PaginationNumber
              token={token}
              currentPage={currentPage}
              href={hrefForPage(token)}
              label={goToPageLabel(token)}
            />
          </li>
        )
      })}
    </ol>
  )
}

/**
 * Public, link-based pagination for category archives (SEO-friendly `?page=`).
 *
 * @param props Current page, totals, base path, and localized labels.
 * @returns Pagination nav, or null when there is only one page.
 */
export function SitePagination({
  page,
  pageSize,
  total,
  basePath,
  previousLabel,
  nextLabel,
  navLabel,
  goToPageLabel,
}: ISitePaginationProps): JSX.Element | null {
  const totalPages = totalPagesFor(total, pageSize)
  if (total <= 0 || totalPages <= 1) {
    return null
  }

  const hrefForPage = (nextPage: number): string => archivePageHref(basePath, nextPage)

  return (
    <nav className="mb-6 mt-10 flex flex-wrap items-center justify-center gap-2" aria-label={navLabel}>
      {page > 1 ? (
        <Link href={hrefForPage(page - 1)} className={NEXT_LINK_CLASS}>
          {previousLabel}
        </Link>
      ) : null}
      <PaginationTokenList
        tokens={buildPageTokens(page, totalPages)}
        currentPage={page}
        hrefForPage={hrefForPage}
        goToPageLabel={goToPageLabel}
      />
      {page < totalPages ? (
        <Link href={hrefForPage(page + 1)} className={NEXT_LINK_CLASS}>
          {nextLabel}
        </Link>
      ) : null}
    </nav>
  )
}
