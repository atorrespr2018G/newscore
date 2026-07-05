export interface IPuertoRicoTownOption {
  code: string
  label: string
}

export const PUERTO_RICO_MARKET_CODE = 'pr'
export const TOWN_COOKIE_NAME = 'newscore_town'
export const TOWN_STORAGE_KEY = 'newscore_town'

/** Total count of Puerto Rico municipalities (municipios). */
export const PUERTO_RICO_TOWN_COUNT = 78

/** All Puerto Rico municipalities shown in the town picker. */
export const PUERTO_RICO_TOWN_OPTIONS: IPuertoRicoTownOption[] = [
  { code: 'adjuntas', label: 'Adjuntas' },
  { code: 'aguada', label: 'Aguada' },
  { code: 'aguadilla', label: 'Aguadilla' },
  { code: 'aguas-buenas', label: 'Aguas Buenas' },
  { code: 'aibonito', label: 'Aibonito' },
  { code: 'anasco', label: 'Añasco' },
  { code: 'arecibo', label: 'Arecibo' },
  { code: 'arroyo', label: 'Arroyo' },
  { code: 'barceloneta', label: 'Barceloneta' },
  { code: 'barranquitas', label: 'Barranquitas' },
  { code: 'bayamon', label: 'Bayamón' },
  { code: 'cabo-rojo', label: 'Cabo Rojo' },
  { code: 'caguas', label: 'Caguas' },
  { code: 'camuy', label: 'Camuy' },
  { code: 'canovanas', label: 'Canóvanas' },
  { code: 'carolina', label: 'Carolina' },
  { code: 'catano', label: 'Cataño' },
  { code: 'cayey', label: 'Cayey' },
  { code: 'ceiba', label: 'Ceiba' },
  { code: 'ciales', label: 'Ciales' },
  { code: 'cidra', label: 'Cidra' },
  { code: 'coamo', label: 'Coamo' },
  { code: 'comerio', label: 'Comerío' },
  { code: 'corozal', label: 'Corozal' },
  { code: 'culebra', label: 'Culebra' },
  { code: 'dorado', label: 'Dorado' },
  { code: 'fajardo', label: 'Fajardo' },
  { code: 'florida', label: 'Florida' },
  { code: 'guanica', label: 'Guánica' },
  { code: 'guayama', label: 'Guayama' },
  { code: 'guayanilla', label: 'Guayanilla' },
  { code: 'guaynabo', label: 'Guaynabo' },
  { code: 'gurabo', label: 'Gurabo' },
  { code: 'hatillo', label: 'Hatillo' },
  { code: 'hormigueros', label: 'Hormigueros' },
  { code: 'humacao', label: 'Humacao' },
  { code: 'isabela', label: 'Isabela' },
  { code: 'jayuya', label: 'Jayuya' },
  { code: 'juana-diaz', label: 'Juana Díaz' },
  { code: 'juncos', label: 'Juncos' },
  { code: 'lajas', label: 'Lajas' },
  { code: 'lares', label: 'Lares' },
  { code: 'las-marias', label: 'Las Marías' },
  { code: 'las-piedras', label: 'Las Piedras' },
  { code: 'loiza', label: 'Loíza' },
  { code: 'luquillo', label: 'Luquillo' },
  { code: 'manati', label: 'Manatí' },
  { code: 'maricao', label: 'Maricao' },
  { code: 'maunabo', label: 'Maunabo' },
  { code: 'mayaguez', label: 'Mayagüez' },
  { code: 'moca', label: 'Moca' },
  { code: 'morovis', label: 'Morovis' },
  { code: 'naguabo', label: 'Naguabo' },
  { code: 'naranjito', label: 'Naranjito' },
  { code: 'orocovis', label: 'Orocovis' },
  { code: 'patillas', label: 'Patillas' },
  { code: 'penuelas', label: 'Peñuelas' },
  { code: 'ponce', label: 'Ponce' },
  { code: 'quebradillas', label: 'Quebradillas' },
  { code: 'rincon', label: 'Rincón' },
  { code: 'rio-grande', label: 'Río Grande' },
  { code: 'sabana-grande', label: 'Sabana Grande' },
  { code: 'salinas', label: 'Salinas' },
  { code: 'san-german', label: 'San Germán' },
  { code: 'san-juan', label: 'San Juan' },
  { code: 'san-lorenzo', label: 'San Lorenzo' },
  { code: 'san-sebastian', label: 'San Sebastián' },
  { code: 'santa-isabel', label: 'Santa Isabel' },
  { code: 'toa-alta', label: 'Toa Alta' },
  { code: 'toa-baja', label: 'Toa Baja' },
  { code: 'trujillo-alto', label: 'Trujillo Alto' },
  { code: 'utuado', label: 'Utuado' },
  { code: 'vega-alta', label: 'Vega Alta' },
  { code: 'vega-baja', label: 'Vega Baja' },
  { code: 'vieques', label: 'Vieques' },
  { code: 'villalba', label: 'Villalba' },
  { code: 'yabucoa', label: 'Yabucoa' },
  { code: 'yauco', label: 'Yauco' },
]

/**
 * Validate a persisted Puerto Rico town code.
 *
 * @param code Raw town code from storage.
 * @returns True when the code matches a configured town option.
 */
export function isValidPuertoRicoTownCode(code: string): boolean {
  const normalized = code.trim().toLowerCase()
  return PUERTO_RICO_TOWN_OPTIONS.some((town) => town.code === normalized)
}

/**
 * Resolve the label for a Puerto Rico town code.
 *
 * @param townCode Town id used in GraphQL and article filters.
 * @returns Human-readable town name, or the raw code when unmapped.
 */
export function puertoRicoTownLabel(townCode: string): string {
  const normalized = townCode.trim().toLowerCase()
  const town = PUERTO_RICO_TOWN_OPTIONS.find((entry) => entry.code === normalized)
  return town?.label ?? townCode
}
