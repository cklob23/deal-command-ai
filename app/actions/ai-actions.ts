"use server"

import { generateText, Output } from "ai"
import { z } from "zod"
import * as attom from "@/lib/api/attom"
import * as rentcast from "@/lib/api/rentcast"
import * as census from "@/lib/api/census"

// --- AI Market Research ---
const marketResearchSchema = z.object({
  msaPopulation: z.number().describe("MSA population of the metro area"),
  cityPopulation: z.number().describe("City population"),
  medianHomePrice: z.number().describe("Median home price in dollars"),
  avgDaysOnMarket: z.number().describe("Average days on market"),
  pendingToActiveRatio: z.number().describe("Pending to active listing ratio as a percentage"),
  isAttorneyState: z.boolean(),
  isNonDisclosureState: z.boolean(),
  hasWholesaleRestrictions: z.boolean(),
  wholesaleNotes: z.string().nullable().describe("Any relevant notes about wholesale regulations in this state"),
  marketTrend: z.string().describe("Brief market trend description - appreciating, stable, or declining"),
  topZipCodes: z.array(z.string()).describe("Top 3-5 zip codes for wholesaling in this market"),
  recommendedKeywords: z.array(z.string()).describe("Zillow search keywords likely to find deals in this market"),
  overallAssessment: z.string().describe("2-3 sentence overall market assessment for wholesaling"),
})

export async function aiResearchMarket(city: string, state: string) {
  // --- Gather real data from Census + RentCast ---
  const realDataParts: string[] = []
  const dataSources: string[] = []

  // 1. Census demographics (population, median home value, income)
  if (census.isConfigured()) {
    try {
      const demo = await census.getCityDemographics(city, state)
      if (demo) {
        realDataParts.push(`CENSUS DATA (${demo.source}):
- City: ${demo.cityName}
- Population: ${demo.population?.toLocaleString() ?? "N/A"}
- Median Home Value: ${demo.medianHomeValue ? "$" + demo.medianHomeValue.toLocaleString() : "N/A"}
- Median Household Income: ${demo.medianHouseholdIncome ? "$" + demo.medianHouseholdIncome.toLocaleString() : "N/A"}`)
        dataSources.push(demo.source)
      }
    } catch (err) {
      realDataParts.push(`Census API error: ${err instanceof Error ? err.message : "unknown"}`)
    }
  }

  // 2. RentCast market data (need zip codes -- try common ones for the city)
  if (rentcast.isConfigured()) {
    try {
      // Try to get market data. We'll use a top zip code if the AI provides one later.
      // For now, we fetch a few listings to get zip codes and aggregate stats.
      const listings = await rentcast.getSaleListings(city, state, {
        propertyType: "Single Family",
        status: "Active",
        limit: 20,
      })
      if (listings && listings.length > 0) {
        const prices = listings.filter(l => l.price).map(l => l.price!)
        const doms = listings.filter(l => l.daysOnMarket != null).map(l => l.daysOnMarket!)
        const avgPrice = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length)
        const medPrice = prices.sort((a, b) => a - b)[Math.floor(prices.length / 2)]
        const avgDOM = doms.length > 0 ? Math.round(doms.reduce((a, b) => a + b, 0) / doms.length) : null
        const zips = [...new Set(listings.map(l => l.zipCode).filter(Boolean))]

        realDataParts.push(`RENTCAST LIVE MARKET DATA (${listings.length} active SFR listings):
- Average List Price: $${avgPrice.toLocaleString()}
- Median List Price: $${medPrice?.toLocaleString() ?? "N/A"}
- Average Days on Market: ${avgDOM ?? "N/A"}
- Total Active Listings Sampled: ${listings.length}
- Zip Codes Found: ${zips.join(", ")}`)
        dataSources.push(`RentCast (${listings.length} listings)`)

        // Try to get zip-level market data for the first zip
        if (zips[0]) {
          try {
            const mkt = await rentcast.getMarketData(zips[0])
            if (mkt?.saleData) {
              realDataParts.push(`RENTCAST ZIP ${zips[0]} MARKET STATS:
- Avg Price: ${mkt.saleData.averagePrice ? "$" + mkt.saleData.averagePrice.toLocaleString() : "N/A"}
- Median Price: ${mkt.saleData.medianPrice ? "$" + mkt.saleData.medianPrice.toLocaleString() : "N/A"}
- Avg DOM: ${mkt.saleData.averageDaysOnMarket ?? "N/A"}
- Total Listings: ${mkt.saleData.totalListings ?? "N/A"}
- Avg Price/SqFt: ${mkt.saleData.averagePricePerSquareFoot ? "$" + mkt.saleData.averagePricePerSquareFoot.toFixed(0) : "N/A"}`)
            }
            if (mkt?.rentalData) {
              realDataParts.push(`RENTCAST ZIP ${zips[0]} RENTAL DATA:
- Avg Rent: ${mkt.rentalData.averageRent ? "$" + mkt.rentalData.averageRent.toLocaleString() : "N/A"}
- Median Rent: ${mkt.rentalData.medianRent ? "$" + mkt.rentalData.medianRent.toLocaleString() : "N/A"}`)
            }
          } catch { /* zip market data optional */ }
        }
      }
    } catch (err) {
      realDataParts.push(`RentCast API error: ${err instanceof Error ? err.message : "unknown"}`)
    }
  }

  const realDataBlock = realDataParts.length > 0
    ? `\n\nVERIFIED REAL DATA (use these numbers as ground truth, do NOT override them with guesses):\n${realDataParts.join("\n\n")}\nData Sources: ${dataSources.join(", ")}`
    : "\n\nNote: No live API data available. Use your best knowledge of current market conditions."

  try {
    const { output } = await generateText({
      model: "openai/gpt-4o-mini",
      output: Output.object({ schema: marketResearchSchema }),
      prompt: `You are a real estate wholesaling market research analyst. Research the following market for wholesale real estate investing viability.

Market: ${city}, ${state}
${realDataBlock}

INSTRUCTIONS:
- If VERIFIED REAL DATA is provided above, USE those exact numbers for population, median home price, and income. Do NOT substitute your own estimates.
- Supplement the real data with your knowledge for fields not covered (attorney state, wholesale restrictions, top zip codes, etc.)
- If no real data is provided, use your best estimates but note they are estimates.

Key criteria for ideal wholesaling markets:
- MSA Population > 400,000
- City Population > 100,000
- Median Home Price $200,000-$400,000
- Average Days on Market < 50
- Pending to Active Ratio > 25%

Also identify:
- Whether this is an attorney state for real estate closings
- Whether this is a non-disclosure state
- Any wholesale restrictions or regulations
- Top zip codes for finding wholesale deals
- Recommended Zillow keywords for this specific market
- Overall assessment of the market for wholesaling`,
    })
    return { success: true, data: output, dataSources }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "AI research failed" }
  }
}

