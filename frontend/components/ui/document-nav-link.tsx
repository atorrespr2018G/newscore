'use client'

import type { MouseEvent, ReactNode } from 'react'

export interface IDocumentNavLinkProps {
  href: string
  className?: string
  children: ReactNode
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void
}

/**
 * Whether the click should keep the browser's default link behavior.
 *
 * Modifier clicks (new tab / new window) must not be hijacked.
 *
 * @param event Anchor click event.
 * @returns True when the browser should handle the click.
 */
function shouldAllowBrowserDefault(event: MouseEvent<HTMLAnchorElement>): boolean {
  return (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.altKey ||
    event.ctrlKey ||
    event.shiftKey
  )
}

/**
 * Site chrome link that uses a real document navigation.
 *
 * Next.js client routing from `/world` and `/sports` can keep those landings
 * mounted, so the NEWSCORE logo and masthead never leave the page. Assigning
 * `window.location` forces the homepage (and other chrome targets) to load.
 *
 * @param props Link href, optional class, and label.
 * @returns Anchor that navigates with a full page load.
 */
export function DocumentNavLink({
  href,
  className,
  children,
  onClick,
}: IDocumentNavLinkProps): JSX.Element {
  function handleClick(event: MouseEvent<HTMLAnchorElement>): void {
    if (shouldAllowBrowserDefault(event)) {
      return
    }
    onClick?.(event)
    event.preventDefault()
    window.location.assign(href)
  }

  return (
    <a href={href} className={className} onClick={handleClick}>
      {children}
    </a>
  )
}
