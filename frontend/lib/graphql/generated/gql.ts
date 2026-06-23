/* eslint-disable */
import * as types from './graphql';
import { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';

/**
 * Map of all GraphQL operations in the project.
 *
 * This map has several performance disadvantages:
 * 1. It is not tree-shakeable, so it will include all operations in the project.
 * 2. It is not minifiable, so the string of a GraphQL query will be multiple times inside the bundle.
 * 3. It does not support dead code elimination, so it will add unused operations.
 *
 * Therefore it is highly recommended to use the babel or swc plugin for production.
 * Learn more about it here: https://the-guild.dev/graphql/codegen/plugins/presets/preset-client#reducing-bundle-size
 */
type Documents = {
    "query ArticleBySlug($slug: String!, $market: String!) {\n  articleBySlug(slug: $slug, market: $market) {\n    id\n    slug\n    title\n    status\n    authorName\n    thumbnailUrl\n    videoUrl\n    createdAt\n    publishedAt\n    body\n    tags\n    categoryId\n    mediaIds\n    media {\n      id\n      url\n      fileType\n      width\n      height\n    }\n    viewCount\n  }\n}": typeof types.ArticleBySlugDocument,
    "query BreakingNews($market: String!) {\n  breakingNews(market: $market)\n}": typeof types.BreakingNewsDocument,
    "query HomepageFeed($market: String!, $town: String, $pageName: String) {\n  homepageFeed(market: $market, town: $town, pageName: $pageName) {\n    layoutId\n    pageName\n    slots {\n      id\n      positionKey\n      displayName\n      presentationType\n      contentType\n      articles {\n        id\n        slug\n        title\n        body\n        status\n        authorName\n        thumbnailUrl\n        videoUrl\n        createdAt\n        publishedAt\n      }\n    }\n  }\n}": typeof types.HomepageFeedDocument,
};
const documents: Documents = {
    "query ArticleBySlug($slug: String!, $market: String!) {\n  articleBySlug(slug: $slug, market: $market) {\n    id\n    slug\n    title\n    status\n    authorName\n    thumbnailUrl\n    videoUrl\n    createdAt\n    publishedAt\n    body\n    tags\n    categoryId\n    mediaIds\n    media {\n      id\n      url\n      fileType\n      width\n      height\n    }\n    viewCount\n  }\n}": types.ArticleBySlugDocument,
    "query BreakingNews($market: String!) {\n  breakingNews(market: $market)\n}": types.BreakingNewsDocument,
    "query HomepageFeed($market: String!, $town: String, $pageName: String) {\n  homepageFeed(market: $market, town: $town, pageName: $pageName) {\n    layoutId\n    pageName\n    slots {\n      id\n      positionKey\n      displayName\n      presentationType\n      contentType\n      articles {\n        id\n        slug\n        title\n        body\n        status\n        authorName\n        thumbnailUrl\n        videoUrl\n        createdAt\n        publishedAt\n      }\n    }\n  }\n}": types.HomepageFeedDocument,
};

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 *
 *
 * @example
 * ```ts
 * const query = graphql(`query GetUser($id: ID!) { user(id: $id) { name } }`);
 * ```
 *
 * The query argument is unknown!
 * Please regenerate the types.
 */
export function graphql(source: string): unknown;

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query ArticleBySlug($slug: String!, $market: String!) {\n  articleBySlug(slug: $slug, market: $market) {\n    id\n    slug\n    title\n    status\n    authorName\n    thumbnailUrl\n    videoUrl\n    createdAt\n    publishedAt\n    body\n    tags\n    categoryId\n    mediaIds\n    media {\n      id\n      url\n      fileType\n      width\n      height\n    }\n    viewCount\n  }\n}"): (typeof documents)["query ArticleBySlug($slug: String!, $market: String!) {\n  articleBySlug(slug: $slug, market: $market) {\n    id\n    slug\n    title\n    status\n    authorName\n    thumbnailUrl\n    videoUrl\n    createdAt\n    publishedAt\n    body\n    tags\n    categoryId\n    mediaIds\n    media {\n      id\n      url\n      fileType\n      width\n      height\n    }\n    viewCount\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query BreakingNews($market: String!) {\n  breakingNews(market: $market)\n}"): (typeof documents)["query BreakingNews($market: String!) {\n  breakingNews(market: $market)\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query HomepageFeed($market: String!, $town: String, $pageName: String) {\n  homepageFeed(market: $market, town: $town, pageName: $pageName) {\n    layoutId\n    pageName\n    slots {\n      id\n      positionKey\n      displayName\n      presentationType\n      contentType\n      articles {\n        id\n        slug\n        title\n        body\n        status\n        authorName\n        thumbnailUrl\n        videoUrl\n        createdAt\n        publishedAt\n      }\n    }\n  }\n}"): (typeof documents)["query HomepageFeed($market: String!, $town: String, $pageName: String) {\n  homepageFeed(market: $market, town: $town, pageName: $pageName) {\n    layoutId\n    pageName\n    slots {\n      id\n      positionKey\n      displayName\n      presentationType\n      contentType\n      articles {\n        id\n        slug\n        title\n        body\n        status\n        authorName\n        thumbnailUrl\n        videoUrl\n        createdAt\n        publishedAt\n      }\n    }\n  }\n}"];

export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}

export type DocumentType<TDocumentNode extends DocumentNode<any, any>> = TDocumentNode extends DocumentNode<  infer TType,  any>  ? TType  : never;