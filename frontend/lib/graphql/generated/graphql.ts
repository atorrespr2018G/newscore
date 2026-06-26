/* eslint-disable */
import { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  JSON: { input: any; output: any; }
};

export type Article = {
  __typename?: 'Article';
  authorName: Scalars['String']['output'];
  body?: Maybe<Scalars['String']['output']>;
  categoryId?: Maybe<Scalars['ID']['output']>;
  createdAt: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  media?: Maybe<Array<MediaAsset>>;
  mediaIds?: Maybe<Array<Scalars['String']['output']>>;
  publishedAt?: Maybe<Scalars['String']['output']>;
  slug: Scalars['String']['output'];
  status: Scalars['String']['output'];
  storyId?: Maybe<Scalars['ID']['output']>;
  storyUpdates?: Maybe<Array<Article>>;
  tags?: Maybe<Array<Scalars['String']['output']>>;
  thumbnailUrl?: Maybe<Scalars['String']['output']>;
  title: Scalars['String']['output'];
  videoUrl?: Maybe<Scalars['String']['output']>;
  viewCount?: Maybe<Scalars['Int']['output']>;
};

export type HomepageFeed = {
  __typename?: 'HomepageFeed';
  layoutId?: Maybe<Scalars['ID']['output']>;
  pageName: Scalars['String']['output'];
  slots: Array<HomepageSlot>;
};

export type HomepageSlot = {
  __typename?: 'HomepageSlot';
  articles: Array<Article>;
  contentType: Scalars['String']['output'];
  displayName?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  positionKey: Scalars['String']['output'];
  presentationType: Scalars['String']['output'];
};

export type MediaAsset = {
  __typename?: 'MediaAsset';
  fileType: Scalars['String']['output'];
  height?: Maybe<Scalars['Int']['output']>;
  id: Scalars['ID']['output'];
  url: Scalars['String']['output'];
  width?: Maybe<Scalars['Int']['output']>;
};

export type Query = {
  __typename?: 'Query';
  articleBySlug?: Maybe<Article>;
  breakingNews?: Maybe<Scalars['JSON']['output']>;
  homepageFeed: HomepageFeed;
};


export type QueryArticleBySlugArgs = {
  market: Scalars['String']['input'];
  slug: Scalars['String']['input'];
};


export type QueryBreakingNewsArgs = {
  market: Scalars['String']['input'];
};


export type QueryHomepageFeedArgs = {
  market: Scalars['String']['input'];
  pageName?: InputMaybe<Scalars['String']['input']>;
  town?: InputMaybe<Scalars['String']['input']>;
};

export type ArticleBySlugQueryVariables = Exact<{
  slug: Scalars['String']['input'];
  market: Scalars['String']['input'];
}>;


export type ArticleBySlugQuery = { __typename?: 'Query', articleBySlug?: { __typename?: 'Article', id: string, slug: string, title: string, status: string, authorName: string, thumbnailUrl?: string | null, videoUrl?: string | null, createdAt: string, publishedAt?: string | null, body?: string | null, tags?: Array<string> | null, categoryId?: string | null, storyId?: string | null, mediaIds?: Array<string> | null, viewCount?: number | null, media?: Array<{ __typename?: 'MediaAsset', id: string, url: string, fileType: string, width?: number | null, height?: number | null }> | null, storyUpdates?: Array<{ __typename?: 'Article', id: string, slug: string, title: string, status: string, authorName: string, thumbnailUrl?: string | null, videoUrl?: string | null, createdAt: string, publishedAt?: string | null, body?: string | null, tags?: Array<string> | null, categoryId?: string | null, storyId?: string | null, mediaIds?: Array<string> | null, viewCount?: number | null, media?: Array<{ __typename?: 'MediaAsset', id: string, url: string, fileType: string, width?: number | null, height?: number | null }> | null }> | null } | null };

export type BreakingNewsQueryVariables = Exact<{
  market: Scalars['String']['input'];
}>;


export type BreakingNewsQuery = { __typename?: 'Query', breakingNews?: any | null };

export type HomepageFeedQueryVariables = Exact<{
  market: Scalars['String']['input'];
  town?: InputMaybe<Scalars['String']['input']>;
  pageName?: InputMaybe<Scalars['String']['input']>;
}>;


