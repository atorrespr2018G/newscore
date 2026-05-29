'use client'

import { ApolloProvider, type ApolloClient } from '@apollo/client'
import { useState, type ReactNode } from 'react'
import { MarketProvider } from '@/context/market-context'
import { makeApolloClient } from '@/lib/graphql/apollo-client'

interface IProvidersProps {
  children: ReactNode
}

/**
 * Apollo provider for client-side queries (market switch, polling).
 * Server components fetch initial data; no global loading gate.
 */
export function Providers({ children }: IProvidersProps): JSX.Element {
  const [client] = useState<ApolloClient<unknown>>(() => makeApolloClient())

  return (
    <ApolloProvider client={client}>
      <MarketProvider>{children}</MarketProvider>
    </ApolloProvider>
  )
}
