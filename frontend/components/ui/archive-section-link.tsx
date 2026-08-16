'use client'

import type { MouseEvent, ReactNode } from 'react'

interface IArchiveSectionLinkProps {
  href: string
  className?: string
  children: ReactNode
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
 * Archive heading link that always leaves the current section landing page.
 *
 * Next.js client routing from `/world` can keep the World page mounted after a
 * nested archive route is added. Assigning `window.location` forces a real
 * document navigation, matching Sports › Baseball.
 *
 * @param props Archive href, optional class, and heading text.
 * @returns Anchor that navigates to the archive page.
 */
export function ArchiveSectionLink({
  href,
  className,
  children,
}: IArchiveSectionLinkProps): JSX.Element {
  function handleClick(event: MouseEvent<HTMLAnchorElement>): void {
    if (shouldAllowBrowserDefault(event)) {
      return
    }
    event.preventDefault()
    window.location.assign(href)
  }

  return (
    <a href={href} className={className} onClick={handleClick}>
      {children}
    </a>
  )
}
