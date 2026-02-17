import { NextRequest, NextResponse } from "next/server"

// Batch outreach API - sends email and SMS sequences
// Orchestrates the individual send-email and send-sms APIs
// Supports scheduled sends by returning the full sequence with timestamps

interface OutreachEmail {
  to: string
  subject: string
  body: string
  type: string
  sendDelay: string
}

interface OutreachSMS {
  to: string
  message: string
  type: string
  sendDelay: string
}

function parseDelay(delay: string): number {
  const match = delay.match(/\+(\d+)\s*(day|hour|minute)/i)
  if (!match) return 0
  const amount = parseInt(match[1])
  const unit = match[2].toLowerCase()
  if (unit === "day" || unit === "days") return amount * 86400000
  if (unit === "hour" || unit === "hours") return amount * 3600000
  if (unit === "minute" || unit === "minutes") return amount * 60000
  return 0
}

export async function POST(req: NextRequest) {
  try {
    const {
      emails,
      smsMessages,
      senderName,
      sendImmediate = false,
    }: {
      emails: OutreachEmail[]
      smsMessages: OutreachSMS[]
      senderName?: string
      sendImmediate?: boolean
    } = await req.json()

    const results: {
      type: "email" | "sms"
      status: "sent" | "scheduled" | "link-generated" | "error"
      method?: string
      scheduledAt?: string
      link?: string
      error?: string
    }[] = []

    const baseUrl = req.nextUrl.origin

    // Process emails
    for (const email of emails || []) {
      const delay = parseDelay(email.sendDelay)
      const scheduledAt = new Date(Date.now() + delay).toISOString()

      if (sendImmediate && delay === 0) {
        // Send the immediate email now
        try {
          const res = await fetch(`${baseUrl}/api/send-email`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: email.to,
              subject: email.subject,
              body: email.body,
              senderName,
            }),
          })
          const data = await res.json()
          results.push({
            type: "email",
            status: data.success ? "sent" : "error",
            method: data.method,
            link: data.composeUrl,
            error: data.error,
          })
        } catch (err) {
          results.push({
            type: "email",
            status: "error",
            error: err instanceof Error ? err.message : "Send failed",
          })
        }
      } else {
        // Return as scheduled (client-side can handle timing or use a queue)
        const gmailLink = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email.to)}&su=${encodeURIComponent(email.subject)}&body=${encodeURIComponent(email.body)}`
        results.push({
          type: "email",
          status: "scheduled",
          scheduledAt,
          link: gmailLink,
        })
      }
    }

    // Process SMS messages
    for (const sms of smsMessages || []) {
      const delay = parseDelay(sms.sendDelay)
      const scheduledAt = new Date(Date.now() + delay).toISOString()

      if (sendImmediate && delay === 0) {
        try {
          const res = await fetch(`${baseUrl}/api/send-sms`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: sms.to,
              message: sms.message,
            }),
          })
          const data = await res.json()
          results.push({
            type: "sms",
            status: data.success ? "sent" : "error",
            method: data.method,
            link: data.smsLink,
            error: data.error,
          })
        } catch (err) {
          results.push({
            type: "sms",
            status: "error",
            error: err instanceof Error ? err.message : "Send failed",
          })
        }
      } else {
        const smsLink = `sms:${sms.to}?body=${encodeURIComponent(sms.message)}`
        results.push({
          type: "sms",
          status: "scheduled",
          scheduledAt,
          link: smsLink,
        })
      }
    }

    const sentCount = results.filter((r) => r.status === "sent").length
    const scheduledCount = results.filter((r) => r.status === "scheduled").length

    return NextResponse.json({
      success: true,
      results,
      summary: {
        total: results.length,
        sent: sentCount,
        scheduled: scheduledCount,
        errors: results.filter((r) => r.status === "error").length,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}
