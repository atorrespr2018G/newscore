'use client'

import { ApolloProvider, type ApolloClient } from '@apollo/client'
import { NextIntlClientProvider, type AbstractIntlMessages } from 'next-intl'
import { useState, type ReactNode } from 'react'
import { LocaleProvider, type AppLocale } from '@/context/locale-context'
import { MarketProvider } from '@/context/market-context'
import { makeApolloClient } from '@/lib/graphql/apollo-client'

interface IProvidersProps {
  children: ReactNode
  locale: AppLocale
  messages: AbstractIntlMessages
}

/**
 * Apollo provider for client-side queries (market switch, polling).
 * Server components fetch initial data; no global loading gate.
 */
export function Providers({ children, locale, messages }: IProvidersProps): JSX.Element {
  const [client] = useState<ApolloClient<unknown>>(() => makeApolloClient())

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <ApolloProvider client={client}>
        <LocaleProvider initialLocale={locale}>
          <MarketProvider>{children}</MarketProvider>
        </LocaleProvider>
      </ApolloProvider>
    </NextIntlClientProvider>
  )
}
