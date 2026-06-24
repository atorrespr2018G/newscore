'use client'

import { ApolloProvider, type ApolloClient } from '@apollo/client'
import { NextIntlClientProvider, type AbstractIntlMessages } from 'next-intl'
import { useState, type ReactNode } from 'react'
import { LocaleProvider, type AppLocale } from '@/context/locale-context'
import { MarketProvider } from '@/context/market-context'
import { makeApolloClient } from '@/lib/graphql/apollo-client'
import { EDITORIAL_TIME_ZONE } from '@/lib/i18n/time-zone'

interface IProvidersProps {
  children: ReactNode
  locale: AppLocale
  messages: AbstractIntlMessages
}

/**
 * Apollo provider for client-side queries (market switch, polling).
 * Server components fetch initial data; no global loading gate.
 *
 * The editorial time zone is pinned here so client-side date formatting matches
 * the server render and avoids hydration mismatches. We use a shared constant
 * rather than next-intl's getTimeZone() because the root layout sits outside the
 * locale routing segment, where that request config does not resolve reliably.
 */
export function Providers({ children, locale, messages }: IProvidersProps): JSX.Element {
  const [client] = useState<ApolloClient<unknown>>(() => makeApolloClient())

  return (
    <NextIntlClientProvider locale={locale} messages={messages} timeZone={EDITORIAL_TIME_ZONE}>
      <ApolloProvider client={client}>
        <LocaleProvider initialLocale={locale}>
          <MarketProvider>{children}</MarketProvider>
        </LocaleProvider>
      </ApolloProvider>
    </NextIntlClientProvider>
  )
}
