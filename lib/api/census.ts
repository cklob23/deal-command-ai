/**
 * US Census Bureau API client for demographic & housing data.
 * Docs: https://www.census.gov/data/developers/data-sets.html
 * Auth: Query param `key=<CENSUS_API_KEY>`
 * Uses ACS 5-Year (2023) for: population, median home value, median household income.
 */

const BASE = "https://api.census.gov/data/2023/acs/acs5"

/** FIPS state codes for all 50 states + DC */
const STATE_FIPS: Record<string, string> = {
  AL: "01", AK: "02", AZ: "04", AR: "05", CA: "06", CO: "08", CT: "09",
  DE: "10", DC: "11", FL: "12", GA: "13", HI: "15", ID: "16", IL: "17",
  IN: "18", IA: "19", KS: "20", KY: "21", LA: "22", ME: "23", MD: "24",
  MA: "25", MI: "26", MN: "27", MS: "28", MO: "29", MT: "30", NE: "31",
  NV: "32", NH: "33", NJ: "34", NM: "35", NY: "36", NC: "37", ND: "38",
  OH: "39", OK: "40", OR: "41", PA: "42", RI: "44", SC: "45", SD: "46",
  TN: "47", TX: "48", UT: "49", VT: "50", VA: "51", WA: "53", WV: "54",
  WI: "55", WY: "56",
}

export interface CensusDemo {
  population: number | null
  medianHomeValue: number | null
  medianHouseholdIncome: number | null
  cityName: string
  stateFips: string
  placeFips: string
  source: string
}

/**
 * Get demographics for a city (population, median home value, median income).
 * We fetch ALL places in the state and then fuzzy-match the city name.
 */
export async function getCityDemographics(city: string, stateAbbrev: string): Promise<CensusDemo | null> {
  const key = process.env.CENSUS_API_KEY
  if (!key) throw new Error("CENSUS_API_KEY is not set")

  const fips = STATE_FIPS[stateAbbrev.toUpperCase()]
  if (!fips) throw new Error(`Unknown state abbreviation: ${stateAbbrev}`)

  // Variables: B01003_001E = total population, B25077_001E = median home value, B19013_001E = median household income
  const url = `${BASE}?get=NAME,B01003_001E,B25077_001E,B19013_001E&for=place:*&in=state:${fips}&key=${key}`

  const res = await fetch(url, { next: { revalidate: 86400 } }) // cache 24h
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`Census API ${res.status}: ${text.slice(0, 200)}`)
  }

  const rows: string[][] = await res.json()
  // rows[0] = header, rows[1..n] = data: [NAME, pop, homeVal, income, state, place]

  const normalizedCity = city.toLowerCase().replace(/[^a-z\s]/g, "").trim()

  // Try exact match first, then contains
  let match = rows.slice(1).find((r) => {
    const name = r[0].toLowerCase()
    return name.startsWith(normalizedCity + " ")  // e.g. "kansas city city" or "kansas city CDP"
  })

  if (!match) {
    match = rows.slice(1).find((r) => {
      const name = r[0].toLowerCase()
      return name.includes(normalizedCity)
    })
  }

  if (!match) return null

  const parse = (v: string) => {
    const n = parseInt(v, 10)
    return isNaN(n) || n < 0 ? null : n
  }

  return {
    population: parse(match[1]),
    medianHomeValue: parse(match[2]),
    medianHouseholdIncome: parse(match[3]),
    cityName: match[0],
    stateFips: match[4],
    placeFips: match[5],
    source: "US Census Bureau ACS 5-Year (2023)",
  }
}

/** Check if Census key is configured */
export function isConfigured(): boolean {
  return !!process.env.CENSUS_API_KEY
}
