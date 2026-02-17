"use server"

import * as batchdata from "@/lib/api/batchdata"
import * as attom from "@/lib/api/attom"
import * as rentcast from "@/lib/api/rentcast"
import { parseAddress, type AddressParts } from "@/lib/listing-urls"

export interface SellerLookupResult {
  found: boolean
  sellerName: string
  sellerType: string
  agentName: string
  agentBrokerage: string
  agentPhone: string
  agentEmail: string
  sellerPhone: string
  sellerEmail: string
  ownershipDuration: string
  mailingAddress: string
  motivationClues: string[]
  lookupSources: string[]
  skipTraceTip: string
  dataConfidence: string
  rawFindings: string
  phones: Array<{ number: string; type: string; confidence: number }>
  emails: Array<{ address: string; type: string; confidence: number }>
}

const EMPTY_RESULT: SellerLookupResult = {
  found: false,
  sellerName: "",
  sellerType: "Unknown",
  agentName: "",
  agentBrokerage: "",
  agentPhone: "",
  agentEmail: "",
  sellerPhone: "",
  sellerEmail: "",
  ownershipDuration: "",
  mailingAddress: "",
  motivationClues: [],
  lookupSources: [],
  skipTraceTip: "",
  dataConfidence: "None",
  rawFindings: "",
  phones: [],
  emails: [],
}

