// ============================================================
// DealCommand - Wholesaling Engine
// Core logic for market analysis, deal scoring, qualification
// ============================================================

// --- Types ---

export interface MarketData {
  city: string
  state: string
  msa: number
  cityPop: number
  medianPrice: number
  dom: number
  pendingRatio: number
}

export interface MarketScore {
  status: "ideal" | "borderline" | "disqualified"
  score: number
  flags: string[]
  passed: string[]
}

export interface DealInput {
  address: string
  listPrice: number
  zestimate: number
  repairEstimate: number
  arv: number
  keywords: string[]
  dom: number
  sellerMotivation: number
}

export interface DealAnalysis {
  qualifierPrice80: number
  zestimateCheck90: number
  mao: number
  spreadPotential: number
  motivationScore: number
  passesZestimateRule: boolean
  flags: string[]
}

export interface LeadQualification {
  qualified: boolean
  reasons: string[]
  passedChecks: string[]
  badge: "eligible" | "ineligible" | "manual-review"
}

export interface KPIData {
  marketsTested: number
  dealsAnalyzed: number
  qualifiedLeads: number
  partnerSubmissions: number
  estimatedSpread: number
  buyerContacts: number
}

// --- Constants ---

export const RESTRICTED_STATES: Record<string, string> = {
  SC: "South Carolina - Wholesale restrictions",
  OR: "Oregon - Wholesale restrictions",
  PA: "Pennsylvania - Attorney state restrictions",
  IL: "Illinois - Wholesale restrictions apply",
}

export const ATTORNEY_STATES = [
  "CT", "DE", "GA", "MA", "ME", "NH", "NJ", "NY", "NC", "ND",
  "RI", "SC", "VT", "VA", "WV"
]

export const NON_DISCLOSURE_STATES = [
  "AK", "ID", "KS", "LA", "ME", "MS", "MO", "MT", "NM",
  "ND", "TX", "UT", "WY"
]

export const MOTIVATED_KEYWORDS = [
  "fixer-upper", "needs work", "motivated seller", "cash only",
  "as-is", "handyman special", "investor special", "below market",
  "price reduced", "must sell", "estate sale", "bank owned",
  "foreclosure", "short sale", "distressed", "vacant",
  "fire damage", "water damage", "needs rehab", "tlc needed"
]

export const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"
]

// --- Market Engine ---

export function evaluateMarket(data: MarketData): MarketScore {
  const flags: string[] = []
  const passed: string[] = []
  let score = 0

  // MSA > 400k
  if (data.msa > 400000) {
    score += 20
    passed.push("MSA population > 400k")
  } else {
    flags.push("MSA population below 400k threshold")
  }

  // City pop > 100k
  if (data.cityPop > 100000) {
    score += 20
    passed.push("City population > 100k")
  } else {
    flags.push("City population below 100k threshold")
  }

  // Median price $200k-$400k
  if (data.medianPrice >= 200000 && data.medianPrice <= 400000) {
    score += 20
    passed.push("Median price in $200k-$400k range")
  } else if (data.medianPrice < 200000) {
    flags.push("Median price below $200k")
  } else {
    flags.push("Median price above $400k")
  }

  // DOM < 50
  if (data.dom < 50) {
    score += 20
    passed.push("DOM under 50 days")
  } else {
    flags.push("DOM exceeds 50 days")
  }

  // Pending ratio > 25%
  if (data.pendingRatio > 25) {
    score += 20
    passed.push("Pending ratio above 25%")
  } else {
    flags.push("Pending ratio below 25%")
  }

  // Check restricted states
  if (RESTRICTED_STATES[data.state]) {
    flags.push(RESTRICTED_STATES[data.state])
    score = Math.max(0, score - 30)
  }

  if (ATTORNEY_STATES.includes(data.state)) {
    flags.push("Attorney state - additional legal costs")
  }

  if (NON_DISCLOSURE_STATES.includes(data.state)) {
    flags.push("Non-disclosure state - limited comp data")
  }

  let status: MarketScore["status"] = "ideal"
  if (score < 40 || RESTRICTED_STATES[data.state]) {
    status = "disqualified"
  } else if (score < 70) {
    status = "borderline"
  }

  return { status, score, flags, passed }
}

