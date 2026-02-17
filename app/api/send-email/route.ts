import { NextRequest, NextResponse } from "next/server"

// Google Gmail API send email route
// Requires GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN env vars
// Falls back to generating a mailto: link if credentials are not configured

export async function POST(req: NextRequest) {
  try {
    const { to, subject, body, senderName } = await req.json()

    if (!to || !subject || !body) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: to, subject, body" },
        { status: 400 }
      )
    }

    const clientId = process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN

    // If Google OAuth credentials are configured, send via Gmail API
    if (clientId && clientSecret && refreshToken) {
      // Step 1: Get a fresh access token using the refresh token
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: "refresh_token",
        }),
      })

      if (!tokenRes.ok) {
        const tokenError = await tokenRes.text()
        return NextResponse.json(
          { success: false, error: `OAuth token refresh failed: ${tokenError}` },
          { status: 500 }
        )
      }

      const { access_token } = await tokenRes.json()

      // Step 2: Construct the MIME email message
      const fromHeader = senderName ? `${senderName} <me>` : "me"
      const mimeMessage = [
        `From: ${fromHeader}`,
        `To: ${to}`,
        `Subject: ${subject}`,
        "Content-Type: text/plain; charset=utf-8",
        "",
        body,
      ].join("\r\n")

      // Base64url encode the message
      const encodedMessage = Buffer.from(mimeMessage)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "")

      // Step 3: Send via Gmail API
      const sendRes = await fetch(
        "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ raw: encodedMessage }),
        }
      )

      if (!sendRes.ok) {
        const sendError = await sendRes.text()
        return NextResponse.json(
          { success: false, error: `Gmail API send failed: ${sendError}` },
          { status: 500 }
        )
      }

      const result = await sendRes.json()
      return NextResponse.json({
        success: true,
        method: "gmail-api",
        messageId: result.id,
        threadId: result.threadId,
      })
    }

    // Fallback: return a Gmail compose URL for the user to send manually
    const gmailComposeUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`

    return NextResponse.json({
      success: true,
      method: "compose-link",
      composeUrl: gmailComposeUrl,
      message: "Google OAuth not configured. Use the compose link to send via Gmail.",
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}
