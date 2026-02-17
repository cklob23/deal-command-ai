"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import {
  Copy,
  Check,
  Handshake,
  Phone,
  MessageSquare,
  Globe,
  Headphones,
  FileText,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ClipboardList,
  Shield,
  BookOpen,
} from "lucide-react"
import type { AppStore, PrefillData } from "@/lib/store"
import {
  PARTNER_SCRIPTS,
  PARTNER_RULES,
  PARTNER_DISQUALIFICATION_REASONS,
} from "@/lib/wholesaling-engine"

type PageId = "dashboard" | "finder" | "scout" | "market" | "deal" | "qualification" | "pipeline" | "outreach" | "partner" | "dispo" | "kpi"

interface PartnerProgramProps {
  store: AppStore
  onNavigate: (page: PageId, data?: PrefillData) => void
  prefillData?: PrefillData
}

export function PartnerProgram({ store, onNavigate, prefillData }: PartnerProgramProps) {
  const [homeownerName, setHomeownerName] = useState(prefillData?.sellerName || "")
  const [address, setAddress] = useState(prefillData?.address || "")
  const [city, setCity] = useState(prefillData?.city || "")
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch { /* noop */ }
  }

  const CopyButton = ({ id, text }: { id: string; text: string }) => (
    <Button
      size="sm"
      variant="outline"
      onClick={() => handleCopy(id, text)}
      className="text-xs shrink-0"
    >
      {copiedId === id ? (
        <><Check className="w-3 h-3 mr-1" />Copied</>
      ) : (
        <><Copy className="w-3 h-3 mr-1" />Copy</>
      )}
    </Button>
  )

  const scripts = [
    {
      id: "cold-call",
      label: "Cold Call",
      icon: Phone,
      content: PARTNER_SCRIPTS.coldCallOpening(homeownerName, address, city),
    },
    {
      id: "fb-group",
      label: "FB Group",
      icon: Globe,
      content: PARTNER_SCRIPTS.fbGroupOpening(homeownerName, address),
    },
    {
      id: "sms",
      label: "SMS Lead",
      icon: MessageSquare,
      content: PARTNER_SCRIPTS.smsOpening(homeownerName, address),
    },
    {
      id: "outsourced",
      label: "VA Call",
      icon: Headphones,
      content: PARTNER_SCRIPTS.outsourcedColdCallOpening(homeownerName, address),
    },
    {
      id: "website",
      label: "Website",
      icon: Globe,
      content: PARTNER_SCRIPTS.websiteLeadOpening(homeownerName, address),
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-foreground tracking-tight">
          Partner Program
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          REI GameChangers Partner Program rules, scripts, and qualification workflow
        </p>
      </div>

      {/* Quick Rules */}
      <Card className="border-primary/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
            <Shield className="w-4 h-4 text-primary" />
            Partner Program Rules & Lead Criteria
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {PARTNER_RULES.map((rule, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-secondary">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <div>
                  <p className="text-xs font-semibold text-foreground">{rule.rule}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{rule.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Script Variables */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
            <FileText className="w-4 h-4 text-primary" />
            Script Variables
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Homeowner / Lead Name</Label>
              <Input
                placeholder="e.g., John"
                value={homeownerName}
                onChange={(e) => setHomeownerName(e.target.value)}
                className="bg-secondary border-border text-foreground"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Property Address</Label>
              <Input
                placeholder="e.g., 123 Main St"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="bg-secondary border-border text-foreground"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Property City</Label>
              <Input
                placeholder="e.g., Jacksonville"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="bg-secondary border-border text-foreground"
              />
            </div>
          </div>
          <div className="mt-3 p-2 rounded-lg bg-warning/10 text-xs text-warning flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">DO NOT say your first & last name or your real company name on the initial phone call.</p>
              <p className="mt-1">{"If they ask what company you are with, say: \"Oh, I'm not with a company, I'm just a local investor.\""}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Opening Scripts by Lead Source */}
      <Tabs defaultValue="cold-call" className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Opening Scripts by Lead Source</h2>
        </div>
        <TabsList className="grid grid-cols-5 w-full bg-secondary">
          {scripts.map((s) => {
            const Icon = s.icon
            return (
              <TabsTrigger
                key={s.id}
                value={s.id}
                className="text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <Icon className="w-3.5 h-3.5 mr-1 hidden sm:inline" />
                <span className="truncate">{s.label}</span>
              </TabsTrigger>
            )
          })}
        </TabsList>
        {scripts.map((s) => (
          <TabsContent key={s.id} value={s.id}>
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold text-foreground">{s.label} Opening Script</CardTitle>
                  <CopyButton id={s.id} text={s.content} />
                </div>
              </CardHeader>
              <CardContent>
                <Textarea
                  readOnly
                  value={s.content}
                  className="min-h-[220px] bg-secondary border-border text-foreground text-sm leading-relaxed font-mono resize-none"
                />
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {/* Qualification Questions */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
              <ClipboardList className="w-4 h-4 text-primary" />
              Qualification Questions
            </CardTitle>
            <CopyButton id="qual-questions" text={PARTNER_SCRIPTS.qualificationQuestions} />
          </div>
        </CardHeader>
        <CardContent>
          <Textarea
            readOnly
            value={PARTNER_SCRIPTS.qualificationQuestions}
            className="min-h-[300px] bg-secondary border-border text-foreground text-sm leading-relaxed font-mono resize-none"
          />
        </CardContent>
      </Card>

      {/* Price Negotiation */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
              <BookOpen className="w-4 h-4 text-accent" />
              Price Negotiation Script
            </CardTitle>
            <CopyButton id="price-neg" text={PARTNER_SCRIPTS.priceNegotiation} />
          </div>
        </CardHeader>
        <CardContent>
          <Textarea
            readOnly
            value={PARTNER_SCRIPTS.priceNegotiation}
            className="min-h-[200px] bg-secondary border-border text-foreground text-sm leading-relaxed font-mono resize-none"
          />
        </CardContent>
      </Card>

      {/* Appointment Setting */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
              <Phone className="w-4 h-4 text-success" />
              Setting the Appointment (If Qualified)
            </CardTitle>
            <CopyButton id="appointment" text={PARTNER_SCRIPTS.appointmentSetting} />
          </div>
        </CardHeader>
        <CardContent>
          <Textarea
            readOnly
            value={PARTNER_SCRIPTS.appointmentSetting}
            className="min-h-[180px] bg-secondary border-border text-foreground text-sm leading-relaxed font-mono resize-none"
          />
        </CardContent>
      </Card>

      {/* When to Disqualify */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
            <XCircle className="w-4 h-4 text-destructive" />
            When to Disqualify a Seller Lead
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {PARTNER_DISQUALIFICATION_REASONS.map((reason, i) => (
              <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-destructive/5">
                <XCircle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
                <p className="text-xs text-foreground">{reason}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 p-3 rounded-lg bg-secondary">
            <p className="text-xs text-muted-foreground leading-relaxed">
              <span className="font-semibold text-foreground">Note:</span> If a lead is disqualified for the Partner Program, you can still pursue the lead on your own as a direct wholesale deal. The Partner Program criteria is stricter than general wholesaling requirements.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Compliance Checklist */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
            <CheckCircle2 className="w-4 h-4 text-success" />
            Pre-Submission Checklist
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {[
              "Verified market meets ideal criteria",
              "Spoke directly with seller on the phone",
              "Seller genuinely wants to sell",
              "Asking price <= 90% of Zestimate",
              "Property is NOT listed FSBO",
              "Property is NOT on the MLS",
              "Property is NOT under contract with another wholesaler",
              "Property is NOT in OR, IL, SC, or PA",
              "Seller motivation score >= 5/10",
              "Seller timeline is within 90 days",
              "Appointment booked via Partner calendar",
              "All qualification questions answered",
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2 p-2 rounded bg-secondary text-xs">
                <div className="w-4 h-4 rounded border border-border shrink-0" />
                <span className="text-foreground">{item}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
