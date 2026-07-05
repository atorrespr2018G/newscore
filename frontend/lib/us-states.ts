import { DEFAULT_MARKET_CODE } from '@/lib/market-constants'

export interface IUsStateOption {
  code: string
  label: string
}

export const US_MARKET_CODE = DEFAULT_MARKET_CODE

/** Total count of US states. */
export const US_STATE_COUNT = 50

/** All US states shown in the locality picker when the USA market is active. */
export const US_STATE_OPTIONS: IUsStateOption[] = [
  { code: 'al', label: 'Alabama' },
  { code: 'ak', label: 'Alaska' },
  { code: 'az', label: 'Arizona' },
  { code: 'ar', label: 'Arkansas' },
  { code: 'ca', label: 'California' },
  { code: 'co', label: 'Colorado' },
  { code: 'ct', label: 'Connecticut' },
  { code: 'de', label: 'Delaware' },
  { code: 'fl', label: 'Florida' },
  { code: 'ga', label: 'Georgia' },
  { code: 'hi', label: 'Hawaii' },
  { code: 'id', label: 'Idaho' },
  { code: 'il', label: 'Illinois' },
  { code: 'in', label: 'Indiana' },
  { code: 'ia', label: 'Iowa' },
  { code: 'ks', label: 'Kansas' },
  { code: 'ky', label: 'Kentucky' },
  { code: 'la', label: 'Louisiana' },
  { code: 'me', label: 'Maine' },
  { code: 'md', label: 'Maryland' },
  { code: 'ma', label: 'Massachusetts' },
  { code: 'mi', label: 'Michigan' },
  { code: 'mn', label: 'Minnesota' },
  { code: 'ms', label: 'Mississippi' },
  { code: 'mo', label: 'Missouri' },
  { code: 'mt', label: 'Montana' },
  { code: 'ne', label: 'Nebraska' },
  { code: 'nv', label: 'Nevada' },
  { code: 'nh', label: 'New Hampshire' },
  { code: 'nj', label: 'New Jersey' },
  { code: 'nm', label: 'New Mexico' },
  { code: 'ny', label: 'New York' },
  { code: 'nc', label: 'North Carolina' },
  { code: 'nd', label: 'North Dakota' },
  { code: 'oh', label: 'Ohio' },
  { code: 'ok', label: 'Oklahoma' },
  { code: 'or', label: 'Oregon' },
  { code: 'pa', label: 'Pennsylvania' },
  { code: 'ri', label: 'Rhode Island' },
  { code: 'sc', label: 'South Carolina' },
  { code: 'sd', label: 'South Dakota' },
  { code: 'tn', label: 'Tennessee' },
  { code: 'tx', label: 'Texas' },
  { code: 'ut', label: 'Utah' },
  { code: 'vt', label: 'Vermont' },
  { code: 'va', label: 'Virginia' },
  { code: 'wa', label: 'Washington' },
  { code: 'wv', label: 'West Virginia' },
  { code: 'wi', label: 'Wisconsin' },
  { code: 'wy', label: 'Wyoming' },
]

/**
 * Validate a persisted US state code.
 *
 * @param code Raw state code from storage.
 * @returns True when the code matches a configured state option.
 */
export function isValidUsStateCode(code: string): boolean {
  const normalized = code.trim().toLowerCase()
  return US_STATE_OPTIONS.some((state) => state.code === normalized)
}

/**
 * Resolve the label for a US state code.
 *
 * @param stateCode State id used in GraphQL and article filters.
 * @returns Human-readable state name, or the raw code when unmapped.
 */
export function usStateLabel(stateCode: string): string {
  const normalized = stateCode.trim().toLowerCase()
  const state = US_STATE_OPTIONS.find((entry) => entry.code === normalized)
  return state?.label ?? stateCode
}