export type HomepageFeedQuery = { __typename?: 'Query', homepageFeed: { __typename?: 'HomepageFeed', layoutId?: string | null, pageName: string, slots: Array<{ __typename?: 'HomepageSlot', id: string, positionKey: string, displayName?: string | null, presentationType: string, contentType: string, articles: Array<{ __typename?: 'Article', id: string, slug: string, title: string, body?: string | null, status: string, authorName: string, thumbnailUrl?: string | null, videoUrl?: string | null, createdAt: string, publishedAt?: string | null }> }> } };


export const ArticleBySlugDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ArticleBySlug"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"slug"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"market"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"articleBySlug"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"slug"},"value":{"kind":"Variable","name":{"kind":"Name","value":"slug"}}},{"kind":"Argument","name":{"kind":"Name","value":"market"},"value":{"kind":"Variable","name":{"kind":"Name","value":"market"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"authorName"}},{"kind":"Field","name":{"kind":"Name","value":"thumbnailUrl"}},{"kind":"Field","name":{"kind":"Name","value":"videoUrl"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"publishedAt"}},{"kind":"Field","name":{"kind":"Name","value":"body"}},{"kind":"Field","name":{"kind":"Name","value":"tags"}},{"kind":"Field","name":{"kind":"Name","value":"categoryId"}},{"kind":"Field","name":{"kind":"Name","value":"storyId"}},{"kind":"Field","name":{"kind":"Name","value":"mediaIds"}},{"kind":"Field","name":{"kind":"Name","value":"media"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"url"}},{"kind":"Field","name":{"kind":"Name","value":"fileType"}},{"kind":"Field","name":{"kind":"Name","value":"width"}},{"kind":"Field","name":{"kind":"Name","value":"height"}}]}},{"kind":"Field","name":{"kind":"Name","value":"viewCount"}},{"kind":"Field","name":{"kind":"Name","value":"storyUpdates"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"authorName"}},{"kind":"Field","name":{"kind":"Name","value":"thumbnailUrl"}},{"kind":"Field","name":{"kind":"Name","value":"videoUrl"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"publishedAt"}},{"kind":"Field","name":{"kind":"Name","value":"body"}},{"kind":"Field","name":{"kind":"Name","value":"tags"}},{"kind":"Field","name":{"kind":"Name","value":"categoryId"}},{"kind":"Field","name":{"kind":"Name","value":"storyId"}},{"kind":"Field","name":{"kind":"Name","value":"mediaIds"}},{"kind":"Field","name":{"kind":"Name","value":"media"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"url"}},{"kind":"Field","name":{"kind":"Name","value":"fileType"}},{"kind":"Field","name":{"kind":"Name","value":"width"}},{"kind":"Field","name":{"kind":"Name","value":"height"}}]}},{"kind":"Field","name":{"kind":"Name","value":"viewCount"}}]}}]}}]}}]} as unknown as DocumentNode<ArticleBySlugQuery, ArticleBySlugQueryVariables>;
export const BreakingNewsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"BreakingNews"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"market"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"breakingNews"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"market"},"value":{"kind":"Variable","name":{"kind":"Name","value":"market"}}}]}]}}]} as unknown as DocumentNode<BreakingNewsQuery, BreakingNewsQueryVariables>;
export const HomepageFeedDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"HomepageFeed"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"market"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"town"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"pageName"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"homepageFeed"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"market"},"value":{"kind":"Variable","name":{"kind":"Name","value":"market"}}},{"kind":"Argument","name":{"kind":"Name","value":"town"},"value":{"kind":"Variable","name":{"kind":"Name","value":"town"}}},{"kind":"Argument","name":{"kind":"Name","value":"pageName"},"value":{"kind":"Variable","name":{"kind":"Name","value":"pageName"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"layoutId"}},{"kind":"Field","name":{"kind":"Name","value":"pageName"}},{"kind":"Field","name":{"kind":"Name","value":"slots"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"positionKey"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"presentationType"}},{"kind":"Field","name":{"kind":"Name","value":"contentType"}},{"kind":"Field","name":{"kind":"Name","value":"articles"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"body"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"authorName"}},{"kind":"Field","name":{"kind":"Name","value":"thumbnailUrl"}},{"kind":"Field","name":{"kind":"Name","value":"videoUrl"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"publishedAt"}}]}}]}}]}}]}}]} as unknown as DocumentNode<HomepageFeedQuery, HomepageFeedQueryVariables>;