// --- AI Property Analysis ---
const propertyAnalysisSchema = z.object({
  estimatedARV: z.number().describe("Estimated After Repair Value"),
  estimatedRepairCost: z.number().describe("Estimated repair costs based on condition"),
  recommendedOfferRange: z.object({
    low: z.number(),
    high: z.number(),
  }),
  propertyStrengths: z.array(z.string()).describe("Positive aspects of this deal"),
  propertyRisks: z.array(z.string()).describe("Risk factors to consider"),
  motivatedSellerScore: z.number().describe("1-10 score based on listing indicators"),
  suggestedBuyerType: z.string().describe("Best buyer type: Cash Buyer, BRRRR, Fix & Flip, Buy & Hold"),
  negotiationTips: z.array(z.string()).describe("Specific negotiation tips for this property"),
  dealVerdict: z.string().describe("GO, CAUTION, or PASS with brief explanation"),
})

export async function aiAnalyzeProperty(
  address: string,
  listPrice: number,
  zestimate: number,
  condition: string,
  keywords: string[],
  dom: number,
  marketMedian: number
) {
  try {
    const { output } = await generateText({
      model: "openai/gpt-4o-mini",
      output: Output.object({ schema: propertyAnalysisSchema }),
      prompt: `You are an expert real estate wholesaling deal analyst. Analyze this property for wholesale potential.

Property: ${address}
List Price: $${listPrice.toLocaleString()}
Zestimate: $${zestimate.toLocaleString()}
Condition Notes: ${condition || "Unknown"}
Keywords Found: ${keywords.join(", ") || "None"}
Days on Market: ${dom}
Market Median Price: $${marketMedian.toLocaleString()}

Using the 70% rule (MAO = ARV x 70% - Repairs), analyze this deal.
The 80% qualifier (list price x 80%) is used as the initial contact price to test if the agent will negotiate.
The asking price must be at or below 90% of Zestimate to qualify for the Partner Program.

Provide realistic estimates and actionable analysis.`,
    })
    return { success: true, data: output }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "AI analysis failed" }
  }
}

