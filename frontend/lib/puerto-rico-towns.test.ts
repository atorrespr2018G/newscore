import { describe, expect, it } from 'vitest'

import {
  isValidPuertoRicoTownCode,
  PUERTO_RICO_TOWN_COUNT,
  PUERTO_RICO_TOWN_OPTIONS,
  puertoRicoTownLabel,
} from '@/lib/puerto-rico-towns'

describe('puerto-rico-towns', () => {
  it('validates configured town codes', () => {
    expect(isValidPuertoRicoTownCode('san-juan')).toBe(true)
    expect(isValidPuertoRicoTownCode('vieques')).toBe(true)
    expect(isValidPuertoRicoTownCode('invalid')).toBe(false)
  })

  it('resolves town labels', () => {
    expect(puertoRicoTownLabel('ponce')).toBe('Ponce')
    expect(puertoRicoTownLabel('rio-grande')).toBe('Río Grande')
    expect(puertoRicoTownLabel('unknown')).toBe('unknown')
  })

  it('includes all Puerto Rico municipalities for the masthead town picker', () => {
    expect(PUERTO_RICO_TOWN_OPTIONS).toHaveLength(PUERTO_RICO_TOWN_COUNT)
    expect(PUERTO_RICO_TOWN_OPTIONS.some((town) => town.code === 'san-juan')).toBe(true)
  })
})
