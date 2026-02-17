import { NextRequest, NextResponse } from "next/server"

// Twilio SMS send route
// Requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER env vars
// Falls back to generating an sms: link if credentials are not configured

export async function POST(req: NextRequest) {
  try {
    const { to, message } = await req.json()

    if (!to || !message) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: to, message" },
        { status: 400 }
      )
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    const twilioPhone = process.env.TWILIO_PHONE_NUMBER

    // If Twilio credentials are configured, send via Twilio API
    if (accountSid && authToken && twilioPhone) {
      // Clean phone number - ensure it has country code
      const cleanTo = to.replace(/[^\d+]/g, "")
      const formattedTo = cleanTo.startsWith("+") ? cleanTo : `+1${cleanTo}`

      const twilioRes = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            To: formattedTo,
            From: twilioPhone,
            Body: message,
          }),
        }
      )

      if (!twilioRes.ok) {
        const twilioError = await twilioRes.json()
        return NextResponse.json(
          { success: false, error: `Twilio send failed: ${twilioError.message || JSON.stringify(twilioError)}` },
          { status: 500 }
        )
      }

      const result = await twilioRes.json()
      return NextResponse.json({
        success: true,
        method: "twilio",
        messageSid: result.sid,
        status: result.status,
      })
    }

    // Fallback: return an sms: link for the user to send manually
    const smsLink = `sms:${to}?body=${encodeURIComponent(message)}`

    return NextResponse.json({
      success: true,
      method: "sms-link",
      smsLink,
      message: "Twilio not configured. Use the SMS link to send from your phone.",
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}