// --- Deal Analyzer ---

export function analyzeDeal(input: DealInput): DealAnalysis {
  const flags: string[] = []
  const qualifierPrice80 = input.listPrice * 0.8
  const zestimateCheck90 = input.zestimate * 0.9
  const mao = (input.arv * 0.7) - input.repairEstimate
  const spreadPotential = mao - qualifierPrice80

  const passesZestimateRule = input.listPrice <= zestimateCheck90

  if (!passesZestimateRule) {
    flags.push("List price exceeds 90% of Zestimate")
  }

  if (input.dom > 60) {
    flags.push("DOM exceeds 60 days - potential stale listing")
  } else if (input.dom > 30) {
    flags.push("DOM between 30-60 days - moderate")
  }

  if (spreadPotential < 5000) {
    flags.push("Spread potential below $5,000 minimum")
  }

  const keywordHits = input.keywords.filter(k =>
    MOTIVATED_KEYWORDS.some(mk => mk.toLowerCase() === k.toLowerCase())
  )

  if (keywordHits.length === 0) {
    flags.push("No motivated seller keywords detected")
  }

  // Motivation score is user-supplied but we validate it
  const motivationScore = Math.min(10, Math.max(1, input.sellerMotivation))

  return {
    qualifierPrice80,
    zestimateCheck90,
    mao: Math.max(0, mao),
    spreadPotential,
    motivationScore,
    passesZestimateRule,
    flags,
  }
}

// --- Lead Qualification ---

export function qualifyLead(input: {
  isOwner: boolean
  isMotivated: boolean
  isListedFSBO: boolean
  isListedMLS: boolean
  isUnderContract: boolean
  askingPriceRatio: number // asking / zestimate
  sellerMotivation: number
  saleTimeline: number // days
  state: string
}): LeadQualification {
  const reasons: string[] = []
  const passedChecks: string[] = []

  if (!input.isOwner) reasons.push("Seller is not the property owner")
  else passedChecks.push("Verified property owner")

  if (!input.isMotivated) reasons.push("Seller does not appear motivated")
  else passedChecks.push("Seller shows motivation")

  if (input.isListedFSBO) reasons.push("Property listed FSBO")
  else passedChecks.push("Not listed FSBO")

  if (input.isListedMLS) reasons.push("Property listed on MLS")
  else passedChecks.push("Not listed on MLS")

  if (input.isUnderContract) reasons.push("Property already under contract")
  else passedChecks.push("Not under existing contract")

  if (input.askingPriceRatio > 0.9) reasons.push("Asking price exceeds 90% of Zestimate")
  else passedChecks.push("Asking price at or below 90% Zestimate")

  if (input.sellerMotivation < 5) reasons.push("Seller motivation below threshold (5)")
  else passedChecks.push("Motivation score meets threshold")

  if (input.saleTimeline > 90) reasons.push("Sale timeline exceeds 90 days")
  else passedChecks.push("Sale timeline within 90 days")

  if (RESTRICTED_STATES[input.state]) reasons.push(`Restricted state: ${input.state}`)
  else passedChecks.push("State not restricted")

  let badge: LeadQualification["badge"] = "eligible"
  if (reasons.length > 2) {
    badge = "ineligible"
  } else if (reasons.length > 0) {
    badge = "manual-review"
  }

  return {
    qualified: reasons.length === 0,
    reasons,
    passedChecks,
    badge,
  }
}

// --- Script Generation ---

export function generateColdCallScript(name: string, address: string, qualifierPrice: number): string {
  return `Hi, this is ${name || "[Your Name]"}. I'm reaching out about the property at ${address || "[Address]"}. I'm a local investor looking to purchase properties in the area. I noticed your listing and wanted to see if you'd be open to discussing a fair cash offer. I can close quickly and cover closing costs. Would a price around $${qualifierPrice.toLocaleString()} be something you'd consider? I completely understand if the timing isn't right - I just wanted to reach out.`
}

export function generateSMSScript(name: string, address: string, qualifierPrice: number): string {
  return `Hi, this is ${name || "[Your Name]"}. I saw your property at ${address || "[Address]"} and I'm interested. I'm a cash buyer looking to close quickly. Would you entertain an offer around $${qualifierPrice.toLocaleString()}? No pressure at all - just let me know if you'd like to chat.`
}

