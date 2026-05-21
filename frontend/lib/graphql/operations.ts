import { gql } from '@apollo/client'

export const HOMEPAGE_FEED_QUERY = gql`
  query HomepageFeed {
    homepageFeed {
      layoutId
      pageName
      slots {
        id
        positionKey
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
  query ArticleBySlug($slug: String!) {
    articleBySlug(slug: $slug) {
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
  query BreakingNews {
    breakingNews
  }
`