// --- AI Lead Qualification ---
const leadQualificationSchema = z.object({
  qualificationSummary: z.string().describe("Brief summary of lead quality"),
  motivationAnalysis: z.string().describe("Analysis of seller motivation based on indicators"),
  suggestedApproach: z.string().describe("Best approach for contacting this seller"),
  urgencyLevel: z.string().describe("HIGH, MEDIUM, or LOW"),
  estimatedCloseTimeline: z.string().describe("Estimated timeline to close"),
  partnerProgramFit: z.boolean().describe("Whether this lead fits Partner Program criteria"),
  partnerProgramIssues: z.array(z.string()).describe("Any Partner Program compliance issues"),
  followUpStrategy: z.string().describe("Recommended follow-up strategy"),
  talkingPoints: z.array(z.string()).describe("Key talking points for the call"),
})

export async function aiQualifyLead(
  sellerInfo: string,
  propertyDetails: string,
  motivationIndicators: string[],
  askingPrice: number,
  zestimate: number,
  state: string
) {
  try {
    const { output } = await generateText({
      model: "openai/gpt-4o-mini",
      output: Output.object({ schema: leadQualificationSchema }),
      prompt: `You are an expert wholesale real estate lead qualifier for the REI GameChangers Partner Program.

Seller Info: ${sellerInfo}
Property Details: ${propertyDetails}
Motivation Indicators: ${motivationIndicators.join(", ")}
Asking Price: $${askingPrice.toLocaleString()}
Zestimate: $${zestimate.toLocaleString()}
Price to Zestimate Ratio: ${((askingPrice / zestimate) * 100).toFixed(1)}%
State: ${state}

Partner Program Rules:
1. MSA > 400k, City > 100k, Median $200k-$400k, DOM < 50, Pending > 25%
2. Must SPEAK to and qualify lead before submitting
3. Seller must actually want to sell
4. Asking price must be <= 90% of Zestimate
5. Cannot be FSBO or MLS listed
6. Cannot be under contract with another wholesaler
7. Cannot be in OR, IL, SC, PA (restricted states)
8. Must schedule appointment via Partner Program calendar

Disqualification reasons:
- Not the owner
- Property in non-qualifying market
- Listed FSBO or MLS
- Under contract with another wholesaler
- Doesn't want to sell
- Not selling within 90 days
- Asking > 90% Zestimate and won't negotiate

Provide thorough qualification analysis.`,
    })
    return { success: true, data: output }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "AI qualification failed" }
  }
}

// --- AI Outreach Generator ---
const outreachSchema = z.object({
  coldCallScript: z.string().describe("Full cold call script personalized to this lead"),
  smsTemplate: z.string().describe("SMS message template"),
  emailTemplate: z.string().describe("Full email template with subject line"),
  agentScript: z.string().describe("Script for contacting listing agent"),
  zillowOfferMessage: z.string().describe("Zillow direct offer message"),
  followUpSMS: z.string().describe("Follow-up SMS if no response"),
  followUpEmail: z.string().describe("Follow-up email if no response"),
  voicemailScript: z.string().describe("Voicemail drop script"),
})

export async function aiGenerateOutreach(
  yourName: string,
  sellerName: string,
  address: string,
  listPrice: number,
  offerPrice: number,
  motivationLevel: string,
  leadSource: string
) {
  try {
    const { output } = await generateText({
      model: "openai/gpt-4o-mini",
      output: Output.object({ schema: outreachSchema }),
      prompt: `You are a wholesale real estate outreach copywriter. Generate personalized outreach scripts.

Your Name: ${yourName || "[Your Name]"}
Seller/Agent Name: ${sellerName || "Homeowner"}
Property Address: ${address}
List Price: $${listPrice.toLocaleString()}
Offer Price: $${offerPrice.toLocaleString()} (80% qualifier - NOT the actual offer, just to test if they'll negotiate)
Seller Motivation: ${motivationLevel}
Lead Source: ${leadSource}

IMPORTANT RULES:
- Do NOT say your last name or company name on initial calls
- If asked about company: "Oh, I'm not with a company, I'm just a local investor"
- The 80% number is a QUALIFIER, not the actual offer
- Always mention: we buy AS-IS and pay ALL closing costs
- Ask seller to rate motivation 1-10 (10 = would sell today)
- Always ask for their desired price range
- Mention flexible closing timeline up to 6 months

Generate natural, conversational scripts that build rapport and qualify the seller.`,
    })
    return { success: true, data: output }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "AI generation failed" }
  }
}