export function generateEmailScript(name: string, address: string, qualifierPrice: number): string {
  return `Subject: Cash Offer Inquiry - ${address || "[Address]"}

Hello,

I am reaching out regarding the property listed at ${address || "[Address]"}. I am an investor actively purchasing properties in the area and am prepared to make a competitive cash offer.

Based on my analysis, I would like to discuss an offer in the range of $${qualifierPrice.toLocaleString()}. I can close on your timeline and handle all closing costs.

I understand if this doesn't align with your expectations, but I'd appreciate the opportunity to discuss further.

Best regards,
${name || "[Your Name]"}`
}

export function generateAgentScript(name: string, address: string, qualifierPrice: number): string {
  return `Hello, I am reaching out about the property listed on ${address || "[Address]"}. I don't want to waste your time by any means, but I am an investor and am wondering if your seller would entertain an offer around $${qualifierPrice.toLocaleString()}. The listing price doesn't make sense for me as an investor. Please let me know if this is at all a possibility.

Talk soon,
${name || "[Your Name]"}`
}

export function generateZillowOfferScript(name: string, address: string, lowRange: number, highRange: number): string {
  return `Hello, I am reaching out about the property listed on ${address || "[Address]"}. I don't want to waste your time by any means, but I am an investor and am wondering if your seller would entertain an offer around $${lowRange.toLocaleString()} - $${highRange.toLocaleString()}. The listing price doesn't make sense for me as an investor. Please let me know if this is at all a possibility.

Talk soon,
${name || "[Your Name]"}`
}

// --- Objection Handling ---

export const OBJECTION_HANDLERS: { objection: string; response: string }[] = [
  {
    objection: "That's too low",
    response: "I completely understand. My offer is based on the current condition and market data. Could you share what price would work for you? I'm flexible and want to find a win-win."
  },
  {
    objection: "I need to think about it",
    response: "Absolutely, take your time. I'll be here when you're ready. Can I follow up with you in a few days to see where you're at?"
  },
  {
    objection: "I already have an agent",
    response: "That's great - I actually work with agents regularly. I can submit my offer through your agent. Could you share their contact info?"
  },
  {
    objection: "I'm not in a rush to sell",
    response: "No problem at all. I can work on your timeline. Would it help if I made a standing offer that you could accept whenever you're ready?"
  },
  {
    objection: "How do I know you're legitimate?",
    response: "Great question. I can provide proof of funds, references from past sellers, and we'd use a reputable title company to handle everything. Your protection is my priority."
  },
  {
    objection: "I need to talk to my spouse/partner",
    response: "Of course, that's totally understandable. Would it help if I sent over a summary of my offer so you can review it together? I can follow up in a day or two."
  },
]

// --- Dispo Marketing ---

export function generateZillowDiscountAd(address: string, listPrice: number, offerPrice: number): string {
  const discount = Math.round(((listPrice - offerPrice) / listPrice) * 100)
  return `INVESTOR SPECIAL - Below Zillow Value!

${address || "[Address]"}

Listed at: $${listPrice.toLocaleString()}
YOUR Price: $${offerPrice.toLocaleString()}
Discount: ${discount}% Below Market

This deal is ${discount}% below Zillow's estimate. Perfect for fix-and-flip or BRRRR strategy investors looking for instant equity.

Cash buyers preferred. Quick close available.
DM for details or contract assignment info.`
}

export function generateRentalROIAd(address: string, price: number, monthlyRent: number): string {
  const annualRent = monthlyRent * 12
  const roi = ((annualRent / price) * 100).toFixed(1)
  const cashflow = monthlyRent - (price * 0.008) // rough PITI estimate
  return `CASH FLOW RENTAL OPPORTUNITY

${address || "[Address]"}

Purchase Price: $${price.toLocaleString()}
Est. Monthly Rent: $${monthlyRent.toLocaleString()}
Annual Gross ROI: ${roi}%
Est. Monthly Cash Flow: $${Math.round(cashflow).toLocaleString()}

Ideal for buy-and-hold investors seeking passive income. Numbers speak for themselves.

Contact for assignment details.`
}

