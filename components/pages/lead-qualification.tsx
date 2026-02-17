"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  UserCheck,
  Shield,
  ShieldX,
  ShieldAlert,
  ArrowRight,
  GitBranch,
  MessageSquare,
} from "lucide-react"
import { qualifyLead, US_STATES, type LeadQualification } from "@/lib/wholesaling-engine"
import type { AppStore, PrefillData } from "@/lib/store"

type PageId = "dashboard" | "finder" | "scout" | "market" | "deal" | "qualification" | "pipeline" | "outreach" | "partner" | "dispo" | "kpi"

interface LeadQualificationPageProps {
  store: AppStore
  onNavigate: (page: PageId, data?: PrefillData) => void
  prefillData?: PrefillData
}

export function LeadQualificationPage({ store, onNavigate, prefillData }: LeadQualificationPageProps) {
  const [sellerName, setSellerName] = useState("")
  const [sellerPhone, setSellerPhone] = useState("")
  const [sellerEmail, setSellerEmail] = useState("")
  const [address, setAddress] = useState("")
  const [city, setCity] = useState("")
  const [stateVal, setStateVal] = useState("")
  const [formData, setFormData] = useState({
    isOwner: true,
    isMotivated: true,
    isListedFSBO: false,
    isListedMLS: false,
    isUnderContract: false,
    askingPrice: 0,
    zestimate: 0,
    sellerMotivation: 5,
    saleTimeline: 30,
    state: "",
  })
  const [result, setResult] = useState<LeadQualification | null>(null)
  const [addedToPipeline, setAddedToPipeline] = useState(false)
  const didPrefill = useRef(false)

  // Auto-fill from prefillData
  useEffect(() => {
    if (!prefillData || didPrefill.current) return
    if (prefillData.address || prefillData.listPrice || prefillData.sellerName) {
      setAddress(prefillData.address || "")
      setCity(prefillData.city || "")
      setStateVal(prefillData.state || "")
      setSellerName(prefillData.sellerName || "")
      setSellerPhone(prefillData.sellerPhone || "")
      setSellerEmail(prefillData.sellerEmail || "")
      setFormData((prev) => ({
        ...prev,
        askingPrice: prefillData.askingPrice || prefillData.listPrice || prev.askingPrice,
        zestimate: prefillData.zestimate || prev.zestimate,
        sellerMotivation: prefillData.motivationScore || prev.sellerMotivation,
        state: prefillData.state || prev.state,
      }))
      didPrefill.current = true
    }
  }, [prefillData])

  const handleQualify = () => {
    const askingPriceRatio = formData.zestimate > 0 ? formData.askingPrice / formData.zestimate : 1
    const qualification = qualifyLead({ ...formData, state: stateVal || formData.state, askingPriceRatio })
    setResult(qualification)
    setAddedToPipeline(false)
  }

  const handleAddToPipeline = () => {
    if (!result) return
    const arv = prefillData?.arv || 0
    const repairEstimate = prefillData?.repairEstimate || 0
    const mao = prefillData?.mao || (arv > 0 ? arv * 0.7 - repairEstimate : 0)

    store.addLead({
      address,
      city,
      state: stateVal || formData.state,
      listPrice: formData.askingPrice,
      zestimate: formData.zestimate,
      askingPrice: formData.askingPrice,
      sellerName,
      sellerPhone,
      sellerEmail,
      leadSource: (prefillData?.leadSource as "zillow" | "cold-call" | "sms" | "facebook" | "website" | "referral" | "other") || "other",
      status: result.qualified ? "qualified" : "new",
      motivationScore: formData.sellerMotivation,
      keywords: [],
      notes: result.qualified
        ? "Qualified via Partner Program checks"
        : `Qualification: ${result.badge} - ${result.reasons.join(", ")}`,
      lastContact: new Date().toISOString(),
      partnerEligible: result.qualified,
      arv,
      repairEstimate,
      mao,
      assignmentPrice: 0,
    })

    if (result.qualified) {
      store.bumpKpi("qualifiedLeads")
    }
    setAddedToPipeline(true)
  }

  const handleSendToOutreach = () => {
    onNavigate("outreach", {
      sellerName,
      sellerPhone,
      sellerEmail,
      address,
      city,
      state: stateVal || formData.state,
      listPrice: formData.askingPrice,
      zestimate: formData.zestimate,
      motivationScore: formData.sellerMotivation,
    })
  }

  const handleReset = () => {
    setFormData({ isOwner: true, isMotivated: true, isListedFSBO: false, isListedMLS: false, isUnderContract: false, askingPrice: 0, zestimate: 0, sellerMotivation: 5, saleTimeline: 30, state: "" })
    setResult(null)
    setAddress("")
    setCity("")
    setStateVal("")
    setSellerName("")
    setSellerPhone("")
    setSellerEmail("")
    setAddedToPipeline(false)
    didPrefill.current = false
  }

  const badgeConfig = {
    eligible: { icon: Shield, color: "bg-success text-success-foreground", label: "Partner Eligible" },
    ineligible: { icon: ShieldX, color: "bg-destructive text-destructive-foreground", label: "Ineligible" },
    "manual-review": { icon: ShieldAlert, color: "bg-warning text-warning-foreground", label: "Manual Review" },
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-foreground tracking-tight">Lead Qualification</h1>
        <p className="text-sm text-muted-foreground mt-1">Qualify leads, then add to pipeline or generate outreach in one click.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
              <UserCheck className="w-4 h-4 text-primary" />Lead Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Seller Info */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Seller Name</Label>
                <Input placeholder="John Doe" value={sellerName} onChange={(e) => setSellerName(e.target.value)} className="bg-secondary border-border text-foreground" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Phone</Label>
                <Input placeholder="555-123-4567" value={sellerPhone} onChange={(e) => setSellerPhone(e.target.value)} className="bg-secondary border-border text-foreground" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Email</Label>
                <Input placeholder="seller@email.com" value={sellerEmail} onChange={(e) => setSellerEmail(e.target.value)} className="bg-secondary border-border text-foreground" />
              </div>
            </div>

            {/* Property Info */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-2 sm:col-span-1">
                <Label className="text-xs text-muted-foreground">Address</Label>
                <Input placeholder="123 Main St" value={address} onChange={(e) => setAddress(e.target.value)} className="bg-secondary border-border text-foreground" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">City</Label>
                <Input placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} className="bg-secondary border-border text-foreground" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">State</Label>
                <Select value={stateVal || formData.state} onValueChange={(val) => { setStateVal(val); setFormData({ ...formData, state: val }) }}>
                  <SelectTrigger className="bg-secondary border-border text-foreground"><SelectValue placeholder="State" /></SelectTrigger>
                  <SelectContent>{US_STATES.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}</SelectContent>
                </Select>
              </div>
            </div>

            {/* Toggle Questions */}
            <div className="space-y-3">
              {[
                { key: "isOwner", label: "Seller is property owner?", val: formData.isOwner },
                { key: "isMotivated", label: "Seller appears motivated?", val: formData.isMotivated },
                { key: "isListedFSBO", label: "Listed as FSBO?", val: formData.isListedFSBO },
                { key: "isListedMLS", label: "Listed on MLS?", val: formData.isListedMLS },
                { key: "isUnderContract", label: "Already under contract?", val: formData.isUnderContract },
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between p-3 rounded-lg bg-secondary">
                  <Label className="text-xs text-foreground">{item.label}</Label>
                  <Switch checked={item.val} onCheckedChange={(checked) => setFormData({ ...formData, [item.key]: checked })} />
                </div>
              ))}
            </div>

            {/* Price Fields */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Asking Price ($)</Label>
                <Input type="number" placeholder="e.g., 120000" value={formData.askingPrice || ""} onChange={(e) => setFormData({ ...formData, askingPrice: Number(e.target.value) })} className="bg-secondary border-border text-foreground" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Zestimate ($)</Label>
                <Input type="number" placeholder="e.g., 140000" value={formData.zestimate || ""} onChange={(e) => setFormData({ ...formData, zestimate: Number(e.target.value) })} className="bg-secondary border-border text-foreground" />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Motivation Score</Label>
                <span className="text-sm font-bold font-mono text-foreground">{formData.sellerMotivation}/10</span>
              </div>
              <Slider value={[formData.sellerMotivation]} onValueChange={([val]) => setFormData({ ...formData, sellerMotivation: val })} min={1} max={10} step={1} />
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Sale Timeline (days)</Label>
              <Input type="number" placeholder="e.g., 30" value={formData.saleTimeline || ""} onChange={(e) => setFormData({ ...formData, saleTimeline: Number(e.target.value) })} className="bg-secondary border-border text-foreground" />
            </div>

            <div className="flex gap-3 pt-2">
              <Button onClick={handleQualify} className="flex-1">Qualify Lead</Button>
              <Button onClick={handleReset} variant="outline">Reset</Button>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        <div className="space-y-4">
          {result ? (
            <>
              <Card>
                <CardContent className="p-6 text-center">
                  {(() => {
                    const config = badgeConfig[result.badge]
                    const BadgeIcon = config.icon
                    return (
                      <>
                        <BadgeIcon className={`w-12 h-12 mx-auto mb-3 ${result.badge === "eligible" ? "text-success" : result.badge === "ineligible" ? "text-destructive" : "text-warning"}`} />
                        <Badge className={`${config.color} text-sm px-4 py-1`}>{config.label}</Badge>
                        <p className="text-xs text-muted-foreground mt-3">
                          {result.qualified ? "This lead passes all Partner Program qualification checks." : result.badge === "manual-review" ? "This lead has minor issues that may require manual review." : "This lead does not meet Partner Program requirements."}
                        </p>
                      </>
                    )
                  })()}
                </CardContent>
              </Card>

              {/* Flow Action Bar */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20 flex-wrap">
                <Button size="sm" variant="outline" className="text-xs" onClick={handleAddToPipeline} disabled={addedToPipeline}>
                  <GitBranch className="w-3 h-3 mr-1.5" />{addedToPipeline ? "Added to Pipeline" : "Add to Pipeline"}
                </Button>
                <Button size="sm" className="text-xs" onClick={handleSendToOutreach}>
                  <MessageSquare className="w-3 h-3 mr-1.5" />Generate Outreach
                  <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
                {result.qualified && (
                  <Button size="sm" variant="outline" className="text-xs" onClick={() => { onNavigate("partner", { sellerName, sellerPhone, sellerEmail, address, city, state: stateVal, askingPrice: formData.askingPrice, zestimate: formData.zestimate }) }}>
                    Submit to Partner
                    <ArrowRight className="w-3 h-3 ml-1" />
                  </Button>
                )}
              </div>

              {result.passedChecks.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-semibold text-success flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />Passed ({result.passedChecks.length})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-1.5">{result.passedChecks.map((p, i) => (<li key={i} className="flex items-center gap-2 text-xs text-foreground"><CheckCircle2 className="w-3 h-3 text-success shrink-0" />{p}</li>))}</ul>
                  </CardContent>
                </Card>
              )}

              {result.reasons.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-semibold text-destructive flex items-center gap-2"><XCircle className="w-4 h-4" />Issues ({result.reasons.length})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-1.5">{result.reasons.map((r, i) => (<li key={i} className="flex items-center gap-2 text-xs text-foreground"><XCircle className="w-3 h-3 text-destructive shrink-0" />{r}</li>))}</ul>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card className="h-full flex items-center justify-center min-h-[300px]">
              <CardContent className="text-center py-12">
                <UserCheck className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Enter lead details to check Partner qualification</p>
                <p className="text-xs text-muted-foreground mt-1">Qualified leads can flow directly to Pipeline or Outreach</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
