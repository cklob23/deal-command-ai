/**
 * BatchData API client for property skip tracing (owner contact info).
 * Docs: https://developer.batchdata.com
 * Auth: Header `Authorization: Bearer <BATCHDATA_API_KEY>`
 */

const BASE = "https://api.batchdata.com/api/v1"

function headers() {
  const key = process.env.BATCHDATA_API_KEY
  if (!key) throw new Error("BATCHDATA_API_KEY is not set")
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  }
}

// --- Types ---

export interface SkipTracePhone {
  phoneNumber?: string
  phoneType?: string // mobile, landline, voip
  carrier?: string
  isConnected?: boolean
  confidenceScore?: number
}

export interface SkipTraceEmail {
  emailAddress?: string
  emailType?: string // personal, business
  confidenceScore?: number
}

export interface SkipTraceResult {
  found: boolean
  ownerName?: string
  ownerFirstName?: string
  ownerLastName?: string
  mailingAddress?: string
  phones: SkipTracePhone[]
  emails: SkipTraceEmail[]
  rawResponse?: Record<string, unknown>
}

// --- Public methods ---

/**
 * Skip trace a property address to find the owner's contact info.
 * Returns phone numbers (ranked by confidence), emails, and owner name.
 */
export async function skipTraceByAddress(
  street: string,
  city: string,
  state: string,
  zip?: string
): Promise<SkipTraceResult> {
  const body = {
    requests: [
      {
        propertyAddress: {
          street,
          city,
          state,
          ...(zip ? { zip } : {}),
        },
      },
    ],
  }

  const res = await fetch(`${BASE}/property/skip-trace`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`BatchData skip-trace ${res.status}: ${text.slice(0, 300)}`)
  }

  const json = await res.json()

  // BatchData response shape: { results: { body: { ... } }[] } or { results: [{ ...data }] }
  // The exact shape depends on API version. We handle both formats.
  const results = json?.results ?? json?.data ?? []
  const first = Array.isArray(results) ? results[0] : results

  if (!first) {
    return { found: false, phones: [], emails: [], rawResponse: json }
  }

  // Extract from common BatchData response shapes
  const owner = first.people?.[0] ?? first.identity ?? first.owner ?? first
  const phones: SkipTracePhone[] = (
    owner.phoneNumbers ?? owner.phones ?? first.phoneNumbers ?? []
  ).map((p: Record<string, unknown>) => ({
    phoneNumber: p.phoneNumber ?? p.number ?? p.phone,
    phoneType: p.phoneType ?? p.type ?? "unknown",
    carrier: p.carrier ?? "",
    isConnected: p.isConnected ?? p.connected ?? true,
    confidenceScore: p.confidenceScore ?? p.score ?? 0,
  }))

  const emails: SkipTraceEmail[] = (
    owner.emailAddresses ?? owner.emails ?? first.emailAddresses ?? []
  ).map((e: Record<string, unknown>) => ({
    emailAddress: e.emailAddress ?? e.email ?? e.address,
    emailType: e.emailType ?? e.type ?? "unknown",
    confidenceScore: e.confidenceScore ?? e.score ?? 0,
  }))

  const ownerName = (owner.fullName ?? owner.name ??
    [owner.firstName ?? owner.ownerFirstName, owner.lastName ?? owner.ownerLastName]
      .filter(Boolean).join(" ")) || undefined

  return {
    found: !!(ownerName || phones.length > 0 || emails.length > 0),
    ownerName,
    ownerFirstName: owner.firstName ?? owner.ownerFirstName,
    ownerLastName: owner.lastName ?? owner.ownerLastName,
    mailingAddress: owner.mailingAddress ?? first.mailingAddress,
    phones: phones.sort((a: SkipTracePhone, b: SkipTracePhone) => (b.confidenceScore ?? 0) - (a.confidenceScore ?? 0)),
    emails: emails.sort((a: SkipTraceEmail, b: SkipTraceEmail) => (b.confidenceScore ?? 0) - (a.confidenceScore ?? 0)),
    rawResponse: json,
  }
}

/** Check if BatchData key is configured */
export function isConfigured(): boolean {
  return !!process.env.BATCHDATA_API_KEY
}