export function generateFBGroupPost(address: string, price: number, arv: number, repairCost: number): string {
  return `HOT DEAL - Wholesale Assignment Available!

Property: ${address || "[Address]"}
Assignment Price: $${price.toLocaleString()}
ARV: $${arv.toLocaleString()}
Est. Repairs: $${repairCost.toLocaleString()}
Potential Spread: $${(arv - price - repairCost).toLocaleString()}

Looking for serious cash buyers. This deal won't last long.

EMD required to lock it down. Title company ready to go.

Drop a comment or DM if interested!
#WholesaleDeals #RealEstateInvesting #CashBuyers`
}

export function generateEmailBlast(address: string, price: number, arv: number, repairCost: number): string {
  return `Subject: Exclusive Deal Alert - ${address || "[Address]"}

Hi [Investor Name],

I have a new wholesale deal available:

Property: ${address || "[Address]"}
Assignment Price: $${price.toLocaleString()}
After Repair Value (ARV): $${arv.toLocaleString()}
Estimated Repairs: $${repairCost.toLocaleString()}
Potential Profit: $${(arv - price - repairCost).toLocaleString()}

This property is under contract and ready for assignment. Title company is in place and ready to close.

If you're interested, please reply to this email or call me directly. First qualified buyer with EMD takes it.

Best,
[Your Name]
[Your Phone]`
}

// --- Buyer Segmentation ---

export interface BuyerSegment {
  type: string
  criteria: string
  strategy: string
  idealDeal: string
}

export const BUYER_SEGMENTS: BuyerSegment[] = [
  {
    type: "Cash Buyer",
    criteria: "Has liquid capital, wants quick close",
    strategy: "Fix & Flip",
    idealDeal: "Distressed properties 60-70% ARV"
  },
  {
    type: "Out-of-State Landlord",
    criteria: "Owns rental properties remotely",
    strategy: "Buy & Hold",
    idealDeal: "Turnkey or light rehab rentals with 8%+ cap rate"
  },
  {
    type: "LLC Buyer",
    criteria: "Purchases through business entity",
    strategy: "Portfolio Building",
    idealDeal: "Multiple properties, bulk deals preferred"
  },
  {
    type: "Fix & Flip Investor",
    criteria: "Active rehabber, contractor connections",
    strategy: "Fix & Flip",
    idealDeal: "Heavy rehab with $30k+ spread potential"
  },
  {
    type: "BRRRR Investor",
    criteria: "Buy, Rehab, Rent, Refinance, Repeat",
    strategy: "BRRRR",
    idealDeal: "Below market with strong rental potential, refinance-friendly ARV"
  },
]

// --- License Required States ---

export const LICENSE_REQUIRED_STATES: Record<string, string> = {
  ND: "North Dakota - RE license required",
  SD: "South Dakota - RE license required",
  NE: "Nebraska - RE license required",
  KS: "Kansas - RE license required",
  OK: "Oklahoma - RE license required",
  IA: "Iowa - RE license required",
  IL: "Illinois - License required if >1 transaction/12 months",
  KY: "Kentucky - License required to market wholesale deal (novations can bypass)",
  WV: "West Virginia - RE license required",
  VA: "Virginia - License required if >2 transactions/year",
  NJ: "New Jersey - RE license required",
  RI: "Rhode Island - RE license required",
  NY: "New York - RE license required",
  VT: "Vermont - RE license required",
  OH: "Ohio - License required to market wholesale deal (novations can bypass)",
}

// --- Partner Program Scripts ---

