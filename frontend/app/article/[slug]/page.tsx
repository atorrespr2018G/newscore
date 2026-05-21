import { ArticleClient } from './ui'

interface IArticlePageProps {
  params: { slug: string }
}

export function generateMetadata({ params }: IArticlePageProps) {
  return {
    title: `NewsCore — ${params.slug}`,
  }
}

export default function ArticlePage({ params }: IArticlePageProps): JSX.Element {
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <ArticleClient slug={params.slug} />
    </main>
  )
}

