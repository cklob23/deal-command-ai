/**
 * ATTOM Data API client for property details, owner info, AVM, and bulk search.
 * Docs: https://api.gateway.attomdata.com
 * Auth: Header `apikey: <ATTOM_API_KEY>`
 */

const BASE = "https://api.gateway.attomdata.com/propertyapi/v1.0.0"

function headers() {
  const key = process.env.ATTOM_API_KEY
  if (!key) throw new Error("ATTOM_API_KEY is not set")
  return { apikey: key, Accept: "application/json" }
}

async function attomFetch<T>(path: string, params: Record<string, string>): Promise<T> {
  const qs = new URLSearchParams(params).toString()
  const url = `${BASE}${path}?${qs}`
  const res = await fetch(url, { headers: headers(), next: { revalidate: 3600 } })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`ATTOM ${path} ${res.status}: ${text.slice(0, 200)}`)
  }
  return res.json()
}

// --- Types extracted from ATTOM responses ---

export interface AttomProperty {
  identifier?: { Id?: number; fips?: string; apn?: string }
  lot?: { lotSize1?: number; lotSize2?: number }
  address?: {
    line1?: string; line2?: string; locality?: string; countrySubd?: string
    postal1?: string; oneLine?: string
  }
  summary?: {
    propclass?: string; proptype?: string; propertyType?: string
    yearBuilt?: number; propLandUse?: string; propIndicator?: string
  }
  building?: {
    size?: { bldgSize?: number; livingSize?: number; universalSize?: number }
    rooms?: { beds?: number; bathsFull?: number; bathsTotal?: number }
    interior?: { bsmtSize?: number }
  }
  assessment?: {
    assessed?: { assdTtlValue?: number }
    market?: { mktTtlValue?: number }
    tax?: { taxAmt?: number; taxYear?: number }
  }
  avm?: {
    amount?: { value?: number; high?: number; low?: number }
    eventDate?: string
  }
  sale?: {
    saleTransDate?: string; saleAmountData?: { saleAmt?: number }
    saleSearchDate?: string
  }
  owner?: {
    owner1?: { lastName?: string; firstNameAndMi?: string }
    owner2?: { lastName?: string; firstNameAndMi?: string }
    absenteeInd?: string
    mailingAddressOneLine?: string
    corporateIndicator?: string
  }
  vintage?: { lastModified?: string }
}

interface AttomResponse {
  status?: { code?: number; msg?: string; total?: number }
  property?: AttomProperty[]
}

// --- Public methods ---

/** Full property details by address */
export async function getPropertyDetail(street: string, cityStateZip: string) {
  const data = await attomFetch<AttomResponse>("/property/detail", {
    address1: street,
    address2: cityStateZip,
  })
  return data.property?.[0] ?? null
}

/** Property + owner details (name, mailing address, absentee indicator) */
export async function getPropertyWithOwner(street: string, cityStateZip: string) {
  const data = await attomFetch<AttomResponse>("/property/detailowner", {
    address1: street,
    address2: cityStateZip,
  })
  return data.property?.[0] ?? null
}

/** Expanded profile: detail + assessment + owner in one call */
export async function getExpandedProfile(street: string, cityStateZip: string) {
  const data = await attomFetch<AttomResponse>("/property/expandedprofile", {
    address1: street,
    address2: cityStateZip,
  })
  return data.property?.[0] ?? null
}

/** ATTOM AVM (automated valuation model) for ARV estimates */
export async function getPropertyAVM(street: string, cityStateZip: string) {
  const data = await attomFetch<{ property?: AttomProperty[] }>("/attomavm/detail", {
    address1: street,
    address2: cityStateZip,
  })
  return data.property?.[0] ?? null
}

/** Most recent sale data */
export async function getSaleDetail(street: string, cityStateZip: string) {
  const data = await attomFetch<AttomResponse>("/sale/detail", {
    address1: street,
    address2: cityStateZip,
  })
  return data.property?.[0] ?? null
}

/** Sales history (last 10 years) */
export async function getSaleHistory(street: string, cityStateZip: string) {
  const data = await attomFetch<AttomResponse>("/saleshistory/detail", {
    address1: street,
    address2: cityStateZip,
  })
  return data.property ?? []
}

/** Bulk property search by area + filters. Returns up to `pagesize` results. */
export async function searchProperties(
  city: string,
  state: string,
  filters: {
    minPrice?: number
    maxPrice?: number
    propertyType?: string // SFR, APARTMENT, CONDO, etc.
    minBeds?: number
    maxBeds?: number
    pagesize?: number
    orderby?: string
  } = {}
) {
  const params: Record<string, string> = {
    cityname: city,
    statecode: state,
    pagesize: String(filters.pagesize ?? 20),
  }
  if (filters.minPrice) params.minAssdTtlValue = String(filters.minPrice)
  if (filters.maxPrice) params.maxAssdTtlValue = String(filters.maxPrice)
  if (filters.propertyType) params.propertytype = filters.propertyType
  if (filters.minBeds) params.minBeds = String(filters.minBeds)
  if (filters.maxBeds) params.maxBeds = String(filters.maxBeds)
  if (filters.orderby) params.orderby = filters.orderby

  const data = await attomFetch<AttomResponse>("/property/snapshot", params)
  return data.property ?? []
}

/** Helper: build ATTOM address2 string from city + state */
export function buildAddress2(city: string, state: string, zip?: string): string {
  return zip ? `${city}, ${state} ${zip}` : `${city}, ${state}`
}

/** Check if ATTOM key is configured */
export function isConfigured(): boolean {
  return !!process.env.ATTOM_API_KEY
}