export const PARTNER_SCRIPTS = {
  coldCallOpening: (homeownerName: string, address: string, city: string) =>
    `Hi ${homeownerName || "(Homeowner First Name)"}?\n\nMy name is __________ and I'm calling about your property at ${address || "(Property Address)"}. I work with a group of buyers in the ${city || "(Property City)"} area that are actively looking to buy some homes. Have you ever considered selling your home or would you be open to selling?\n\n- If No - If it is something you may consider doing in the near future, we actually have a flexible closing timeline up to 6 months, so we can provide you with an offer and then you can decide the best closing time frame.\n\n- No - Alright, do you happen to have other properties you would like to sell?\n\n- If Yes - Great! Do you mind if I ask you a few questions about the condition? It will only take 2 minutes of your time.`,

  fbGroupOpening: (firstName: string, address: string) =>
    `Hello ${firstName || "(First name)"}?\n\nHey ${firstName || "(First name)"} my name is (Your Name), we were just messaging on Facebook about you wanting to sell your property at ${address || "(Property Address)"}.\n\nYes.\n\nDid I catch you at a bad time?\n\nNo, I've got time now.\n\nOkay, awesome. Do you mind if I ask you a few questions about the condition of the property? It will only take 2 minutes of your time.`,

  smsOpening: (firstName: string, address: string) =>
    `Hello ${firstName || "(First name)"}?\n\nHey ${firstName || "(First name)"} my name is (Your Name), we were just texting about your property over at ${address || "(Property Address)"}\n\nYes.\n\nDid I catch you at a bad time?\n\nNo, I've got time now.\n\nOkay, awesome. Do you mind if I ask you a few questions about the condition? It will only take 2 minutes of your time.`,

  outsourcedColdCallOpening: (firstName: string, address: string) =>
    `Hello ${firstName || "(First name)"}?\n\nHey ${firstName || "(First name)"} my name is (Your Name), I'm reaching out because my referral team said that you guys spoke earlier today about your property at ${address || "(Property Address)"} and they mentioned that you may be interested in selling it. Is that accurate?\n\nYes.\n\nGreat, did I catch you at a bad time?\n\nNo, I've got time now.\n\nOkay, awesome. Do you mind if I ask you a few questions about the condition? It will only take 2 minutes of your time.`,

  websiteLeadOpening: (firstName: string, address: string) =>
    `Hello ${firstName || "(First name)"}?\n\nHey ${firstName || "(First name)"} my name is (Your Name), I'm reaching out because you filled out a form on our website expressing interest in selling your property at ${address || "(Property Address)"}. Is that accurate?\n\nYes.\n\nGreat, did I catch you at a bad time?\n\nNo, I've got time now.\n\nOkay, awesome. Do you mind if I ask you a few questions about the condition? It will only take 2 minutes of your time.`,

  qualificationQuestions: `QUALIFICATION QUESTIONS:

- How many beds and baths does it have?
- Does the house have a garage? (Is it 1 or 2 car?)
- On a scale of 1 to 10 how would you rate your property condition?
- Is it currently listed with a realtor?

Thank you so much for answering these questions, there's just a couple more and we'll be done.

- Is the property occupied by you or tenants?
- (If tenants) may I ask, are they on a monthly lease or an annual lease?
- (If annual) okay, do you know when the lease expires?

Okay, just two more questions about the house...

- Is there a specific reason you are wanting to sell the property right now?
  (If it doesn't sound like there is a clear reason) - Were you thinking about selling before I reached out, or are you just looking for an offer?
- Also, if the numbers make sense with the offer, how soon would you be looking to close?

Thank you so much for taking the time to give me that information. So the next step is going to be to get you connected with our Home Buying Partner to see if your property qualifies for an As-Is offer.

Now, we are looking for homeowners that do want to sell their home. On a scale from 1-10, 10 being you would sell today, how would you rate on this?`,

  priceNegotiation: `PRICE NEGOTIATION:

Now before I let you go and get you paired with our Partner, is there a dollar amount you have in mind that you would like to get if you sell the home?

(Let them answer... If their price is more than 90% of Zestimate value, let them know we buy properties AS-IS AND WE PAY ALL CLOSING COST)

Example - "Now, just to let you know, we do buy properties AS-IS and we cover all closing costs. So with that being said, would that price be the lowest you are willing to go, or would you be negotiable on the price?"

If they do not give a price, say:
"If we were to buy it completely as-is, cover all closing cost, and close on your timeline, do you at least have a 10 to 15 thousand dollar range you were hoping for?"`,

  appointmentSetting: `SETTING THE APPOINTMENT (If the Seller is Qualified):

(First name), I appreciate you getting this information over to me. This sounds like a property that we may be interested in. I'd like to go ahead and book you that second call with our home-buying partner.

I'm looking at their calendar right now and they have a _________ available this afternoon or a _______ tomorrow morning. Do either of those times work for you?

Ok great.

And is this the best phone number for them to call you at?

Okay, I've got you booked for __(Day)___ at __(Time)__ and they will give you a call at that time. The phone number they will be calling from is: 629-299-3338

Do you have any other questions for me at this time?

Alright, you are all set. You have a great rest of your day!`,
}