// --- AI Dispo Marketing ---
const dispoMarketingSchema = z.object({
  zillowDiscountAd: z.string().describe("Ad highlighting discount below Zillow price"),
  rentalROIAd: z.string().describe("Ad targeting rental investors with ROI numbers"),
  fbGroupPost: z.string().describe("Facebook investor group post"),
  emailBlastCopy: z.string().describe("Email blast to buyer list"),
  realtorPitch: z.string().describe("Pitch for investor-friendly realtors"),
  turnkeyAd: z.string().describe("Ad targeting out-of-state turnkey buyers"),
  brrrAd: z.string().describe("Ad targeting BRRRR strategy investors"),
  objectionHandlers: z.array(z.object({
    objection: z.string(),
    response: z.string(),
  })).describe("Common buyer objections with responses"),
})

export async function aiGenerateDispoMarketing(
  address: string,
  contractPrice: number,
  assignmentPrice: number,
  arv: number,
  repairCost: number,
  monthlyRent: number,
  zillowPrice: number,
  propertyDetails: string
) {
  try {
    const { output } = await generateText({
      model: "openai/gpt-4o-mini",
      output: Output.object({ schema: dispoMarketingSchema }),
      prompt: `You are a wholesale real estate disposition marketing expert. Generate buyer-facing marketing materials.

Property: ${address}
Contract Price: $${contractPrice.toLocaleString()}
Assignment Price: $${assignmentPrice.toLocaleString()}
Assignment Fee: $${(assignmentPrice - contractPrice).toLocaleString()}
ARV: $${arv.toLocaleString()}
Estimated Repairs: $${repairCost.toLocaleString()}
Monthly Rent Comps: $${monthlyRent.toLocaleString()}
Zillow Listed Price: $${zillowPrice.toLocaleString()}
Property Details: ${propertyDetails}

MARKETING STRATEGY:
- Don't hide the Zillow listing - highlight the DISCOUNT
- Use "Discounted Below Zillow" as the hook
- Screenshot the Zillow listing price comparison
- Target: cash buyers, out-of-state landlords, LLC buyers, fix & flippers, BRRRR investors
- Include compelling CTAs
- Handle the "But it's on Zillow" objection confidently

Generate compelling, professional marketing copy.`,
    })
    return { success: true, data: output }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "AI dispo generation failed" }
  }
}

// --- AI Property Scout (finds actual properties to pursue) ---
const propertyScoutSchema = z.object({
  properties: z.array(z.object({
    address: z.string().describe("Full property address"),
    city: z.string(),
    state: z.string(),
    zipCode: z.string(),
    estimatedListPrice: z.number().describe("Estimated or typical list price"),
    estimatedARV: z.number().describe("Estimated after-repair value"),
    estimatedRepairs: z.number().describe("Estimated repair costs"),
    estimatedMAO: z.number().describe("Maximum allowable offer using 70% rule"),
    estimatedSpread: z.number().describe("Estimated wholesale spread/profit"),
    propertyType: z.string().describe("SFR, Multi-family, Townhome, etc."),
    beds: z.number(),
    baths: z.number(),
    sqft: z.number(),
    yearBuilt: z.number(),
    condition: z.string().describe("Estimated condition: Distressed, Fair, Good"),
    motivatedSellerSignals: z.array(z.string()).describe("Why this property looks like a deal"),
    whyGoodDeal: z.string().describe("1-2 sentence explanation of why this is a strong wholesale opportunity"),
    recommendedOfferRange: z.object({
      low: z.number(),
      high: z.number(),
    }),
    zillowSearchUrl: z.string().describe("Zillow search URL to find this type of property"),
    realtorSearchUrl: z.string().describe("Realtor.com search URL with filters"),
    redfinSearchUrl: z.string().describe("Redfin search URL with filters"),
    urgency: z.string().describe("HIGH, MEDIUM, or LOW - how quickly to act"),
    sellerType: z.string().describe("Owner-occupied, Absentee Owner, Estate/Probate, Bank-Owned, Agent-Listed"),
    likelySellerName: z.string().describe("Realistic seller or listing agent name for this type of property"),
    likelyAgentName: z.string().describe("Realistic listing agent name if agent-listed, otherwise empty string"),
    estimatedDOM: z.number().describe("Estimated days on market"),
    listingStatus: z.string().describe("Active, Price Reduced, Back on Market, Pending, etc."),
  })).describe("5-10 realistic property opportunities matching the market criteria"),
  marketSummary: z.string().describe("2-3 sentence summary of the scouting results"),
  bestZipCodes: z.array(z.string()).describe("Top 3 zip codes to focus on"),
  searchTips: z.array(z.string()).describe("3-5 tips for finding these deals on listing sites"),
})

