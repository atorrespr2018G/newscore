export interface IFloridaCountyOption {
  code: string
  label: string
}

export const FLORIDA_STATE_CODE = 'fl'
export const COUNTY_COOKIE_NAME = 'newscore_county'
export const COUNTY_STORAGE_KEY = 'newscore_county'

const FLORIDA_COUNTY_LEGACY_ALIASES: Record<string, string> = {
  dade: 'miami-dade',
}

/** All Florida counties shown in the county picker when US/Florida is active. */
export const FLORIDA_COUNTY_OPTIONS: IFloridaCountyOption[] = [
  { code: 'alachua', label: 'Alachua' },
  { code: 'baker', label: 'Baker' },
  { code: 'bay', label: 'Bay' },
  { code: 'bradford', label: 'Bradford' },
  { code: 'brevard', label: 'Brevard' },
  { code: 'broward', label: 'Broward' },
  { code: 'calhoun', label: 'Calhoun' },
  { code: 'charlotte', label: 'Charlotte' },
  { code: 'citrus', label: 'Citrus' },
  { code: 'clay', label: 'Clay' },
  { code: 'collier', label: 'Collier' },
  { code: 'columbia', label: 'Columbia' },
  { code: 'desoto', label: 'DeSoto' },
  { code: 'dixie', label: 'Dixie' },
  { code: 'duval', label: 'Duval' },
  { code: 'escambia', label: 'Escambia' },
  { code: 'flagler', label: 'Flagler' },
  { code: 'franklin', label: 'Franklin' },
  { code: 'gadsden', label: 'Gadsden' },
  { code: 'gilchrist', label: 'Gilchrist' },
  { code: 'glades', label: 'Glades' },
  { code: 'gulf', label: 'Gulf' },
  { code: 'hamilton', label: 'Hamilton' },
  { code: 'hardee', label: 'Hardee' },
  { code: 'hendry', label: 'Hendry' },
  { code: 'hernando', label: 'Hernando' },
  { code: 'highlands', label: 'Highlands' },
  { code: 'hillsborough', label: 'Hillsborough' },
  { code: 'holmes', label: 'Holmes' },
  { code: 'indian-river', label: 'Indian River' },
  { code: 'jackson', label: 'Jackson' },
  { code: 'jefferson', label: 'Jefferson' },
  { code: 'lafayette', label: 'Lafayette' },
  { code: 'lake', label: 'Lake' },
  { code: 'lee', label: 'Lee' },
  { code: 'leon', label: 'Leon' },
  { code: 'levy', label: 'Levy' },
  { code: 'liberty', label: 'Liberty' },
  { code: 'madison', label: 'Madison' },
  { code: 'manatee', label: 'Manatee' },
  { code: 'marion', label: 'Marion' },
  { code: 'martin', label: 'Martin' },
  { code: 'miami-dade', label: 'Miami-Dade' },
  { code: 'monroe', label: 'Monroe' },
  { code: 'nassau', label: 'Nassau' },
  { code: 'okaloosa', label: 'Okaloosa' },
  { code: 'okeechobee', label: 'Okeechobee' },
  { code: 'orange', label: 'Orange' },
  { code: 'osceola', label: 'Osceola' },
  { code: 'palm-beach', label: 'Palm Beach' },
  { code: 'pasco', label: 'Pasco' },
  { code: 'pinellas', label: 'Pinellas' },
  { code: 'polk', label: 'Polk' },
  { code: 'putnam', label: 'Putnam' },
  { code: 'santa-rosa', label: 'Santa Rosa' },
  { code: 'sarasota', label: 'Sarasota' },
  { code: 'seminole', label: 'Seminole' },
  { code: 'st-johns', label: 'St. Johns' },
  { code: 'st-lucie', label: 'St. Lucie' },
  { code: 'sumter', label: 'Sumter' },
  { code: 'suwannee', label: 'Suwannee' },
  { code: 'taylor', label: 'Taylor' },
  { code: 'union', label: 'Union' },
  { code: 'volusia', label: 'Volusia' },
  { code: 'wakulla', label: 'Wakulla' },
  { code: 'walton', label: 'Walton' },
  { code: 'washington', label: 'Washington' },
]

/**
 * Validate a Florida county code.
 *
 * @param code Raw county code from storage or query state.
 * @returns True when the code matches a configured county option.
 */
export function isValidFloridaCountyCode(code: string): boolean {
  const normalized = normalizeFloridaCountyCode(code)
  return FLORIDA_COUNTY_OPTIONS.some((county) => county.code === normalized)
}

/**
 * Normalize county aliases to canonical codes used by region records.
 *
 * @param code Raw county code from user input, cookie, or storage.
 * @returns Canonical county code.
 */
export function normalizeFloridaCountyCode(code: string): string {
  const normalized = code.trim().toLowerCase()
  return FLORIDA_COUNTY_LEGACY_ALIASES[normalized] ?? normalized
}
