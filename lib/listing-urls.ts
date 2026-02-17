/**
 * Shared listing URL builders for Zillow, Redfin, Realtor.com, and TruePeopleSearch.
 * Each URL format has been verified to work and redirect to the property page.
 */

export interface AddressParts {
  street: string // e.g. "9101 E 50th St"
  city: string   // e.g. "Kansas City"
  state: string  // e.g. "MO"
  zip: string    // e.g. "64133"
}

/**
 * Parse a full comma-separated address into parts.
 * Handles: "9101 E 50th St, Kansas City, MO 64133"
 */
export function parseAddress(fullAddress: string): AddressParts {
  const parts = fullAddress.split(",").map((s) => s.trim())
  const street = parts[0] || ""
  const city = parts[1] || ""
  const stateZip = parts[2] || ""
  const stateZipParts = stateZip.split(/\s+/)
  const state = stateZipParts[0] || ""
  const zip = stateZipParts[1] || ""
  return { street, city, state, zip }
}

/**
 * Zillow: /homes/{Street-City-State-Zip}_rb/
 * Confirmed working - Zillow resolves this to the exact property page.
 * Example: /homes/9101-E-50th-St-Kansas-City-MO-64133_rb/
 */
export function zillowUrl(addr: AddressParts): string {
  const slug = `${addr.street} ${addr.city} ${addr.state} ${addr.zip}`
    .replace(/[,#.]+/g, "")
    .replace(/\s+/g, "-")
  return `https://www.zillow.com/homes/${slug}_rb/`
}

/**
 * Redfin: No direct deep link format exists without a home ID.
 * Using Google "I'm Feeling Lucky" with site:redfin.com to redirect to the
 * top Google result for that address on Redfin. This is the most reliable
 * approach since Redfin URLs require /STATE/City/Address-Zip/home/ID format.
 */
export function redfinUrl(addr: AddressParts): string {
  const q = `${addr.street} ${addr.city} ${addr.state} ${addr.zip} site:redfin.com`
  return `https://www.google.com/search?q=${encodeURIComponent(q)}&btnI=I`
}

/**
 * Realtor.com: /realestateandhomes-detail/{Street-Dashed}_{City}_{State}_{Zip}
 * This is the confirmed working format for Realtor.com property pages.
 * Example: /realestateandhomes-detail/9101-E-50th-St_Kansas-City_MO_64133
 */
export function realtorUrl(addr: AddressParts): string {
  const streetSlug = addr.street
    .replace(/[,#.]+/g, "")
    .replace(/\s+/g, "-")
  const citySlug = addr.city.replace(/\s+/g, "-")
  if (addr.zip) {
    return `https://www.realtor.com/realestateandhomes-detail/${streetSlug}_${citySlug}_${addr.state}_${addr.zip}`
  }
  return `https://www.realtor.com/realestateandhomes-detail/${streetSlug}_${citySlug}_${addr.state}`
}

/**
 * Google search for the property.
 */
export function googlePropertyUrl(addr: AddressParts): string {
  const q = `"${addr.street}" "${addr.city}" ${addr.state} ${addr.zip} property`
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`
}

/**
 * TruePeopleSearch for the property address (owner lookup).
 */
export function truePeopleSearchUrl(addr: AddressParts): string {
  return `https://www.truepeoplesearch.com/resultaddress?streetaddress=${encodeURIComponent(addr.street)}&citystatezip=${encodeURIComponent(`${addr.city}, ${addr.state} ${addr.zip}`)}`
}

/**
 * Build all listing URLs for a given address.
 */
export function buildAllListingUrls(fullAddress: string, city?: string, state?: string, zip?: string) {
  let addr: AddressParts
  if (city && state) {
    addr = { street: fullAddress.split(",")[0].trim(), city, state, zip: zip || "" }
    // Try to extract zip from the full address if not provided
    if (!addr.zip) {
      const zipMatch = fullAddress.match(/\d{5}/)
      if (zipMatch) addr.zip = zipMatch[0]
    }
  } else {
    addr = parseAddress(fullAddress)
  }
  return {
    zillow: zillowUrl(addr),
    redfin: redfinUrl(addr),
    realtor: realtorUrl(addr),
    google: googlePropertyUrl(addr),
    truePeople: truePeopleSearchUrl(addr),
    addr,
  }
}