export async function aiScoutProperties(
  city: string,
  state: string,
  searchType: "houses" | "land",
  medianPrice: number,
  targetZipCodes: string[],
  keywords: string[],
  priceMin: number,
  priceMax: number,
  daysOnMarket?: string,
  // Land-specific
  landUse?: string,
  minAcres?: number,
  maxAcres?: number
) {
  const isLand = searchType === "land"

  // --- Try real data from RentCast + ATTOM first ---
  let realListings: Array<Record<string, unknown>> = []
  let usedRealData = false
  const dataSource: string[] = []

  // 1. RentCast active sale listings
  if (rentcast.isConfigured()) {
    try {
      const listings = await rentcast.getSaleListings(city, state, {
        propertyType: isLand ? undefined : "Single Family",
        status: "Active",
        minPrice: priceMin || undefined,
        maxPrice: priceMax || undefined,
        daysOld: daysOnMarket ? `${daysOnMarket}:*` : "30:*",
        limit: 20,
      })
      if (listings && listings.length > 0) {
        realListings = listings.map((l) => ({ ...l, _source: "rentcast" }))
        dataSource.push(`RentCast (${listings.length} listings)`)
        usedRealData = true
      }
    } catch (err) {
      console.error("[v0] RentCast listing fetch failed:", err)
    }
  }

  // 2. Supplement with ATTOM snapshot if we have few results
  if (attom.isConfigured() && realListings.length < 5) {
    try {
      const props = await attom.searchProperties(city, state, {
        minPrice: priceMin || undefined,
        maxPrice: priceMax || undefined,
        propertyType: isLand ? undefined : "SFR",
        pagesize: 20,
      })
      if (props && props.length > 0) {
        // Only add ATTOM properties not already from RentCast (avoid dups by address)
        const existingAddrs = new Set(realListings.map((l) => String(l.addressLine1 ?? l.formattedAddress ?? "").toLowerCase()))
        for (const p of props) {
          const addr = p.address?.line1?.toLowerCase() ?? ""
          if (!existingAddrs.has(addr)) {
            realListings.push({ ...p, _source: "attom" })
            existingAddrs.add(addr)
          }
        }
        dataSource.push(`ATTOM (${props.length} properties)`)
        usedRealData = true
      }
    } catch (err) {
      console.error("[v0] ATTOM property search failed:", err)
    }
  }

  // --- If we have real data, use AI to analyze/rank it ---
  if (usedRealData && realListings.length > 0) {
    try {
      const listingsSummary = realListings.slice(0, 20).map((l, i) => {
        // Normalize between RentCast and ATTOM shapes
        const src = l._source as string
        if (src === "rentcast") {
          return `${i + 1}. ${l.formattedAddress || l.addressLine1}, ${l.city} ${l.state} ${l.zipCode} | $${(l.price as number || 0).toLocaleString()} | ${l.bedrooms ?? "?"}bd/${l.bathrooms ?? "?"}ba | ${l.squareFootage ?? "?"}sqft | Built ${l.yearBuilt ?? "?"} | DOM: ${l.daysOnMarket ?? "?"} | Status: ${l.status} | Type: ${l.propertyType}`
        } else {
          const ap = l as unknown as import("@/lib/api/attom").AttomProperty & { _source: string }
          return `${i + 1}. ${ap.address?.oneLine || ap.address?.line1} | Market Value: $${(ap.assessment?.market?.mktTtlValue || 0).toLocaleString()} | ${ap.building?.rooms?.beds ?? "?"}bd/${ap.building?.rooms?.bathsFull ?? "?"}ba | ${ap.building?.size?.livingSize ?? "?"}sqft | Built ${ap.summary?.yearBuilt ?? "?"} | Owner: ${[ap.owner?.owner1?.firstNameAndMi, ap.owner?.owner1?.lastName].filter(Boolean).join(" ") || "?"} | Absentee: ${ap.owner?.absenteeInd ?? "?"}`
        }
      }).join("\n")

      const { output } = await generateText({
        model: "openai/gpt-4o-mini",
        output: Output.object({ schema: propertyScoutSchema }),
        prompt: `You are an expert real estate wholesaling deal analyst. Below are REAL properties from ${city}, ${state} pulled from live data APIs (${dataSource.join(", ")}). Analyze each one for wholesale potential.

REAL PROPERTY DATA:
${listingsSummary}

Market Median Price: $${medianPrice.toLocaleString()}
Target Zip Codes: ${targetZipCodes.join(", ") || "Any"}
Motivated Seller Keywords: ${keywords.join(", ") || "as-is, fixer-upper, motivated, price reduced"}
Price Range: $${priceMin.toLocaleString()} - $${priceMax.toLocaleString()}

For EACH real property above:
1. Use the EXACT address from the data -- do NOT change or invent addresses
2. Use the EXACT price, beds, baths, sqft, year built from the data
3. Estimate ARV (typically 10-30% above list price for distressed, at market for good condition)
4. Estimate repair costs based on age, price relative to market, and condition clues
5. Calculate MAO = ARV * 0.70 - Repairs
6. Calculate spread = MAO - list price (positive = potential profit)
7. Analyze why it may or may not be a good wholesale deal
8. Generate view listing URLs using the real address

Rank the best wholesale opportunities first. Only include properties where spread > 0.
If a property doesn't look like a good deal, still include it but mark urgency as LOW.

These are REAL listings from live APIs -- every address is verified real.`,
      })
      return { success: true, data: output, realData: true, sources: dataSource }
    } catch (error) {
      console.error("[v0] AI analysis of real listings failed:", error)
      // Fall through to AI generation
    }
  }

  // --- Fallback: AI-generated simulated leads ---
  try {
    const seed = Math.random().toString(36).slice(2, 10)
    const randomStreetNumbers = Array.from({ length: 10 }, () => Math.floor(Math.random() * 9000) + 100)
    const { output } = await generateText({
      model: "openai/gpt-4o-mini",
      output: Output.object({ schema: propertyScoutSchema }),
      prompt: `You are an expert real estate wholesaling property scout. Generate simulated property leads for practice.

RANDOMIZATION SEED: ${seed}
Use these as starting street numbers: ${randomStreetNumbers.join(", ")}

Target Market: ${city}, ${state}
Search Type: ${isLand ? "VACANT LAND / LOTS" : "HOUSES / RESIDENTIAL"}
Market Median Price: $${medianPrice.toLocaleString()}
Target Zip Codes: ${targetZipCodes.join(", ") || "Any in the market"}
Price Range: $${priceMin.toLocaleString()} - $${priceMax.toLocaleString()}
Days on Market Filter: ${daysOnMarket || "30+ days"}
${isLand ? `Land Use: ${landUse || "Any"}\nAcreage Range: ${minAcres || 0.25} - ${maxAcres || 10} acres` : ""}

IMPORTANT: Real listing APIs were unavailable. Generate 5-10 SIMULATED leads using real street names from ${city}, ${state}. Use the seed for variety. Each property notes should say "AI-SIMULATED - verify on listing sites before contacting".

Calculate MAO = ARV * 0.70 - Repairs. Calculate spread = MAO - list price.
Make properties diverse: different neighborhoods, prices, conditions, seller types.`,
    })
    return { success: true, data: output, realData: false, sources: ["AI-Simulated (API keys not configured or no results)"] }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "AI property scout failed" }
  }
}

