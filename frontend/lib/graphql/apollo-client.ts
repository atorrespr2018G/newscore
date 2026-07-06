import { ApolloClient, HttpLink, InMemoryCache } from '@apollo/client'

function resolveBrowserGraphqlUrl(url: string): string {
  const trimmed = url.trim()
  if (!trimmed.startsWith('/')) {
    return trimmed
  }

  // In local Docker dev, Next runs on :3000 while Nginx gateway serves :80.
  if (
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') &&
    window.location.port === '3000'
  ) {
      return `${window.location.protocol}//${window.location.hostname}${trimmed}`
  }

  return `${window.location.origin}${trimmed}`
}

/**
 * GraphQL endpoint for the current runtime.
 * Browser uses the public host URL; server-side (Docker) uses the internal service name.
 */
export function graphqlUrl(): string {
  if (typeof window !== 'undefined') {
    const url = process.env.NEXT_PUBLIC_GRAPHQL_URL
    if (!url) {
      throw new Error('Missing NEXT_PUBLIC_GRAPHQL_URL')
    }
    return resolveBrowserGraphqlUrl(url)
  }

  const internal = process.env.GRAPHQL_INTERNAL_URL
  if (internal) {
    return internal
  }

  const fallback = process.env.NEXT_PUBLIC_GRAPHQL_URL
  if (!fallback) {
    throw new Error('Missing GRAPHQL_INTERNAL_URL or NEXT_PUBLIC_GRAPHQL_URL')
  }
  return fallback
}

/**
 * Build an Apollo Client for the federated public GraphQL API.
 */
export function makeApolloClient(): ApolloClient<unknown> {
  return new ApolloClient({
    link: new HttpLink({ uri: graphqlUrl() }),
    cache: new InMemoryCache({
      typePolicies: {
        // Keep slot article lists embedded so federation refs do not read back empty.
        HomepageSlot: {
          keyFields: false,
        },
      },
    }),
    defaultOptions: {
      watchQuery: {
        fetchPolicy: 'cache-and-network',
      },
    },
  })
}
