export type Maybe<T> = T | null
export type InputMaybe<T> = T | null | undefined

export type Scalars = {
  ID: { input: string; output: string }
  String: { input: string; output: string }
  Boolean: { input: boolean; output: boolean }
  Int: { input: number; output: number }
  Float: { input: number; output: number }
  JSON: { input: unknown; output: unknown }
}

export type Article = {
  __typename?: 'Article'
  authorName: Scalars['String']['output']
  body?: Maybe<Scalars['String']['output']>
  categoryId?: Maybe<Scalars['ID']['output']>
  createdAt: Scalars['String']['output']
  id: Scalars['ID']['output']
  mediaIds?: Maybe<Array<Scalars['String']['output']>>
  publishedAt?: Maybe<Scalars['String']['output']>
  slug: Scalars['String']['output']
  status: Scalars['String']['output']
  tags?: Maybe<Array<Scalars['String']['output']>>
  thumbnailUrl?: Maybe<Scalars['String']['output']>
  title: Scalars['String']['output']
  viewCount?: Maybe<Scalars['Int']['output']>
}

export type HomepageFeed = {
  __typename?: 'HomepageFeed'
  layoutId?: Maybe<Scalars['ID']['output']>
  pageName: Scalars['String']['output']
  slots: Array<HomepageSlot>
}

export type HomepageSlot = {
  __typename?: 'HomepageSlot'
  articles: Array<Article>
  contentType: Scalars['String']['output']
  displayName?: Maybe<Scalars['String']['output']>
  id: Scalars['ID']['output']
  positionKey: Scalars['String']['output']
  presentationType: Scalars['String']['output']
}

export type HomepageFeedQueryVariables = {
  market: Scalars['String']['input']
  town?: InputMaybe<Scalars['String']['input']>
}

export type HomepageFeedQuery = {
  __typename?: 'Query'
  homepageFeed: HomepageFeed
}

export type ArticleBySlugQueryVariables = {
  market: Scalars['String']['input']
  slug: Scalars['String']['input']
}

export type ArticleBySlugQuery = {
  __typename?: 'Query'
  articleBySlug?: Maybe<Article>
}

export type BreakingNewsQueryVariables = {
  market: Scalars['String']['input']
}

export type BreakingNewsQuery = {
  __typename?: 'Query'
  breakingNews?: Maybe<Scalars['JSON']['output']>
}
