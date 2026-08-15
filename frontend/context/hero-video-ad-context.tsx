'use client'

import { createContext, useContext, type ReactNode } from 'react'

const HeroVideoAdInterceptContext = createContext(false)

/**
 * Mark homepage hero story links so a click can open the video ad on the article.
 *
 * @param props Child tree of the public homepage hero.
 * @returns Provider wrapping homepage hero story cards.
 */
export function HeroVideoAdScope({ children }: { children: ReactNode }): JSX.Element {
  return (
    <HeroVideoAdInterceptContext.Provider value={true}>{children}</HeroVideoAdInterceptContext.Provider>
  )
}

/**
 * Whether the nearest article link should arm the hero-click video ad.
 *
 * @returns True only inside the public homepage hero.
 */
export function useHeroVideoAdScope(): boolean {
  return useContext(HeroVideoAdInterceptContext)
}
