import { gql } from '@apollo/client'

export const HOMEPAGE_FEED_QUERY = gql`
  query HomepageFeed($market: String!, $town: String) {
    homepageFeed(market: $market, town: $town) {
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
          status
          authorName
          thumbnailUrl
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
      createdAt
      publishedAt
      body
      tags
      categoryId
      mediaIds
      viewCount
    }
  }
`

export const BREAKING_NEWS_QUERY = gql`
  query BreakingNews($market: String!) {
    breakingNews(market: $market)
  }
`
