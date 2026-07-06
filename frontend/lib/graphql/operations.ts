import { gql } from '@apollo/client'

export const HOMEPAGE_FEED_QUERY = gql`
  query HomepageFeed($market: String!, $town: String, $regionCode: String, $pageName: String) {
    homepageFeed(market: $market, town: $town, regionCode: $regionCode, pageName: $pageName) {
      layoutId
      pageName
      slots {
        id
        positionKey
        displayName
        presentationType
        contentType
        articles {
          id
          slug
          title
          body
          status
          authorName
          thumbnailUrl
          videoUrl
          createdAt
          publishedAt
        }
      }
    }
  }
`

export const ARTICLE_BY_SLUG_QUERY = gql`
  query ArticleBySlug($slug: String!, $market: String!) {
    articleBySlug(slug: $slug, market: $market) {
      id
      slug
      title
      status
      authorName
      thumbnailUrl
      videoUrl
      createdAt
      publishedAt
      body
      tags
      categoryId
      storyId
      mediaIds
      media {
        id
        url
        fileType
        width
        height
      }
      viewCount
      storyUpdates {
        id
        slug
        title
        status
        authorName
        thumbnailUrl
        videoUrl
        createdAt
        publishedAt
        body
        tags
        categoryId
        storyId
        mediaIds
        media {
          id
          url
          fileType
          width
          height
        }
        viewCount
      }
    }
  }
`

export const BREAKING_NEWS_QUERY = gql`
  query BreakingNews($market: String!) {
    breakingNews(market: $market)
  }
`

/** Typed document nodes generated from lib/graphql/operations/*.graphql — run npm run codegen. */
export type { HomepageFeedQuery, ArticleBySlugQuery, BreakingNewsQuery } from './generated/graphql'
