"use client"

import { useState, useEffect, useRef, useTransition } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Phone,
  MessageSquare,
  Mail,
  Users,
  Home,
  Copy,
  Check,
  Shield,
  Sparkles,
  Loader2,
  ExternalLink,
  Send,
  Voicemail,
  CheckCircle2,
  Zap,
  AlertTriangle,
  Search,
  UserCheck,
  Save,
  Trash2,
  ChevronDown,
} from "lucide-react"
import {
  generateColdCallScript,
  generateSMSScript,
  generateEmailScript,
  generateAgentScript,
  generateZillowOfferScript,
  OBJECTION_HANDLERS,
} from "@/lib/wholesaling-engine"
import { aiGenerateOutreach } from "@/app/actions/ai-actions"
import { lookupSellerInfo } from "@/app/actions/seller-lookup"
import { buildAllListingUrls } from "@/lib/listing-urls"
import type { AppStore, PrefillData } from "@/lib/store"

type PageId = "dashboard" | "finder" | "scout" | "market" | "deal" | "qualification" | "pipeline" | "outreach" | "partner" | "dispo" | "kpi"

interface OutreachGeneratorProps {
  store: AppStore
  onNavigate: (page: PageId, data?: PrefillData) => void
  prefillData?: PrefillData
}

export function OutreachGenerator({ store, onNavigate, prefillData }: OutreachGeneratorProps) {
  const [name, setName] = useState(store.userName || "")
  const [sellerName, setSellerName] = useState("")
  const [address, setAddress] = useState("")
  const [listPrice, setListPrice] = useState(0)
  const [sellerEmail, setSellerEmail] = useState("")
  const [sellerPhone, setSellerPhone] = useState("")
  const [motivationLevel, setMotivationLevel] = useState("warm")
  const [contactLogged, setContactLogged] = useState(false)
  const didPrefill = useRef(false)

  // Auto-fill from prefillData (from Pipeline lead)
  useEffect(() => {
    if (!prefillData || didPrefill.current) return
    if (prefillData.sellerName || prefillData.address) {
      setSellerName(prefillData.sellerName || "")
      setAddress(prefillData.address || "")
      setListPrice(prefillData.listPrice || 0)
      setSellerEmail(prefillData.sellerEmail || "")
      setSellerPhone(prefillData.sellerPhone || "")
      if (prefillData.motivationScore) {
        setMotivationLevel(prefillData.motivationScore >= 7 ? "hot" : prefillData.motivationScore >= 4 ? "warm" : "cold")
      }
      didPrefill.current = true
    }
  }, [prefillData])

  const handleLogContact = () => {
    if (prefillData?.leadId) {
      store.updateLead(prefillData.leadId, { lastContact: new Date().toISOString(), status: "contacted" })
    }
    // Save contact to the logged contacts list
    const parts = address.split(",")
    store.addContact({
      sellerName: sellerName || "Unknown",
      address: address,
      city: parts[1]?.trim() || "",
      state: parts[2]?.trim().split(" ")[0] || "",
      sellerPhone: sellerPhone,
      sellerEmail: sellerEmail,
      listPrice: listPrice,
      motivationLevel: motivationLevel,
      leadSource: leadSource,
      arv: prefillData?.arv,
      repairEstimate: prefillData?.repairEstimate,
    })
    store.bumpKpi("outreachSent")
    setContactLogged(true)
  }
  const [showContacts, setShowContacts] = useState(false)

  const handleLoadContact = (contact: (typeof store.loggedContacts)[number]) => {
    setSellerName(contact.sellerName)
    setAddress(contact.address)
    setListPrice(contact.listPrice)
    setSellerEmail(contact.sellerEmail)
    setSellerPhone(contact.sellerPhone)
    setMotivationLevel(contact.motivationLevel || "warm")
    setShowContacts(false)
    setContactLogged(false)
  }

  const [leadSource, setLeadSource] = useState("zillow")
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [aiScripts, setAiScripts] = useState<{
    coldCallScript: string
    smsTemplate: string
    emailTemplate: string
    agentScript: string
    zillowOfferMessage: string
    followUpSMS: string
    followUpEmail: string
    voicemailScript: string
  } | null>(null)

  const [sendStatus, setSendStatus] = useState<"idle" | "sending" | "sent" | "error">("idle")
  const [sendSummary, setSendSummary] = useState<{ sent: number; scheduled: number; errors: number } | null>(null)

  // Seller lookup
  const [isLookingUp, startLookupTransition] = useTransition()
  const [sellerLookup, setSellerLookup] = useState<{
    sellerName: string
    sellerType: string
    agentName: string
    agentBrokerage: string
    agentPhone: string
    agentEmail: string
    sellerPhone: string
    sellerEmail: string
    ownershipDuration: string
    motivationClues: string[]
    lookupSources: string[]
    skipTraceTip: string
    dataConfidence: string
    rawFindings: string
    found: boolean
  } | null>(null)

  const handleLookupSeller = () => {
    if (!address) return
    const parts = address.split(",")
    const addrCity = parts[1]?.trim() || ""
    const addrState = parts[2]?.trim().split(" ")[0] || ""
    startLookupTransition(async () => {
      const result = await lookupSellerInfo(
        address,
        addrCity,
        addrState,
        listPrice || undefined,
      )
      if (result.success && result.data) {
        setSellerLookup(result.data)
        // Only auto-fill if real data was found
        if (result.data.found) {
          if (result.data.agentName) {
            setSellerName(result.data.agentName)
          } else if (result.data.sellerName) {
            setSellerName(result.data.sellerName)
          }
          if (result.data.agentPhone || result.data.sellerPhone) {
            setSellerPhone(result.data.agentPhone || result.data.sellerPhone)
          }
          if (result.data.agentEmail || result.data.sellerEmail) {
            setSellerEmail(result.data.agentEmail || result.data.sellerEmail)
          }
        }
      }
    })
  }

  const handleSendViaAPI = async (type: "email" | "sms", subject?: string, body?: string, smsBody?: string) => {
    setSendStatus("sending")
    try {
      if (type === "email") {
        const res = await fetch("/api/send-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: sellerEmail,
            subject: subject || `Property Inquiry - ${address}`,
            body: body || "",
            senderName: name,
          }),
        })
        const data = await res.json()
        if (data.success && data.method === "compose-link") {
          window.open(data.composeUrl, "_blank")
        }
        setSendStatus(data.success ? "sent" : "error")
      } else {
        const res = await fetch("/api/send-sms", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: sellerPhone,
            message: smsBody || "",
          }),
        })
        const data = await res.json()
        if (data.success && data.method === "sms-link") {
          window.open(data.smsLink, "_blank")
        }
        setSendStatus(data.success ? "sent" : "error")
      }
      store.bumpKpi("outreachSent")
      setTimeout(() => setSendStatus("idle"), 3000)
    } catch {
      setSendStatus("error")
      setTimeout(() => setSendStatus("idle"), 3000)
    }
  }

  const handleSendFullSequence = async () => {
    if (!sellerEmail && !sellerPhone) return
    setSendStatus("sending")
    try {
      const emailScripts = scripts.filter((s) => s.id.includes("email"))
      const smsScripts = scripts.filter((s) => s.id.includes("sms"))

      const res = await fetch("/api/send-outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emails: emailScripts.map((s, i) => ({
            to: sellerEmail,
            subject: extractSubject(s.content),
            body: extractBody(s.content),
            type: s.id,
            sendDelay: i === 0 ? "immediately" : `+${i * 3} days`,
          })),
          smsMessages: smsScripts.map((s, i) => ({
            to: sellerPhone,
            message: s.content,
            type: s.id,
            sendDelay: i === 0 ? "immediately" : `+${i * 2} days`,
          })),
          senderName: name,
          sendImmediate: true,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setSendSummary(data.summary)
        setSendStatus("sent")
        store.bumpKpi("outreachSent")
        // Open compose links for any that couldn't auto-send
        for (const result of data.results || []) {
          if (result.link && result.status !== "sent") {
            window.open(result.link, "_blank")
          }
        }
      } else {
        setSendStatus("error")
      }
      setTimeout(() => setSendStatus("idle"), 5000)
    } catch {
      setSendStatus("error")
      setTimeout(() => setSendStatus("idle"), 3000)
    }
  }

  const qualifierPrice = listPrice * 0.8
  const lowRange = listPrice * 0.75
  const highRange = listPrice * 0.8

  const scripts = [
    {
      id: "cold-call",
      label: "Cold Call",
      icon: Phone,
      content: aiScripts?.coldCallScript || generateColdCallScript(name, address, qualifierPrice),
    },
    {
      id: "sms",
      label: "SMS",
      icon: MessageSquare,
      content: aiScripts?.smsTemplate || generateSMSScript(name, address, qualifierPrice),
    },
    {
      id: "email",
      label: "Email",
      icon: Mail,
      content: aiScripts?.emailTemplate || generateEmailScript(name, address, qualifierPrice),
    },
    {
      id: "agent",
      label: "Agent",
      icon: Users,
      content: aiScripts?.agentScript || generateAgentScript(name, address, qualifierPrice),
    },
    {
      id: "zillow",
      label: "Zillow",
      icon: Home,
      content: aiScripts?.zillowOfferMessage || generateZillowOfferScript(name, address, lowRange, highRange),
    },
    {
      id: "follow-sms",
      label: "Follow-Up SMS",
      icon: MessageSquare,
      content: aiScripts?.followUpSMS || `Hi ${sellerName || "there"}, I reached out recently about your property at ${address || "[Address]"}. Just following up - still interested in making you a fair cash offer if you're open to it. No pressure!`,
    },
    {
      id: "follow-email",
      label: "Follow-Up Email",
      icon: Mail,
      content: aiScripts?.followUpEmail || `Subject: Following Up - ${address || "[Address]"}\n\nHi ${sellerName || "there"},\n\nI wanted to follow up on my earlier message about your property at ${address || "[Address]"}. I'm still actively looking to purchase in the area and would love to discuss a fair cash offer.\n\nPlease let me know if you have a few minutes to chat.\n\nBest,\n${name || "[Your Name]"}`,
    },
    {
      id: "voicemail",
      label: "Voicemail",
      icon: Voicemail,
      content: aiScripts?.voicemailScript || `Hi ${sellerName || "there"}, this is ${name || "[Your Name]"}. I'm calling about your property at ${address || "[Address]"}. I'm a local cash buyer looking to purchase homes in the area. I'd love to chat about making you a fair offer. Please give me a call back at your earliest convenience. Thanks!`,
    },
  ]

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch { /* noop */ }
  }

  const handleAIGenerate = () => {
    startTransition(async () => {
      const result = await aiGenerateOutreach(
        name, sellerName, address, listPrice, qualifierPrice, motivationLevel, leadSource
      )
      if (result.success && result.data) {
        setAiScripts(result.data)
      }
    })
  }

  // Gmail compose link
  const getGmailLink = (subject: string, body: string) => {
    return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(sellerEmail)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  }

  // SMS link
  const getSMSLink = (body: string) => {
    return `sms:${sellerPhone}?body=${encodeURIComponent(body)}`
  }

  // Extract subject from email template
  const extractSubject = (emailContent: string) => {
    const match = emailContent.match(/Subject:\s*(.+)/i)
    return match ? match[1] : `Property Inquiry - ${address}`
  }

  const extractBody = (emailContent: string) => {
    return emailContent.replace(/Subject:\s*.+\n\n?/i, "")
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-foreground tracking-tight">
          Outreach Scripts
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          AI-powered personalized scripts with direct send via Gmail & SMS
        </p>
      </div>

      {/* Input Fields */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-semibold text-foreground">Script Variables</CardTitle>
          {store.loggedContacts.length > 0 && (
            <Button
              size="sm"
              variant={showContacts ? "secondary" : "outline"}
              className="text-xs"
              onClick={() => setShowContacts(!showContacts)}
            >
              <Users className="w-3.5 h-3.5 mr-1.5" />
              Saved Contacts ({store.loggedContacts.length})
              <ChevronDown className={`w-3.5 h-3.5 ml-1 transition-transform ${showContacts ? "rotate-180" : ""}`} />
            </Button>
          )}
        </CardHeader>

        {/* Saved Contacts Panel */}
        {showContacts && store.loggedContacts.length > 0 && (
          <div className="px-6 pb-3">
            <div className="rounded-lg border border-border bg-secondary/50 overflow-hidden">
              <div className="p-3 border-b border-border bg-secondary">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Click a contact to load their info into the form
                </p>
              </div>
              <div className="max-h-52 overflow-y-auto divide-y divide-border">
                {store.loggedContacts.map((contact) => (
                  <div
                    key={contact.id}
                    className="flex items-center gap-3 p-3 hover:bg-primary/5 cursor-pointer transition-colors group"
                    onClick={() => handleLoadContact(contact)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-semibold text-foreground truncate">{contact.sellerName}</p>
                        <Badge variant="outline" className="text-[9px] shrink-0">{contact.motivationLevel}</Badge>
                      </div>
                      <p className="text-[10px] text-muted-foreground truncate">{contact.address}</p>
                      <div className="flex items-center gap-3 mt-0.5 text-[10px] text-muted-foreground">
                        {contact.sellerPhone && <span>{contact.sellerPhone}</span>}
                        {contact.sellerEmail && <span>{contact.sellerEmail}</span>}
                        {contact.listPrice > 0 && <span className="font-mono">${contact.listPrice.toLocaleString()}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-[9px] text-muted-foreground">
                        {new Date(contact.dateLogged).toLocaleDateString()}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={(e) => {
                          e.stopPropagation()
                          store.removeContact(contact.id)
                        }}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground flex items-center justify-between">
                Your Name
                {store.userName && store.userName === name && (
                  <span className="text-[10px] text-success font-normal">Saved</span>
                )}
              </Label>
              <div className="flex gap-1.5">
                <Input
                  placeholder="e.g., John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-secondary border-border text-foreground"
                />
                <Button
                  size="sm"
                  variant={store.userName === name && name ? "outline" : "default"}
                  className="shrink-0 h-9 px-2.5"
                  onClick={() => { if (name) store.setUserName(name) }}
                  disabled={!name || store.userName === name}
                  title="Save your name so it auto-fills next time"
                >
                  <Save className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Seller / Agent Name</Label>
              <Input
                placeholder="e.g., Mike"
                value={sellerName}
                onChange={(e) => setSellerName(e.target.value)}
                className="bg-secondary border-border text-foreground"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Property Address</Label>
              <Input
                placeholder="123 Main St, Jacksonville, FL"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="bg-secondary border-border text-foreground"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">List Price ($)</Label>
              <Input
                type="number"
                placeholder="120000"
                value={listPrice || ""}
                onChange={(e) => setListPrice(Number(e.target.value))}
                className="bg-secondary border-border text-foreground"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Seller Email</Label>
              <Input
                type="email"
                placeholder="seller@email.com"
                value={sellerEmail}
                onChange={(e) => setSellerEmail(e.target.value)}
                className="bg-secondary border-border text-foreground"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Seller Phone</Label>
              <Input
                type="tel"
                placeholder="555-012-3456"
                value={sellerPhone}
                onChange={(e) => setSellerPhone(e.target.value)}
                className="bg-secondary border-border text-foreground"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Motivation Level</Label>
              <Select value={motivationLevel} onValueChange={setMotivationLevel}>
                <SelectTrigger className="bg-secondary border-border text-foreground"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cold">Cold</SelectItem>
                  <SelectItem value="warm">Warm</SelectItem>
                  <SelectItem value="hot">Hot</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Lead Source</Label>
              <Select value={leadSource} onValueChange={setLeadSource}>
                <SelectTrigger className="bg-secondary border-border text-foreground"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="zillow">Zillow</SelectItem>
                  <SelectItem value="cold-call">Cold Call</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="facebook">Facebook</SelectItem>
                  <SelectItem value="website">Website</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* View Listing Links - to manually pull seller/agent info */}
          {address && (() => {
            const urls = buildAllListingUrls(address)
            return (
              <div className="flex items-center gap-2 flex-wrap p-3 rounded-lg bg-secondary/80 border border-border">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">View Listing:</span>
                <a href={urls.zillow} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs bg-primary/10 text-primary hover:bg-primary/20 font-medium transition-colors">
                  <ExternalLink className="w-2.5 h-2.5" />Zillow
                </a>
                <a href={urls.redfin} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs bg-destructive/10 text-destructive hover:bg-destructive/20 font-medium transition-colors">
                  <ExternalLink className="w-2.5 h-2.5" />Redfin
                </a>
                <a href={urls.realtor} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs bg-accent/10 text-accent hover:bg-accent/20 font-medium transition-colors">
                  <ExternalLink className="w-2.5 h-2.5" />Realtor.com
                </a>
                <a href={urls.truePeople} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs bg-success/10 text-success hover:bg-success/20 font-medium transition-colors">
                  <ExternalLink className="w-2.5 h-2.5" />TruePeopleSearch
                </a>
                <a href={urls.google} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs bg-foreground/5 text-foreground hover:bg-foreground/10 font-medium transition-colors">
                  <ExternalLink className="w-2.5 h-2.5" />Google
                </a>
                <span className="text-[10px] text-muted-foreground ml-auto">Find seller/agent contact info here</span>
              </div>
            )
          })()}

          {/* Computed values + AI button */}
          <div className="flex flex-wrap items-center gap-3">
            {listPrice > 0 && (
              <>
                <div className="p-2 rounded bg-secondary text-xs">
                  <span className="text-muted-foreground">80% Qualifier:</span>{" "}
                  <span className="font-mono font-bold text-primary">${qualifierPrice.toLocaleString()}</span>
                </div>
                <div className="p-2 rounded bg-secondary text-xs">
                  <span className="text-muted-foreground">Offer Range:</span>{" "}
                  <span className="font-mono font-bold text-foreground">
                    ${lowRange.toLocaleString()} - ${highRange.toLocaleString()}
                  </span>
                </div>
              </>
            )}
            <div className="flex items-center gap-2 ml-auto flex-wrap">
              <Button
                onClick={handleLookupSeller}
                disabled={isLookingUp || !address}
                variant="outline"
                size="sm"
              >
                {isLookingUp ? (
                  <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Looking Up...</>
                ) : (
                  <><Search className="w-3.5 h-3.5 mr-1.5" />Lookup Seller Info</>
                )}
              </Button>
              <Button
                onClick={handleLogContact}
                disabled={contactLogged}
                variant="outline"
                size="sm"
              >
                {contactLogged ? (
                  <><CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-success" />Contact Logged</>
                ) : (
                  <><CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />Log Contact</>
                )}
              </Button>
              <Button
                onClick={handleAIGenerate}
                disabled={isPending || !address}
                variant="outline"
                size="sm"
              >
                {isPending ? (
                  <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Generating...</>
                ) : (
                  <><Sparkles className="w-3.5 h-3.5 mr-1.5" />AI Generate All</>
                )}
              </Button>
              <Button
                onClick={handleSendFullSequence}
                disabled={sendStatus === "sending" || (!sellerEmail && !sellerPhone)}
                size="sm"
                className="bg-success hover:bg-success/90 text-background"
              >
                {sendStatus === "sending" ? (
                  <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Sending...</>
                ) : sendStatus === "sent" ? (
                  <><CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />Sequence Sent</>
                ) : (
                  <><Zap className="w-3.5 h-3.5 mr-1.5" />Send Full Sequence</>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Send Summary */}
      {sendSummary && sendStatus === "sent" && (
        <Card className="border-success/30 bg-success/5">
          <CardContent className="p-4 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-success" />
              <p className="text-xs text-foreground">
                Outreach sequence sent: <span className="font-bold">{sendSummary.sent} sent</span>, <span className="font-bold">{sendSummary.scheduled} scheduled</span>
                {sendSummary.errors > 0 && <span className="text-destructive">, {sendSummary.errors} errors</span>}
              </p>
            </div>
            <p className="text-[10px] text-muted-foreground">Gmail compose links opened for any that need manual send</p>
          </CardContent>
        </Card>
      )}
      {sendStatus === "error" && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            <p className="text-xs text-destructive">Failed to send sequence. Check your Google/Twilio API credentials in Settings.</p>
          </CardContent>
        </Card>
      )}

      {/* Seller Lookup Results */}
      {sellerLookup && (
        <Card className={sellerLookup.found ? "border-success/30 bg-success/5" : "border-warning/30 bg-warning/5"}>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-primary" />
                {sellerLookup.found ? "Seller / Agent Lookup Results" : "Seller Info Not Found"}
              </p>
              <Badge variant="outline" className={`text-[10px] ${sellerLookup.found ? "border-success/50 text-success" : "border-warning/50 text-warning"}`}>
                {sellerLookup.found ? "Data Found" : "No Data"}
              </Badge>
            </div>

            {sellerLookup.found ? (
              <>
                {/* Found real data */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {sellerLookup.sellerName && (
                    <div className="space-y-0.5">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Owner Name</p>
                      <p className="text-xs font-semibold text-foreground">{sellerLookup.sellerName}</p>
                      {sellerLookup.sellerPhone && <p className="text-[10px] text-muted-foreground">{sellerLookup.sellerPhone}</p>}
                      {sellerLookup.sellerEmail && <p className="text-[10px] text-primary break-all">{sellerLookup.sellerEmail}</p>}
                    </div>
                  )}
                  {sellerLookup.agentName && (
                    <div className="space-y-0.5">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Listing Agent</p>
                      <p className="text-xs font-semibold text-foreground">{sellerLookup.agentName}</p>
                      {sellerLookup.agentBrokerage && <p className="text-[10px] text-muted-foreground">{sellerLookup.agentBrokerage}</p>}
                      {sellerLookup.agentPhone && <p className="text-[10px] text-muted-foreground">{sellerLookup.agentPhone}</p>}
                      {sellerLookup.agentEmail && <p className="text-[10px] text-primary break-all">{sellerLookup.agentEmail}</p>}
                    </div>
                  )}
                  {sellerLookup.ownershipDuration && sellerLookup.ownershipDuration !== "Not found" && (
                    <div className="space-y-0.5">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Ownership</p>
                      <p className="text-xs font-medium text-foreground">{sellerLookup.ownershipDuration}</p>
                    </div>
                  )}
                  {sellerLookup.motivationClues.length > 0 && (
                    <div className="space-y-0.5">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Motivation Clues</p>
                      <div className="flex flex-wrap gap-1">
                        {sellerLookup.motivationClues.map((c, i) => (
                          <Badge key={i} variant="outline" className="text-[9px] border-warning/30 text-warning">{c}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* All phones & emails from skip trace */}
                {((sellerLookup as Record<string, unknown>).phones as Array<{ number: string; type: string; confidence: number }> | undefined)?.length ? (
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Phone Numbers (by confidence)</p>
                    <div className="flex flex-wrap gap-1.5">
                      {((sellerLookup as Record<string, unknown>).phones as Array<{ number: string; type: string; confidence: number }>).map((p, i) => (
                        <button key={i} className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-xs text-foreground ring-1 ring-border hover:ring-primary/50 transition-colors" onClick={() => setSellerPhone(p.number)}>
                          <span className="font-mono">{p.number}</span>
                          <span className="text-[9px] text-muted-foreground">{p.type}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {((sellerLookup as Record<string, unknown>).emails as Array<{ address: string; type: string; confidence: number }> | undefined)?.length ? (
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Email Addresses</p>
                    <div className="flex flex-wrap gap-1.5">
                      {((sellerLookup as Record<string, unknown>).emails as Array<{ address: string; type: string; confidence: number }>).map((e, i) => (
                        <button key={i} className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-xs text-primary ring-1 ring-border hover:ring-primary/50 transition-colors break-all" onClick={() => setSellerEmail(e.address)}>
                          {e.address}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {/* Data source badges */}
                {sellerLookup.lookupSources.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] text-muted-foreground">Sources:</span>
                    {sellerLookup.lookupSources.map((src: string, i: number) => (
                      <span key={i} className="inline-flex items-center rounded-full bg-success/10 px-1.5 py-0.5 text-[10px] font-medium text-success ring-1 ring-success/20">{src}</span>
                    ))}
                  </div>
                )}

                {/* Quick Apply Buttons */}
                <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                  {sellerLookup.agentName && (
                    <Button size="sm" variant="outline" className="text-xs" onClick={() => {
                      setSellerName(sellerLookup.agentName)
                      if (sellerLookup.agentPhone) setSellerPhone(sellerLookup.agentPhone)
                      if (sellerLookup.agentEmail) setSellerEmail(sellerLookup.agentEmail)
                    }}>
                      <UserCheck className="w-3 h-3 mr-1" />Use Agent Info
                    </Button>
                  )}
                  {sellerLookup.sellerName && (
                    <Button size="sm" variant="outline" className="text-xs" onClick={() => {
                      setSellerName(sellerLookup.sellerName)
                      if (sellerLookup.sellerPhone) setSellerPhone(sellerLookup.sellerPhone)
                      if (sellerLookup.sellerEmail) setSellerEmail(sellerLookup.sellerEmail)
                    }}>
                      <UserCheck className="w-3 h-3 mr-1" />Use Owner Info
                    </Button>
                  )}
                </div>
              </>
            ) : (
              /* No real data found - show honest message */
              <div className="space-y-2">
                <p className="text-xs text-foreground">
                  Could not find seller information for this property through automated lookup.
                  These sites block server-side requests. Use the links below to look up the property manually:
                </p>
                {address && (() => {
                  const urls = buildAllListingUrls(address)
                  return (
                    <div className="flex flex-wrap gap-1.5">
                      <a href={urls.zillow} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs bg-primary/10 text-primary hover:bg-primary/20 font-medium transition-colors">
                        <ExternalLink className="w-2.5 h-2.5" />Zillow
                      </a>
                      <a href={urls.redfin} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs bg-destructive/10 text-destructive hover:bg-destructive/20 font-medium transition-colors">
                        <ExternalLink className="w-2.5 h-2.5" />Redfin
                      </a>
                      <a href={urls.realtor} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs bg-accent/10 text-accent hover:bg-accent/20 font-medium transition-colors">
                        <ExternalLink className="w-2.5 h-2.5" />Realtor.com
                      </a>
                      <a href={urls.truePeople} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs bg-success/10 text-success hover:bg-success/20 font-medium transition-colors">
                        <ExternalLink className="w-2.5 h-2.5" />TruePeopleSearch
                      </a>
                    </div>
                  )
                })()}
              </div>
            )}

            {/* Raw Findings */}
            {sellerLookup.rawFindings && (
              <div className="pt-2 border-t border-border space-y-1">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Lookup Details</p>
                <p className="text-xs text-muted-foreground whitespace-pre-wrap">{sellerLookup.rawFindings}</p>
              </div>
            )}

            {/* Tip */}
            <div className="pt-2 border-t border-border">
              <p className="text-xs text-muted-foreground italic">{sellerLookup.skipTraceTip}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Script Tabs */}
      <Tabs defaultValue="cold-call" className="space-y-4">
        <TabsList className="flex flex-wrap w-full bg-secondary gap-1 h-auto p-1">
          {scripts.map((s) => {
            const Icon = s.icon
            return (
              <TabsTrigger
                key={s.id}
                value={s.id}
                className="text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <Icon className="w-3 h-3 mr-1 hidden sm:inline" />
                <span className="truncate">{s.label}</span>
              </TabsTrigger>
            )
          })}
        </TabsList>

        {scripts.map((s) => (
          <TabsContent key={s.id} value={s.id}>
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <CardTitle className="text-sm font-semibold text-foreground">{s.label}</CardTitle>
                  <div className="flex items-center gap-2">
                    {/* Direct Send Buttons */}
                    {(s.id === "email" || s.id === "follow-email") && (
                      <>
                        {sellerEmail && (
                          <Button
                            size="sm"
                            className="text-xs bg-success hover:bg-success/90 text-background"
                            onClick={() => handleSendViaAPI("email", extractSubject(s.content), extractBody(s.content))}
                            disabled={sendStatus === "sending"}
                          >
                            <Zap className="w-3 h-3 mr-1" />Send via API
                          </Button>
                        )}
                        <a
                          href={getGmailLink(extractSubject(s.content), extractBody(s.content))}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button size="sm" variant="outline" className="text-xs">
                            <Send className="w-3 h-3 mr-1" />
                            {sellerEmail ? "Gmail Compose" : "Compose Email"}
                            <ExternalLink className="w-3 h-3 ml-1" />
                          </Button>
                        </a>
                      </>
                    )}
                    {(s.id === "sms" || s.id === "follow-sms") && (
                      <>
                        {sellerPhone && (
                          <Button
                            size="sm"
                            className="text-xs bg-success hover:bg-success/90 text-background"
                            onClick={() => handleSendViaAPI("sms", undefined, undefined, s.content)}
                            disabled={sendStatus === "sending"}
                          >
                            <Zap className="w-3 h-3 mr-1" />Send via API
                          </Button>
                        )}
                        <a href={getSMSLink(s.content)}>
                          <Button size="sm" variant="outline" className="text-xs">
                            <MessageSquare className="w-3 h-3 mr-1" />
                            {sellerPhone ? "Open SMS" : "Compose SMS"}
                            <ExternalLink className="w-3 h-3 ml-1" />
                          </Button>
                        </a>
                      </>
                    )}
                    {(s.id === "cold-call" || s.id === "voicemail") && (
                      <a href={sellerPhone ? `tel:${sellerPhone}` : "#"}>
                        <Button size="sm" variant="outline" className="text-xs" disabled={!sellerPhone}>
                          <Phone className="w-3 h-3 mr-1" />
                          {sellerPhone ? "Call Now" : "No Phone"}
                          {sellerPhone && <ExternalLink className="w-3 h-3 ml-1" />}
                        </Button>
                      </a>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCopy(s.id, s.content)}
                      className="text-xs"
                    >
                      {copiedId === s.id ? (
                        <><Check className="w-3 h-3 mr-1" />Copied</>
                      ) : (
                        <><Copy className="w-3 h-3 mr-1" />Copy</>
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Textarea
                  readOnly
                  value={s.content}
                  className="min-h-[200px] bg-secondary border-border text-foreground text-sm leading-relaxed font-mono resize-none"
                />
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {/* Objection Handling */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
            <Shield className="w-4 h-4 text-primary" />
            Objection Handling
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {OBJECTION_HANDLERS.map((oh, i) => (
              <div key={i} className="p-3 rounded-lg bg-secondary space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-destructive">
                    {`"${oh.objection}"`}
                  </p>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleCopy(`objection-${i}`, oh.response)}
                    className="text-xs h-7 px-2 text-muted-foreground hover:text-foreground"
                  >
                    {copiedId === `objection-${i}` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  </Button>
                </div>
                <p className="text-xs text-foreground leading-relaxed">{oh.response}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
