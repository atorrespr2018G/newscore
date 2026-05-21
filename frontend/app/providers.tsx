'use client'

import { ApolloProvider, type ApolloClient } from '@apollo/client'
import { useEffect, useState, type ReactNode } from 'react'
import { makeApolloClient } from '@/lib/graphql/apollo-client'

interface IProvidersProps {
  children: ReactNode
}

/**
 * Apollo provider that only mounts in the browser.
 * Avoids SSR querying localhost:4000 from inside Docker and empty-cache hydration.
 */
export function Providers({ children }: IProvidersProps): JSX.Element {
  const [client, setClient] = useState<ApolloClient<unknown> | null>(null)

  useEffect(() => {
    setClient(makeApolloClient())
  }, [])

  if (!client) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-8 text-neutral-600" aria-busy="true">
        Loading…
      </div>
    )
  }

  return <ApolloProvider client={client}>{children}</ApolloProvider>
}