export const PARTNER_DISQUALIFICATION_REASONS = [
  "They are not the owner or do not have rights to the property",
  "The property is not in a market that meets our Ideal Real Estate Market Criteria",
  "The property is listed FSBO or on the MLS",
  "The property is under contract with another wholesaler",
  "They do not want to sell the property",
  "They are not wanting to sell their property within 90 days",
  "Their asking price is higher than 90% of Zestimate value and they are not willing to negotiate",
]

export const PARTNER_RULES = [
  { rule: "Market meets Ideal Real Estate Market Criteria", detail: "MSA > 400k, City > 100k, Median $200k-$400k, DOM < 50, Pending > 25%" },
  { rule: "You SPOKE to and qualified the lead before submitting", detail: "Must have a live conversation with the seller" },
  { rule: "Seller actually wants to sell the property", detail: "Not just looking for an offer because you reached out" },
  { rule: "Asking price <= 90% of Zestimate", detail: "Check Zillow Zestimate, then Redfin, then Realtor.com" },
  { rule: "Property NOT listed FSBO or on MLS", detail: "Check Zillow to see if actively listed For Sale" },
  { rule: "Property NOT under contract with another wholesaler", detail: "Confirm directly with seller" },
  { rule: "Property NOT in OR, IL, SC, or PA", detail: "Restricted states due to wholesale regulations" },
  { rule: "Appointment scheduled via Partner Program calendar", detail: "Use the Partner Program Calendar Booking Link" },
]

// --- Dispo Training Data ---

export const DISPO_PRICE_STRATEGY = {
  goal: "Lock the deal for LESS than the active Zillow price",
  tactics: [
    "Even a $5K-$10K spread creates perception of value",
    "Screenshot the Zillow listing price when you get it under contract",
    'Use "Discounted Below Zillow" as the hook in marketing',
    "Don't hide the listing - use it as proof you got a better deal",
  ],
}

export const DISPO_BUYER_CHANNELS = [
  {
    channel: "Internal Buyer List",
    priority: ["Past cash buyers", "Newer investors", "Out-of-state landlords"],
    methods: ["Email", "SMS / TextBlast", "Call blitz (Top 20 hot buyers)"],
  },
  {
    channel: "Facebook Investor Groups",
    tips: [
      "Post in Real Estate Investors - [City/State/Region]",
      "Post in Fix & Flip Deals - [Region]",
      "Post in Out-of-State BRRRR / Turnkey Groups",
      "Post 2-3x/week",
      "Include visuals (Zillow screenshot vs. your price)",
      'CTA = "DM for walkthrough / comps / deal packet"',
    ],
  },
  {
    channel: "PropStream / BatchLeads / Investor Base",
    filters: ["Cash purchases last 6-12 months", "LLCs", "Zip code / buy box match"],
    tactics: ["Cold call", "SMS drip", "Email follow-up", "Add new buyers to list monthly"],
  },
  {
    channel: "Out-of-State Landlords",
    bestFor: ["Turnkey/light rehab deals", "Faster closings, less friction"],
    howToFind: [
      "Pull public records for owners with out-of-state mailing addresses",
      "Skip trace for phone/email",
      "DM on BiggerPockets or investor Facebook groups",
    ],
  },
  {
    channel: "Investor-Friendly Realtors",
    pitch: "I've got a property under contract at a better price than it's listed for. You have anyone looking for a light flip or easy rental?",
    note: "Offer them a small finder's fee if needed (1-2%)",
  },
]