// --- AI Automated Outreach Email Generator ---
const automatedOutreachSchema = z.object({
  emails: z.array(z.object({
    subject: z.string(),
    body: z.string(),
    type: z.string().describe("initial, follow-up-1, follow-up-2, final"),
    sendDelay: z.string().describe("When to send: immediately, +2 days, +5 days, +10 days"),
  })),
  smsMessages: z.array(z.object({
    message: z.string(),
    type: z.string().describe("initial, follow-up-1, follow-up-2"),
    sendDelay: z.string().describe("When to send: immediately, +1 day, +3 days"),
  })),
  callScript: z.string().describe("Cold call script for this specific property"),
})

export async function aiGenerateAutomatedOutreach(
  yourName: string,
  propertyAddress: string,
  estimatedPrice: number,
  offerRange: { low: number; high: number },
  sellerSignals: string[],
  searchType: "houses" | "land"
) {
  try {
    const { output } = await generateText({
      model: "openai/gpt-4o-mini",
      output: Output.object({ schema: automatedOutreachSchema }),
      prompt: `You are a wholesale real estate outreach specialist. Generate a complete automated outreach sequence for a potential property deal.

Your Name: ${yourName || "[Your Name]"}
Property: ${propertyAddress}
Estimated Price: $${estimatedPrice.toLocaleString()}
Offer Range: $${offerRange.low.toLocaleString()} - $${offerRange.high.toLocaleString()}
Property Type: ${searchType === "land" ? "Vacant Land" : "House"}
Motivated Seller Signals: ${sellerSignals.join(", ")}

Generate:
1. A 4-email drip sequence (initial + 3 follow-ups with increasing urgency)
2. A 3-SMS sequence (initial + 2 follow-ups)
3. A cold call script

RULES:
- Be conversational and professional
- Don't mention "wholesale" - say "cash buyer" or "investor"
- Emphasize: AS-IS purchase, ALL closing costs paid, flexible timeline
- Initial contact should be soft and friendly
- Follow-ups should increase urgency gradually
- Include property-specific details to show genuine interest
- For land: mention intended use research, survey willingness
- Never reveal last name or company on first contact`,
    })
    return { success: true, data: output }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "AI outreach generation failed" }
  }
}

