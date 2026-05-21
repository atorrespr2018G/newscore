'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useFeed } from '@/hooks/use-feed'
import { placeholderImageDataUri } from '@/lib/helpers/placeholder-image'
import { excerpt } from '@/lib/helpers/text-helpers'

interface IStoryCardProps {
  title: string
  slug: string
  kicker?: string
  imageSeed: string
  dense?: boolean
  layout?: 'side' | 'stacked'
}

function StoryCard({
  title,
  slug,
  kicker,
  imageSeed,
  dense = false,
  layout = 'side',
}: IStoryCardProps): JSX.Element {
  return (
    <article className="border-b border-neutral-200 pb-4 last:border-b-0 last:pb-0">
      <Link
        href={`/article/${encodeURIComponent(slug)}`}
        className={['group block', layout === 'side' ? 'grid grid-cols-[160px_1fr] gap-4' : ''].join(' ')}
      >
        <div className="overflow-hidden rounded border border-neutral-200 bg-neutral-100">
          <div className={['relative', layout === 'side' ? 'aspect-[4/3]' : 'aspect-[16/10]'].join(' ')}>
            <Image src={placeholderImageDataUri(imageSeed)} alt="" fill className="object-cover" unoptimized />
          </div>
        </div>
        <div className={layout === 'side' ? '' : 'mt-3'}>
          {kicker ? (
            <p className="text-[11px] font-extrabold tracking-[0.22em] text-[color:var(--brand-red)]">{kicker}</p>
          ) : null}
          <h3
            className={[
              'mt-1 leading-snug text-neutral-950 group-hover:text-[color:var(--brand-red)]',
              dense ? 'text-[15px] font-bold' : 'text-[16px] font-extrabold',
            ].join(' ')}
          >
            {title}
          </h3>
        </div>
      </Link>
    </article>
  )
}

interface IRightPromoProps {
  title: string
  subtitle: string
}

function RightPromo({ title, subtitle }: IRightPromoProps): JSX.Element {
  return (
    <div className="overflow-hidden rounded border border-neutral-200 bg-neutral-950">
      <div className="p-4">
        <div className="inline-flex rounded bg-[color:var(--brand-red)] px-2 py-1 text-[10px] font-black tracking-[0.24em] text-white">
          NEWSCORE
        </div>
        <h3 className="mt-3 text-xl font-black leading-tight text-white">{title}</h3>
        <p className="mt-2 text-sm font-semibold text-white/80">{subtitle}</p>
      </div>
      <div className="border-t border-white/10 bg-white/5 p-4">
        <p className="text-sm font-semibold text-white">Catch up on today’s headlines</p>
      </div>
    </div>
  )
}

/**
 * Homepage composition:
 * left story stack · center hero + strip · right promo rail.
 */
export function Homepage(): JSX.Element {
  const { data, loading, error } = useFeed()

  if (loading) return <div className="text-neutral-600">Loading…</div>
  if (error) return <div className="text-red-700">Failed to load: {error.message}</div>

  const slot = data?.slots?.[0]
  const articles = slot?.articles ?? []
  const hero = articles[0]

  if (!hero) {
    return <div className="text-neutral-600">No stories yet. Run the seed script and refresh.</div>
  }

  const left = [articles[1], articles[2], articles[3]].filter(Boolean)
  const strip = [articles[4], articles[1], articles[2]].filter(Boolean)
  const rightCards = [articles[3], articles[4]].filter(Boolean)

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
      {/* Left column */}
      <aside className="lg:col-span-3">
        <div className="space-y-4">
          {left.map((a, idx) => (
            <StoryCard
              key={a!.id}
              title={a!.title}
              slug={a!.slug}
              kicker={idx === 0 ? 'Top' : undefined}
              imageSeed={a!.slug}
              layout="stacked"
            />
          ))}
        </div>
      </aside>

      {/* Center column */}
      <section className="lg:col-span-6">
        <div className="border-b border-neutral-200 pb-5">
          <Link href={`/article/${encodeURIComponent(hero.slug)}`} className="group">
            <h2 className="text-[34px] font-black leading-[1.05] tracking-tight text-neutral-950 group-hover:text-[color:var(--brand-red)]">
              {hero.title}
            </h2>
          </Link>

          <div className="mt-4 overflow-hidden rounded border border-neutral-200 bg-neutral-100">
            <div className="relative aspect-[16/9]">
              <Image src={hero.thumbnailUrl ?? placeholderImageDataUri(hero.slug)} alt="" fill className="object-cover" unoptimized />
            </div>
          </div>

          <p className="mt-4 text-[13px] leading-relaxed text-neutral-800">
            {excerpt(
              'Dense three-column homepage with a dominant hero, a sub-story strip, and a right promo rail.',
              200,
            )}
          </p>
        </div>

        {/* Sub-story strip */}
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          {strip.map((a) => (
            <article key={a!.id} className="border-b border-neutral-200 pb-4 last:border-b-0 md:border-b-0 md:pb-0">
              <Link href={`/article/${encodeURIComponent(a!.slug)}`} className="group block">
                <div className="overflow-hidden rounded border border-neutral-200 bg-neutral-100">
                  <div className="relative aspect-[16/10]">
                    <Image src={placeholderImageDataUri(a!.slug)} alt="" fill className="object-cover" unoptimized />
                  </div>
                </div>
                <p className="mt-3 text-[13px] font-extrabold leading-snug text-neutral-950 group-hover:text-[color:var(--brand-red)]">
                  {a!.title}
                </p>
              </Link>
            </article>
          ))}
        </div>
      </section>

      {/* Right column */}
      <aside className="lg:col-span-3">
        <div className="space-y-6">
          <RightPromo title="Headlines" subtitle="The big stories, fast." />

          <div className="space-y-4">
            {rightCards.map((a) => (
              <article key={a!.id} className="overflow-hidden rounded border border-neutral-200">
                <Link href={`/article/${encodeURIComponent(a!.slug)}`} className="group block">
                  <div className="relative aspect-[16/10] bg-neutral-100">
                    <Image src={placeholderImageDataUri(a!.slug)} alt="" fill className="object-cover" unoptimized />
                  </div>
                  <div className="p-4">
                    <p className="text-[13px] font-extrabold leading-snug text-neutral-950 group-hover:text-[color:var(--brand-red)]">
                      {a!.title}
                    </p>
                  </div>
                </Link>
              </article>
            ))}
          </div>
        </div>
      </aside>
    </div>
  )
}

