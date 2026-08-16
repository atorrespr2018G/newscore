'use client'

import {
  DocumentNavLink,
  type IDocumentNavLinkProps,
} from '@/components/ui/document-nav-link'

/**
 * Archive heading link that always leaves the current section landing page.
 *
 * Next.js client routing from `/world` can keep the World page mounted after a
 * nested archive route is added. Document navigation matches Sports › Baseball.
 *
 * @param props Archive href, optional class, and heading text.
 * @returns Anchor that navigates to the archive page.
 */
export function ArchiveSectionLink(props: IDocumentNavLinkProps): JSX.Element {
  return <DocumentNavLink {...props} />
}