// --- AI Zillow Property Finder ---
const propertyFinderSchema = z.object({
  searchStrategy: z.string().describe("Recommended Zillow search strategy for this market"),
  zillowFilters: z.object({
    priceMax: z.number(),
    priceMin: z.number(),
    homeTypes: z.array(z.string()),
    keywords: z.array(z.string()),
    daysOnZillow: z.string().describe("Recommended DOM filter"),
  }),
  targetZipCodes: z.array(z.object({
    zip: z.string(),
    reason: z.string(),
  })),
  redFlagIndicators: z.array(z.string()).describe("Listing red flags to watch for"),
  dealIndicators: z.array(z.string()).describe("Signs of a good wholesale deal"),
  dailyRoutine: z.array(z.string()).describe("Step-by-step daily Zillow hunting routine"),
  estimatedDealsPerMonth: z.number().describe("Estimated findable deals per month with this strategy"),
})

export async function aiFindProperties(city: string, state: string, medianPrice: number) {
  try {
    const { output } = await generateText({
      model: "openai/gpt-4o-mini",
      output: Output.object({ schema: propertyFinderSchema }),
      prompt: `You are a Zillow deal-finding strategist for wholesale real estate. Create a property finding strategy.

Target Market: ${city}, ${state}
Market Median Price: $${medianPrice.toLocaleString()}

Based on the Zillow strategy:
1. Set filters for properties below market value
2. Use motivated seller keywords: fixer-upper, needs work, motivated seller, cash only, as-is, handyman special
3. Save searches and enable email alerts
4. Target properties listed 30+ days (motivated sellers)
5. Look for listings at 80% or less of comparable values

Create a comprehensive Zillow property finding strategy for this specific market including ideal zip codes, price ranges, keywords, and a daily execution routine.`,
    })
    return { success: true, data: output }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "AI property finder failed" }
  }
}

// --- AI Land / Vacant Lot Finder ---
const landFinderSchema = z.object({
  searchStrategy: z.string().describe("Overall strategy for finding profitable vacant land in this market"),
  zillowFilters: z.object({
    priceMax: z.number(),
    priceMin: z.number(),
    lotSizeMin: z.number().describe("Minimum lot size in acres"),
    lotSizeMax: z.number().describe("Maximum lot size in acres"),
    keywords: z.array(z.string()).describe("Zillow search keywords for land deals"),
    daysOnZillow: z.string().describe("Recommended DOM filter"),
  }),
  targetZipCodes: z.array(z.object({
    zip: z.string(),
    reason: z.string(),
  })),
  landTypes: z.array(z.object({
    type: z.string().describe("e.g. Infill lots, Rural acreage, Subdivision-ready, etc."),
    avgPrice: z.number(),
    bestUse: z.string().describe("Best exit strategy for this land type"),
    demandLevel: z.string().describe("HIGH, MEDIUM, or LOW"),
  })),
  exitStrategies: z.array(z.object({
    strategy: z.string(),
    description: z.string(),
    estimatedMargin: z.string(),
    timeframe: z.string(),
  })),
  redFlagIndicators: z.array(z.string()).describe("Red flags when evaluating vacant land"),
  dealIndicators: z.array(z.string()).describe("Signs of a good land deal"),
  dueDiligenceChecklist: z.array(z.string()).describe("Due diligence items to check before buying land"),
  dailyRoutine: z.array(z.string()).describe("Step-by-step daily land hunting routine"),
  estimatedDealsPerMonth: z.number().describe("Estimated findable land deals per month"),
  marketInsights: z.string().describe("2-3 sentences on the land market conditions in this area - growth, development, demand drivers"),
})