export async function lookupSellerInfo(
  fullAddress: string,
  city?: string,
  state?: string,
  listPrice?: number,
) {
  let addr: AddressParts
  if (city && state) {
    addr = { street: fullAddress.split(",")[0].trim(), city, state, zip: "" }
    const zipMatch = fullAddress.match(/\d{5}/)
    if (zipMatch) addr.zip = zipMatch[0]
  } else {
    addr = parseAddress(fullAddress)
  }

  const sourcesUsed: string[] = []
  const findings: string[] = []
  const motivationClues: string[] = []
  let ownerName = ""
  let mailingAddress = ""
  let ownershipDuration = ""
  let absenteeOwner = false
  let corporateOwner = false
  const phones: SellerLookupResult["phones"] = []
  const emails: SellerLookupResult["emails"] = []

  // --- 1. BatchData skip trace (primary contact source) ---
  if (batchdata.isConfigured()) {
    try {
      const trace = await batchdata.skipTraceByAddress(addr.street, addr.city, addr.state, addr.zip)
      sourcesUsed.push("BatchData Skip Trace")
      if (trace.found) {
        if (trace.ownerName) ownerName = trace.ownerName
        if (trace.mailingAddress) mailingAddress = String(trace.mailingAddress)
        for (const p of trace.phones) {
          if (p.phoneNumber) {
            phones.push({
              number: String(p.phoneNumber),
              type: p.phoneType ?? "unknown",
              confidence: p.confidenceScore ?? 0,
            })
          }
        }
        for (const e of trace.emails) {
          if (e.emailAddress) {
            emails.push({
              address: String(e.emailAddress),
              type: e.emailType ?? "unknown",
              confidence: e.confidenceScore ?? 0,
            })
          }
        }
        findings.push(`BatchData: Found owner "${trace.ownerName || "unknown"}", ${trace.phones.length} phone(s), ${trace.emails.length} email(s)`)
      } else {
        findings.push("BatchData: No skip trace results for this address")
      }
    } catch (err) {
      findings.push(`BatchData: ${err instanceof Error ? err.message : "API error"}`)
    }
  } else {
    findings.push("BatchData: API key not configured (skip trace unavailable)")
  }

  // --- 2. ATTOM property + owner (supplements with ownership data) ---
  if (attom.isConfigured()) {
    try {
      const address2 = attom.buildAddress2(addr.city, addr.state, addr.zip)
      const prop = await attom.getPropertyWithOwner(addr.street, address2)
      sourcesUsed.push("ATTOM Property Data")
      if (prop) {
        // Owner info
        const o1 = prop.owner?.owner1
        if (o1 && (o1.firstNameAndMi || o1.lastName)) {
          const attomOwner = [o1.firstNameAndMi, o1.lastName].filter(Boolean).join(" ").trim()
          if (attomOwner && !ownerName) ownerName = attomOwner
          findings.push(`ATTOM Owner: ${attomOwner}`)
        }
        if (prop.owner?.mailingAddressOneLine && !mailingAddress) {
          mailingAddress = prop.owner.mailingAddressOneLine
        }
        if (prop.owner?.absenteeInd === "Y") {
          absenteeOwner = true
          motivationClues.push("Absentee owner")
        }
        if (prop.owner?.corporateIndicator === "Y") {
          corporateOwner = true
          motivationClues.push("Corporate/LLC owner")
        }

        // Sale history for ownership duration
        if (prop.sale?.saleTransDate) {
          const saleDate = new Date(prop.sale.saleTransDate)
          const years = Math.round((Date.now() - saleDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
          ownershipDuration = years <= 1 ? "Less than 1 year" : `~${years} years`
          if (years > 10) motivationClues.push(`Long-term owner (${years}yr+)`)
        }

        // Tax and assessment info
        if (prop.assessment?.tax?.taxAmt && prop.assessment.tax.taxAmt > 0) {
          findings.push(`ATTOM Tax: $${prop.assessment.tax.taxAmt.toLocaleString()}/yr (${prop.assessment.tax.taxYear})`)
        }
        if (prop.assessment?.market?.mktTtlValue) {
          findings.push(`ATTOM Market Value: $${prop.assessment.market.mktTtlValue.toLocaleString()}`)
          if (listPrice && listPrice < prop.assessment.market.mktTtlValue * 0.85) {
            motivationClues.push("Listed below assessed market value")
          }
        }

        // Property details
        const beds = prop.building?.rooms?.beds
        const baths = prop.building?.rooms?.bathsFull
        const sqft = prop.building?.size?.livingSize ?? prop.building?.size?.universalSize
        const year = prop.summary?.yearBuilt
        if (beds || baths || sqft) {
          findings.push(`ATTOM Details: ${beds ?? "?"}bd/${baths ?? "?"}ba, ${sqft ? sqft.toLocaleString() + "sqft" : "?"}, built ${year ?? "?"}`)
        }
      } else {
        findings.push("ATTOM: No property record found for this address")
      }
    } catch (err) {
      findings.push(`ATTOM: ${err instanceof Error ? err.message : "API error"}`)
    }
  } else {
    findings.push("ATTOM: API key not configured")
  }

  // --- 3. RentCast property record (supplements with last sale, owner name) ---
  if (rentcast.isConfigured()) {
    try {
      const fullAddr = `${addr.street}, ${addr.city}, ${addr.state} ${addr.zip}`.trim()
      const records = await rentcast.getPropertyRecord(fullAddr)
      sourcesUsed.push("RentCast Property Records")
      if (records && records.length > 0) {
        const rec = records[0]
        if (rec.ownerName && !ownerName) ownerName = rec.ownerName
        if (rec.lastSalePrice) {
          findings.push(`RentCast: Last sale $${rec.lastSalePrice.toLocaleString()} on ${rec.lastSaleDate ?? "unknown date"}`)
        }
        if (rec.taxAssessedValue) {
          findings.push(`RentCast: Tax assessed $${rec.taxAssessedValue.toLocaleString()}`)
        }
      } else {
        findings.push("RentCast: No property record found")
      }
    } catch (err) {
      findings.push(`RentCast: ${err instanceof Error ? err.message : "API error"}`)
    }
  } else {
    findings.push("RentCast: API key not configured")
  }

  // --- Build final result ---
  const anyData = !!(ownerName || phones.length > 0 || emails.length > 0)
  const sellerType = corporateOwner ? "Corporate/LLC Owner" : absenteeOwner ? "Absentee Owner" : ownerName ? "Owner" : "Unknown"

  const bestPhone = phones[0]?.number ?? ""
  const bestEmail = emails[0]?.address ?? ""

  let confidence = "None"
  if (phones.length > 0 && ownerName) confidence = "High"
  else if (ownerName || phones.length > 0) confidence = "Medium"
  else if (findings.some(f => f.includes("ATTOM") && !f.includes("error") && !f.includes("not configured"))) confidence = "Low"

  let skipTip = ""
  if (!anyData) {
    skipTip = `No contact info found through automated lookup. Try: 1) Search the county tax assessor site for ${addr.city}, ${addr.state}, 2) Use PropStream or BatchLeads for deeper skip tracing, 3) Check the property listing on Zillow/Redfin for agent info.`
  } else if (!phones.length && !emails.length) {
    skipTip = `Found owner name but no direct contact. Try: 1) BatchLeads or REISift skip trace for ${ownerName}, 2) Search TruePeopleSearch, 3) Send mail to ${mailingAddress || "the property address"}.`
  } else {
    skipTip = `Contact info found. Best phone: ${bestPhone}. Call during business hours. If no answer, follow up with SMS and then try email.`
  }

  return {
    success: true,
    data: {
      ...EMPTY_RESULT,
      found: anyData,
      sellerName: ownerName,
      sellerType,
      sellerPhone: bestPhone,
      sellerEmail: bestEmail,
      ownershipDuration,
      mailingAddress,
      motivationClues,
      lookupSources: sourcesUsed,
      skipTraceTip: skipTip,
      dataConfidence: confidence,
      rawFindings: findings.join("\n"),
      phones,
      emails,
    } satisfies SellerLookupResult,
  }
}
