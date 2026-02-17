/**
 * RentCast API client for active listings, property records, comps, AVM, and market data.
 * Docs: https://developers.rentcast.io
 * Auth: Header `X-Api-Key: <RENTCAST_API_KEY>`
 */

const BASE = "https://api.rentcast.io/v1"

function headers() {
  const key = process.env.RENTCAST_API_KEY
  if (!key) throw new Error("RENTCAST_API_KEY is not set")
  return { "X-Api-Key": key, Accept: "application/json" }
}

async function rcFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const qs = new URLSearchParams(params).toString()
  const url = qs ? `${BASE}${path}?${qs}` : `${BASE}${path}`
  const res = await fetch(url, { headers: headers(), next: { revalidate: 3600 } })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`RentCast ${path} ${res.status}: ${text.slice(0, 200)}`)
  }
  return res.json()
}

// --- Types ---

export interface RentCastListing {
  id?: string
  formattedAddress?: string
  addressLine1?: string
  city?: string
  state?: string
  zipCode?: string
  county?: string
  latitude?: number
  longitude?: number
  propertyType?: string
  bedrooms?: number
  bathrooms?: number
  squareFootage?: number
  lotSize?: number
  yearBuilt?: number
  price?: number
  listingType?: string
  status?: string
  daysOnMarket?: number
  listedDate?: string
  removedDate?: string
  lastSeenDate?: string
  createdDate?: string
}

export interface RentCastPropertyRecord {
  id?: string
  formattedAddress?: string
  addressLine1?: string
  city?: string
  state?: string
  zipCode?: string
  county?: string
  propertyType?: string
  bedrooms?: number
  bathrooms?: number
  squareFootage?: number
  lotSize?: number
  yearBuilt?: number
  ownerName?: string
  assessorID?: string
  legalDescription?: string
  lastSaleDate?: string
  lastSalePrice?: number
  taxAssessedValue?: number
}

export interface RentCastValueEstimate {
  price?: number
  priceRangeLow?: number
  priceRangeHigh?: number
  formattedAddress?: string
  propertyType?: string
  bedrooms?: number
  bathrooms?: number
  squareFootage?: number
  comparables?: Array<{
    formattedAddress?: string
    price?: number
    squareFootage?: number
    bedrooms?: number
    bathrooms?: number
    distance?: number
    daysOld?: number
    correlation?: number
  }>
}

export interface RentCastMarket {
  zipCode?: string
  city?: string
  state?: string
  saleData?: {
    averagePrice?: number
    medianPrice?: number
    averagePricePerSquareFoot?: number
    averageDaysOnMarket?: number
    totalListings?: number
    averageSquareFootage?: number
    history?: Array<{
      date?: string
      averagePrice?: number
      medianPrice?: number
      totalListings?: number
    }>
  }
  rentalData?: {
    averageRent?: number
    medianRent?: number
    averageRentPerSquareFoot?: number
    totalListings?: number
  }
}

// --- Public methods ---

/** Active sale listings in a market with filters */
export async function getSaleListings(
  city: string,
  state: string,
  filters: {
    propertyType?: string // "Single Family", "Condo", "Townhouse", "Multi-Family"
    status?: string       // "Active", "Pending", "Sold"
    minPrice?: number
    maxPrice?: number
    minBeds?: number
    maxBeds?: number
    daysOld?: string      // e.g. "30:*" = 30+ days
    limit?: number
  } = {}
) {
  const params: Record<string, string> = {
    city,
    state,
    status: filters.status ?? "Active",
    limit: String(filters.limit ?? 20),
  }
  if (filters.propertyType) params.propertyType = filters.propertyType
  if (filters.minPrice) params.minPrice = String(filters.minPrice)
  if (filters.maxPrice) params.maxPrice = String(filters.maxPrice)
  if (filters.minBeds) params.bedrooms = String(filters.minBeds)
  if (filters.daysOld) params.daysOld = filters.daysOld

  return rcFetch<RentCastListing[]>("/listings/sale", params)
}

/** Property record by address (owner name, tax data, last sale) */
export async function getPropertyRecord(fullAddress: string) {
  return rcFetch<RentCastPropertyRecord[]>("/properties", { address: fullAddress })
}

/** AVM value estimate for a specific property */
export async function getPropertyValue(fullAddress: string) {
  return rcFetch<RentCastValueEstimate>("/avm/value", { address: fullAddress })
}

/** Rent estimate for a property */
export async function getRentEstimate(fullAddress: string) {
  return rcFetch<{ rent?: number; rentRangeLow?: number; rentRangeHigh?: number }>("/avm/rent", { address: fullAddress })
}

/** Sale comparables for a property */
export async function getSaleComps(fullAddress: string, limit = 5) {
  return rcFetch<RentCastValueEstimate>("/avm/sale-comparables", {
    address: fullAddress,
    limit: String(limit),
  })
}

/** Market data (avg price, DOM, listing counts, history) by zip code */
export async function getMarketData(zipCode: string) {
  return rcFetch<RentCastMarket>("/market", { zipCode })
}

/** Check if RentCast key is configured */
export function isConfigured(): boolean {
  return !!process.env.RENTCAST_API_KEY
}