// --- AI Seller / Agent Info Lookup ---
const sellerLookupSchema = z.object({
  sellerName: z.string().describe("Most likely property owner name based on public records patterns"),
  sellerType: z.string().describe("Owner-Occupied, Absentee Owner, Estate/Probate, Bank-Owned, Corporate, Agent-Listed"),
  agentName: z.string().describe("Listing agent name if the property appears agent-listed, otherwise empty"),
  agentBrokerage: z.string().describe("Brokerage name if agent-listed, otherwise empty"),
  agentPhone: z.string().describe("Realistic agent phone number for this market area code"),
  agentEmail: z.string().describe("Realistic agent email format like firstname.lastname@brokerage.com"),
  sellerPhone: z.string().describe("Estimated phone number for the property owner if FSBO, otherwise empty"),
  sellerEmail: z.string().describe("Estimated email if available from public records patterns, otherwise empty"),
  ownershipDuration: z.string().describe("Estimated how long they have owned the property"),
  motivationClues: z.array(z.string()).describe("Clues about seller motivation based on property/market data"),
  lookupSources: z.array(z.string()).describe("Where to actually find verified seller info: county records, tax assessor, skip tracing services"),
  skipTraceTip: z.string().describe("Specific skip tracing recommendation for this lead"),
})

export async function aiLookupSellerInfo(
  address: string,
  city: string,
  state: string,
  listPrice?: number,
  propertyType?: string,
  daysOnMarket?: number,
) {
  try {
    const { output } = await generateText({
      model: "openai/gpt-4o-mini",
      output: Output.object({ schema: sellerLookupSchema }),
      prompt: `You are a real estate skip tracing and lead research expert. Based on the property details provided, generate the most likely seller/agent contact information.

Property: ${address}, ${city}, ${state}
List Price: ${listPrice ? "$" + listPrice.toLocaleString() : "Unknown"}
Property Type: ${propertyType || "Single Family"}
Days on Market: ${daysOnMarket || "Unknown"}

IMPORTANT: You cannot access real databases, but you should:
1. Generate REALISTIC contact info based on typical patterns for this type of property and market
2. Use the correct area code for ${city}, ${state}
3. Generate a realistic agent name and brokerage common to that market
4. Determine the most likely seller type based on the property characteristics
5. Provide specific skip tracing recommendations and public record lookup sources
6. If the property looks agent-listed (typical price, normal DOM), provide agent info
7. If it looks FSBO or distressed, provide seller info directly
8. Include real lookup sources like the county tax assessor website, county clerk, PropStream, BatchLeads, etc.

Format phone numbers as (XXX) XXX-XXXX using the correct area code for this city.
Format emails realistically based on common patterns.`,
    })
    return { success: true, data: output }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Seller lookup failed" }
  }
}

export async function aiFindLand(
  city: string,
  state: string,
  maxPrice: number,
  landUse: string,
  minAcres: number,
  maxAcres: number
) {
  try {
    const { output } = await generateText({
      model: "openai/gpt-4o-mini",
      output: Output.object({ schema: landFinderSchema }),
      prompt: `You are a vacant land investing strategist specializing in finding profitable land deals for wholesale and flip.

Target Market: ${city}, ${state}
Max Budget: $${maxPrice.toLocaleString()}
Preferred Land Use: ${landUse || "Any"}
Acreage Range: ${minAcres} - ${maxAcres} acres

Research this market for vacant land wholesale and flip opportunities. Consider:

1. LAND SOURCING:
   - Zillow "Lots/Land" filter settings
   - Keywords: "owner financing", "motivated", "below market", "must sell", "price reduced", "back taxes"
   - Look for tax-delinquent parcels, absentee owners, inherited lots
   - Target land listed 60+ days (more negotiable sellers)

2. EXIT STRATEGIES for land:
   - Wholesale assign to builders/developers
   - Sell with owner financing (higher total price)
   - Subdivide and sell individual lots
   - Entitle/rezone and sell at premium
   - Sell to neighboring property owners
   - List on land-specific marketplaces (LandWatch, Lands of America, LandFlip)

3. LAND VALUATION:
   - Compare price per acre to recent vacant land comps
   - Check zoning and permitted uses
   - Verify utilities access (water, sewer, electric)
   - Check flood zone status
   - Verify road access (paved vs dirt)
   - Look at surrounding development and growth patterns

4. DUE DILIGENCE:
   - Title search for liens/encumbrances
   - Tax status (current or delinquent)
   - Environmental concerns (wetlands, contamination)
   - HOA restrictions
   - Easements and right-of-ways
   - Survey requirements

Provide a comprehensive land-finding strategy with realistic zip codes, price ranges, and deal estimates for this specific market.`,
    })
    return { success: true, data: output }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "AI land finder failed" }
  }
}
