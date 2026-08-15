import { AD_VARIANT_SHELL_CLASS } from '@/lib/ad-config'

/** Matches the live masthead leaderboard layer so reserved space does not jump. */
const AD_RESERVE_LAYER_CLASS = 'sticky top-0 z-0'

/** Matches the live masthead nav bar height (~48px) while the chunk loads. */
const NAV_RESERVE_CLASS =
  'sticky top-0 z-40 h-12 border-b border-neutral-200 bg-white shadow-sm'

const AD_RESERVE_SECTION_CLASS = 'border-b border-neutral-200 bg-neutral-100'

const AD_RESERVE_SLOT_CLASS = [
  'flex items-center justify-center rounded border border-dashed border-neutral-300 bg-neutral-100 px-4',
  AD_VARIANT_SHELL_CLASS.leaderboard,
].join(' ')

/**
 * Reserved masthead chrome shown before the client masthead mounts.
 * Holds the leaderboard slot (CNN-style) so the page layout is stable, then the ad fills in.
 *
 * @returns Reserved leaderboard space and nav bar height.
 */
export function MastheadLoadingChrome(): JSX.Element {
  return (
    <>
      <div className={AD_RESERVE_LAYER_CLASS}>
        <section className={AD_RESERVE_SECTION_CLASS} aria-hidden="true">
          <div className="site-container py-4">
            <div className={AD_RESERVE_SLOT_CLASS} />
          </div>
        </section>
      </div>
      <header className={NAV_RESERVE_CLASS} />
    </>
  )
}
