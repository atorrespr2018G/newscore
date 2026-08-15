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
    "query ArticleBySlug($slug: String!, $market: String!) {\n  articleBySlug(slug: $slug, market: $market) {\n    id\n    slug\n    title\n    status\n    authorName\n    thumbnailUrl\n    videoUrl\n    createdAt\n    publishedAt\n    body\n    tags\n    categoryId\n    storyId\n    mediaIds\n    media {\n      id\n      url\n      fileType\n      width\n      height\n    }\n    viewCount\n    storyUpdates {\n      id\n      slug\n      title\n      status\n      authorName\n      thumbnailUrl\n      videoUrl\n      createdAt\n      publishedAt\n      body\n      tags\n      categoryId\n      storyId\n      mediaIds\n      media {\n        id\n        url\n        fileType\n        width\n        height\n      }\n      viewCount\n    }\n  }\n}": typeof types.ArticleBySlugDocument,
    "query BreakingNews($market: String!) {\n  breakingNews(market: $market)\n}": typeof types.BreakingNewsDocument,
    "query CategoryArticles($slug: String!, $page: Int!, $pageSize: Int!, $market: String, $regionCode: String) {\n  categoryArticles(\n    slug: $slug\n    page: $page\n    pageSize: $pageSize\n    market: $market\n    regionCode: $regionCode\n  ) {\n    items {\n      id\n      slug\n      title\n      body\n      status\n      authorName\n      thumbnailUrl\n      videoUrl\n      createdAt\n      publishedAt\n    }\n    total\n    page\n    pageSize\n    hasMore\n  }\n}": typeof types.CategoryArticlesDocument,
    "query HomepageFeed($market: String!, $town: String, $regionCode: String, $pageName: String) {\n  homepageFeed(\n    market: $market\n    town: $town\n    regionCode: $regionCode\n    pageName: $pageName\n  ) {\n    layoutId\n    pageName\n    adPlacements {\n      adType\n      location\n      enabled\n      anchorSlug\n    }\n    slots {\n      id\n      positionKey\n      displayName\n      presentationType\n      contentType\n      articles {\n        id\n        slug\n        title\n        body\n        status\n        authorName\n        thumbnailUrl\n        videoUrl\n        createdAt\n        publishedAt\n      }\n    }\n  }\n}": typeof types.HomepageFeedDocument,
};
const documents: Documents = {
    "query ArticleBySlug($slug: String!, $market: String!) {\n  articleBySlug(slug: $slug, market: $market) {\n    id\n    slug\n    title\n    status\n    authorName\n    thumbnailUrl\n    videoUrl\n    createdAt\n    publishedAt\n    body\n    tags\n    categoryId\n    storyId\n    mediaIds\n    media {\n      id\n      url\n      fileType\n      width\n      height\n    }\n    viewCount\n    storyUpdates {\n      id\n      slug\n      title\n      status\n      authorName\n      thumbnailUrl\n      videoUrl\n      createdAt\n      publishedAt\n      body\n      tags\n      categoryId\n      storyId\n      mediaIds\n      media {\n        id\n        url\n        fileType\n        width\n        height\n      }\n      viewCount\n    }\n  }\n}": types.ArticleBySlugDocument,
    "query BreakingNews($market: String!) {\n  breakingNews(market: $market)\n}": types.BreakingNewsDocument,
    "query CategoryArticles($slug: String!, $page: Int!, $pageSize: Int!, $market: String, $regionCode: String) {\n  categoryArticles(\n    slug: $slug\n    page: $page\n    pageSize: $pageSize\n    market: $market\n    regionCode: $regionCode\n  ) {\n    items {\n      id\n      slug\n      title\n      body\n      status\n      authorName\n      thumbnailUrl\n      videoUrl\n      createdAt\n      publishedAt\n    }\n    total\n    page\n    pageSize\n    hasMore\n  }\n}": types.CategoryArticlesDocument,
    "query HomepageFeed($market: String!, $town: String, $regionCode: String, $pageName: String) {\n  homepageFeed(\n    market: $market\n    town: $town\n    regionCode: $regionCode\n    pageName: $pageName\n  ) {\n    layoutId\n    pageName\n    adPlacements {\n      adType\n      location\n      enabled\n      anchorSlug\n    }\n    slots {\n      id\n      positionKey\n      displayName\n      presentationType\n      contentType\n      articles {\n        id\n        slug\n        title\n        body\n        status\n        authorName\n        thumbnailUrl\n        videoUrl\n        createdAt\n        publishedAt\n      }\n    }\n  }\n}": types.HomepageFeedDocument,
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
export function graphql(source: "query ArticleBySlug($slug: String!, $market: String!) {\n  articleBySlug(slug: $slug, market: $market) {\n    id\n    slug\n    title\n    status\n    authorName\n    thumbnailUrl\n    videoUrl\n    createdAt\n    publishedAt\n    body\n    tags\n    categoryId\n    storyId\n    mediaIds\n    media {\n      id\n      url\n      fileType\n      width\n      height\n    }\n    viewCount\n    storyUpdates {\n      id\n      slug\n      title\n      status\n      authorName\n      thumbnailUrl\n      videoUrl\n      createdAt\n      publishedAt\n      body\n      tags\n      categoryId\n      storyId\n      mediaIds\n      media {\n        id\n        url\n        fileType\n        width\n        height\n      }\n      viewCount\n    }\n  }\n}"): (typeof documents)["query ArticleBySlug($slug: String!, $market: String!) {\n  articleBySlug(slug: $slug, market: $market) {\n    id\n    slug\n    title\n    status\n    authorName\n    thumbnailUrl\n    videoUrl\n    createdAt\n    publishedAt\n    body\n    tags\n    categoryId\n    storyId\n    mediaIds\n    media {\n      id\n      url\n      fileType\n      width\n      height\n    }\n    viewCount\n    storyUpdates {\n      id\n      slug\n      title\n      status\n      authorName\n      thumbnailUrl\n      videoUrl\n      createdAt\n      publishedAt\n      body\n      tags\n      categoryId\n      storyId\n      mediaIds\n      media {\n        id\n        url\n        fileType\n        width\n        height\n      }\n      viewCount\n    }\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query BreakingNews($market: String!) {\n  breakingNews(market: $market)\n}"): (typeof documents)["query BreakingNews($market: String!) {\n  breakingNews(market: $market)\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query CategoryArticles($slug: String!, $page: Int!, $pageSize: Int!, $market: String, $regionCode: String) {\n  categoryArticles(\n    slug: $slug\n    page: $page\n    pageSize: $pageSize\n    market: $market\n    regionCode: $regionCode\n  ) {\n    items {\n      id\n      slug\n      title\n      body\n      status\n      authorName\n      thumbnailUrl\n      videoUrl\n      createdAt\n      publishedAt\n    }\n    total\n    page\n    pageSize\n    hasMore\n  }\n}"): (typeof documents)["query CategoryArticles($slug: String!, $page: Int!, $pageSize: Int!, $market: String, $regionCode: String) {\n  categoryArticles(\n    slug: $slug\n    page: $page\n    pageSize: $pageSize\n    market: $market\n    regionCode: $regionCode\n  ) {\n    items {\n      id\n      slug\n      title\n      body\n      status\n      authorName\n      thumbnailUrl\n      videoUrl\n      createdAt\n      publishedAt\n    }\n    total\n    page\n    pageSize\n    hasMore\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query HomepageFeed($market: String!, $town: String, $regionCode: String, $pageName: String) {\n  homepageFeed(\n    market: $market\n    town: $town\n    regionCode: $regionCode\n    pageName: $pageName\n  ) {\n    layoutId\n    pageName\n    adPlacements {\n      adType\n      location\n      enabled\n      anchorSlug\n    }\n    slots {\n      id\n      positionKey\n      displayName\n      presentationType\n      contentType\n      articles {\n        id\n        slug\n        title\n        body\n        status\n        authorName\n        thumbnailUrl\n        videoUrl\n        createdAt\n        publishedAt\n      }\n    }\n  }\n}"): (typeof documents)["query HomepageFeed($market: String!, $town: String, $regionCode: String, $pageName: String) {\n  homepageFeed(\n    market: $market\n    town: $town\n    regionCode: $regionCode\n    pageName: $pageName\n  ) {\n    layoutId\n    pageName\n    adPlacements {\n      adType\n      location\n      enabled\n      anchorSlug\n    }\n    slots {\n      id\n      positionKey\n      displayName\n      presentationType\n      contentType\n      articles {\n        id\n        slug\n        title\n        body\n        status\n        authorName\n        thumbnailUrl\n        videoUrl\n        createdAt\n        publishedAt\n      }\n    }\n  }\n}"];

export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}

export type DocumentType<TDocumentNode extends DocumentNode<any, any>> = TDocumentNode extends DocumentNode<  infer TType,  any>  ? TType  : never;