export const DISPO_SAMPLE_ADS = [
  {
    name: "Zillow Discount",
    template: (address: string, listPrice: number, assignPrice: number) =>
      `Wholesale Deal - Priced BELOW Zillow\n${address}\n$${assignPrice.toLocaleString()} (Zillow: $${listPrice.toLocaleString()})\nUnder contract & ready to assign\nLight cosmetic rehab\nDM for walkthrough, comps, and full packet`,
  },
  {
    name: "Zillow Missed It",
    template: (address: string, listPrice: number, assignPrice: number) =>
      `Zillow Passed - You Profit\n\nThis one's been sitting online.\nWe negotiated it down - now it's a deal.\nAsking: $${assignPrice.toLocaleString()} (Zillow: $${listPrice.toLocaleString()})\nVacant | Fast close\nDM for walkthrough & numbers`,
  },
  {
    name: "Rental Plug-and-Play",
    template: (address: string, _listPrice: number, assignPrice: number, rent?: number) =>
      `Turnkey Rental - Day 1 Cashflow\n${address}\nRent comps: $${(rent || 1200).toLocaleString()}/mo\nAsking: $${assignPrice.toLocaleString()}\nROI: ${(((rent || 1200) * 12 / assignPrice) * 100).toFixed(1)}%+ based on standard mgmt\nDM "Rental" for access + deal packet`,
  },
]

export const DISPO_CTA_IDEAS = [
  '"DM me \'Zillow\' for access"',
  '"Comment your email for walkthrough"',
  '"We\'re assigning this in 48 hours - who\'s in?"',
]

export const DISPO_OBJECTION_ZILLOW = {
  objection: "But it's on Zillow...",
  response: "Yeah - and we've got it under contract for less than list. Most people scroll right past these. We negotiated the deal, lined up access, and now we're assigning it at a discount.",
  keys: ["Confident", "Framing = Value", "You're not brokering a listing - you're selling a deal you negotiated"],
}

export const DISPO_BUYER_CHECKLIST = [
  "Walkthrough video or pics",
  "Repair notes / comps",
  "Access instructions",
  "Contract details (title open, close date, etc.)",
  "Confidence you're real, fast, and professional",
]

// --- Lead Pipeline Types ---

export interface PipelineLead {
  id: string
  address: string
  city: string
  state: string
  listPrice: number
  zestimate: number
  askingPrice: number
  sellerName: string
  sellerPhone: string
  sellerEmail: string
  leadSource: "zillow" | "cold-call" | "sms" | "facebook" | "website" | "referral" | "other"
  status: "new" | "contacted" | "qualified" | "offer-sent" | "under-contract" | "dispo" | "closed" | "dead"
  motivationScore: number
  keywords: string[]
  notes: string
  dateAdded: string
  lastContact: string
  partnerEligible: boolean
  arv: number
  repairEstimate: number
  mao: number
  assignmentPrice: number
}

// --- ROI Calculator ---

export function calculateROI(purchasePrice: number, repairCost: number, arv: number, holdingMonths: number) {
  const totalInvestment = purchasePrice + repairCost
  const holdingCosts = totalInvestment * 0.01 * holdingMonths // 1% per month
  const sellingCosts = arv * 0.08 // 8% closing/selling costs
  const totalCosts = totalInvestment + holdingCosts + sellingCosts
  const profit = arv - totalCosts
  const roi = ((profit / totalInvestment) * 100)

  return {
    totalInvestment,
    holdingCosts: Math.round(holdingCosts),
    sellingCosts: Math.round(sellingCosts),
    totalCosts: Math.round(totalCosts),
    profit: Math.round(profit),
    roi: Math.round(roi * 10) / 10,
  }
}

export function calculateRentalCashflow(purchasePrice: number, monthlyRent: number, repairCost: number) {
  const totalInvestment = purchasePrice + repairCost
  const monthlyPITI = totalInvestment * 0.008 // rough 0.8% rule
  const vacancy = monthlyRent * 0.08
  const maintenance = monthlyRent * 0.1
  const management = monthlyRent * 0.1
  const netCashflow = monthlyRent - monthlyPITI - vacancy - maintenance - management
  const annualCashflow = netCashflow * 12
  const cashOnCashReturn = ((annualCashflow / (totalInvestment * 0.25)) * 100) // 25% down

  return {
    monthlyPITI: Math.round(monthlyPITI),
    vacancy: Math.round(vacancy),
    maintenance: Math.round(maintenance),
    management: Math.round(management),
    netCashflow: Math.round(netCashflow),
    annualCashflow: Math.round(annualCashflow),
    cashOnCashReturn: Math.round(cashOnCashReturn * 10) / 10,
  }
}
