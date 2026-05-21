import { ApolloClient, HttpLink, InMemoryCache } from '@apollo/client'

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
    return url
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
