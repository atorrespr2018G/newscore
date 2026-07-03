'use client'

import type { ReactNode } from 'react'

interface ILoadingStateProps {
  /** Localized loading message shown to the user. */
  message: string
}

/**
 * Shared loading indicator for feed and article pages.
 *
 * @param props.message Localized loading copy.
 * @returns Centered loading text.
 */
export function LoadingState({ message }: ILoadingStateProps): JSX.Element {
  return <div className="text-neutral-600">{message}</div>
}

interface IErrorStateProps {
  /** Localized error message shown to the user. */
  message: string
}

/**
 * Shared error banner for failed feed and article loads.
 *
 * @param props.message Localized error copy.
 * @returns Error text styled for visibility.
 */
export function ErrorState({ message }: IErrorStateProps): JSX.Element {
  return <div className="text-red-700">{message}</div>
}

interface IEmptyStateProps {
  /** Rich or plain localized empty-state content. */
  children: ReactNode
}

/**
 * Shared empty-state wrapper for pages with no content yet.
 *
 * @param props.children Localized empty-state body.
 * @returns Neutral empty-state container.
 */
export function EmptyState({ children }: IEmptyStateProps): JSX.Element {
  return <div className="text-neutral-600">{children}</div>
}

/**
 * Skeleton placeholder for homepage and section feed blocks.
 *
 * @returns Pulsing block placeholder.
 */
export function SectionSkeleton(): JSX.Element {
  return <div className="h-32 animate-pulse rounded border border-neutral-200 bg-neutral-100" />
}
