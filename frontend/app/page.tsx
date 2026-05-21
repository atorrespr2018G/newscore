import { BreakingTicker } from '@/components/features/breaking-ticker'
import { Homepage } from '@/components/features/homepage'
import { Masthead } from '@/components/ui/masthead'

export function generateMetadata() {
  return {
    title: 'NewsCore — Home',
    description: 'Top stories and latest updates.',
  }
}

export default function HomePage(): JSX.Element {
  return (
    <div>
      <Masthead />
      <BreakingTicker />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <Homepage />
      </main>
    </div>
  )
}

