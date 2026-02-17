"use client"

import { useState, useEffect, useRef, useTransition } from "react"
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
  Megaphone,
  Users,
  TrendingUp,
  Building2,
  Sparkles,
  Loader2,
  CheckCircle2,
  ExternalLink,
  BookOpen,
  Send,
  Plus,
  Trash2,
} from "lucide-react"
import {
  generateZillowDiscountAd,
  generateRentalROIAd,
  generateFBGroupPost,
  generateEmailBlast,
  calculateROI,
  calculateRentalCashflow,
  BUYER_SEGMENTS,
  DISPO_PRICE_STRATEGY,
  DISPO_BUYER_CHANNELS,
  DISPO_SAMPLE_ADS,
  DISPO_CTA_IDEAS,
  DISPO_OBJECTION_ZILLOW,
  DISPO_BUYER_CHECKLIST,
} from "@/lib/wholesaling-engine"
import { aiGenerateDispoMarketing } from "@/app/actions/ai-actions"
import type { AppStore, PrefillData } from "@/lib/store"

type PageId = "dashboard" | "finder" | "scout" | "market" | "deal" | "qualification" | "pipeline" | "outreach" | "partner" | "dispo" | "kpi"

interface DispoBuyerEngineProps {
  store: AppStore
  onNavigate: (page: PageId, data?: PrefillData) => void
  prefillData?: PrefillData
}

export function DispoBuyerEngine({ store, onNavigate, prefillData }: DispoBuyerEngineProps) {
  const [address, setAddress] = useState("")
  const [listPrice, setListPrice] = useState(0)
  const [assignmentPrice, setAssignmentPrice] = useState(0)
  const [arv, setArv] = useState(0)
  const [repairCost, setRepairCost] = useState(0)
  const didPrefill = useRef(false)

  // Auto-fill from prefillData (from Pipeline)
  useEffect(() => {
    if (!prefillData || didPrefill.current) return
    if (prefillData.address || prefillData.listPrice) {
      setAddress(prefillData.address || "")
      setListPrice(prefillData.listPrice || 0)
      setAssignmentPrice(prefillData.assignmentPrice || 0)
      setArv(prefillData.arv || 0)
      setRepairCost(prefillData.repairEstimate || 0)
      didPrefill.current = true
    }
  }, [prefillData])
  const [monthlyRent, setMonthlyRent] = useState(0)
  const [holdingMonths, setHoldingMonths] = useState(6)
  const [propertyDetails, setPropertyDetails] = useState("")
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [aiMarketing, setAiMarketing] = useState<{
    zillowDiscountAd: string
    rentalROIAd: string
    fbGroupPost: string
    emailBlastCopy: string
    realtorPitch: string
    turnkeyAd: string
    brrrAd: string
    objectionHandlers: { objection: string; response: string }[]
  } | null>(null)

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch { /* noop */ }
  }

  const handleAIGenerate = () => {
    startTransition(async () => {
      const res = await aiGenerateDispoMarketing(
        address, assignmentPrice - 5000, assignmentPrice, arv,
        repairCost, monthlyRent, listPrice, propertyDetails
      )
      if (res.success && res.data) {
        setAiMarketing(res.data)
      }
    })
  }

  const CopyBtn = ({ id, text }: { id: string; text: string }) => (
    <Button size="sm" variant="outline" onClick={() => handleCopy(id, text)} className="text-xs shrink-0">
      {copiedId === id ? <><Check className="w-3 h-3 mr-1" />Copied</> : <><Copy className="w-3 h-3 mr-1" />Copy</>}
    </Button>
  )

  const roiData = assignmentPrice > 0 && arv > 0 ? calculateROI(assignmentPrice, repairCost, arv, holdingMonths) : null
  const cashflowData = assignmentPrice > 0 && monthlyRent > 0 ? calculateRentalCashflow(assignmentPrice, monthlyRent, repairCost) : null

  const standardAds = [
    { id: "zillow-ad", label: "Below Zillow", content: aiMarketing?.zillowDiscountAd || generateZillowDiscountAd(address, listPrice, assignmentPrice) },
    { id: "rental-roi", label: "Rental ROI", content: aiMarketing?.rentalROIAd || generateRentalROIAd(address, assignmentPrice, monthlyRent || 1200) },
    { id: "fb-post", label: "FB Group", content: aiMarketing?.fbGroupPost || generateFBGroupPost(address, assignmentPrice, arv, repairCost) },
    { id: "email-blast", label: "Email Blast", content: aiMarketing?.emailBlastCopy || generateEmailBlast(address, assignmentPrice, arv, repairCost) },
    { id: "realtor-pitch", label: "Realtor Pitch", content: aiMarketing?.realtorPitch || `I've got a property under contract at a better price than it's listed for at ${address || "[Address]"}. Looking for $${assignmentPrice.toLocaleString()}. You have anyone looking for a light flip or easy rental? Happy to offer a 1-2% finder's fee.` },
    { id: "turnkey-ad", label: "Turnkey Ad", content: aiMarketing?.turnkeyAd || DISPO_SAMPLE_ADS[2].template(address, listPrice, assignmentPrice, monthlyRent) },
    { id: "brrr-ad", label: "BRRRR Ad", content: aiMarketing?.brrrAd || `BRRRR Opportunity - ${address || "[Address]"}\nPurchase: $${assignmentPrice.toLocaleString()}\nEst. ARV: $${arv.toLocaleString()}\nRehab: $${repairCost.toLocaleString()}\nRent: $${(monthlyRent || 1200).toLocaleString()}/mo\nPerfect for Buy, Rehab, Rent, Refinance, Repeat strategy.\nDM for deal packet.` },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-foreground tracking-tight">
          Dispo & Buyer Engine
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          AI-powered marketing, ROI projections, buyer targeting, and dispo training
        </p>
      </div>

      {/* Deal Input */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
            <Megaphone className="w-4 h-4 text-primary" />
            Deal Details for Marketing
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-2 col-span-2">
              <Label className="text-xs text-muted-foreground">Address</Label>
              <Input placeholder="123 Main St" value={address} onChange={(e) => setAddress(e.target.value)} className="bg-secondary border-border text-foreground" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Original List ($)</Label>
              <Input type="number" value={listPrice || ""} onChange={(e) => setListPrice(Number(e.target.value))} className="bg-secondary border-border text-foreground" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Assignment Price ($)</Label>
              <Input type="number" value={assignmentPrice || ""} onChange={(e) => setAssignmentPrice(Number(e.target.value))} className="bg-secondary border-border text-foreground" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">ARV ($)</Label>
              <Input type="number" value={arv || ""} onChange={(e) => setArv(Number(e.target.value))} className="bg-secondary border-border text-foreground" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Est. Repairs ($)</Label>
              <Input type="number" value={repairCost || ""} onChange={(e) => setRepairCost(Number(e.target.value))} className="bg-secondary border-border text-foreground" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Monthly Rent ($)</Label>
              <Input type="number" value={monthlyRent || ""} onChange={(e) => setMonthlyRent(Number(e.target.value))} className="bg-secondary border-border text-foreground" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Holding (months)</Label>
              <Input type="number" value={holdingMonths || ""} onChange={(e) => setHoldingMonths(Number(e.target.value))} className="bg-secondary border-border text-foreground" />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Property Details (for AI)</Label>
            <Input placeholder="e.g., 3/2, 1488 sqft, vacant, light cosmetic rehab" value={propertyDetails} onChange={(e) => setPropertyDetails(e.target.value)} className="bg-secondary border-border text-foreground" />
          </div>
          <Button onClick={handleAIGenerate} disabled={isPending || !address} variant="outline" className="w-full">
            {isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating AI Marketing...</> : <><Sparkles className="w-4 h-4 mr-2" />AI Generate All Marketing</>}
          </Button>
        </CardContent>
      </Card>

      {/* ROI Projections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
              <TrendingUp className="w-4 h-4 text-success" />Fix & Flip ROI
            </CardTitle>
          </CardHeader>
          <CardContent>
            {roiData ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded bg-secondary"><span className="text-muted-foreground">Total Investment</span><p className="font-mono font-bold text-foreground">${roiData.totalInvestment.toLocaleString()}</p></div>
                  <div className="p-2 rounded bg-secondary"><span className="text-muted-foreground">Holding Costs</span><p className="font-mono font-bold text-foreground">${roiData.holdingCosts.toLocaleString()}</p></div>
                  <div className="p-2 rounded bg-secondary"><span className="text-muted-foreground">Selling Costs</span><p className="font-mono font-bold text-foreground">${roiData.sellingCosts.toLocaleString()}</p></div>
                  <div className="p-2 rounded bg-secondary"><span className="text-muted-foreground">Total Costs</span><p className="font-mono font-bold text-foreground">${roiData.totalCosts.toLocaleString()}</p></div>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg border border-success/30 bg-success/5">
                  <div><p className="text-xs text-muted-foreground">Profit</p><p className={`text-xl font-bold font-mono ${roiData.profit > 0 ? "text-success" : "text-destructive"}`}>${roiData.profit.toLocaleString()}</p></div>
                  <div className="text-right"><p className="text-xs text-muted-foreground">ROI</p><p className={`text-xl font-bold font-mono ${roiData.roi > 0 ? "text-success" : "text-destructive"}`}>{roiData.roi}%</p></div>
                </div>
              </div>
            ) : <p className="text-xs text-muted-foreground text-center py-6">Enter assignment price and ARV</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
              <Building2 className="w-4 h-4 text-primary" />Rental Cashflow
            </CardTitle>
          </CardHeader>
          <CardContent>
            {cashflowData ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded bg-secondary"><span className="text-muted-foreground">Est. PITI</span><p className="font-mono font-bold text-foreground">${cashflowData.monthlyPITI.toLocaleString()}/mo</p></div>
                  <div className="p-2 rounded bg-secondary"><span className="text-muted-foreground">Vacancy</span><p className="font-mono font-bold text-foreground">${cashflowData.vacancy.toLocaleString()}/mo</p></div>
                  <div className="p-2 rounded bg-secondary"><span className="text-muted-foreground">Maintenance</span><p className="font-mono font-bold text-foreground">${cashflowData.maintenance.toLocaleString()}/mo</p></div>
                  <div className="p-2 rounded bg-secondary"><span className="text-muted-foreground">Management</span><p className="font-mono font-bold text-foreground">${cashflowData.management.toLocaleString()}/mo</p></div>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg border border-primary/30 bg-primary/5">
                  <div><p className="text-xs text-muted-foreground">Net Monthly</p><p className={`text-xl font-bold font-mono ${cashflowData.netCashflow > 0 ? "text-success" : "text-destructive"}`}>${cashflowData.netCashflow.toLocaleString()}/mo</p></div>
                  <div className="text-right"><p className="text-xs text-muted-foreground">Cash-on-Cash</p><p className={`text-xl font-bold font-mono ${cashflowData.cashOnCashReturn > 0 ? "text-success" : "text-destructive"}`}>{cashflowData.cashOnCashReturn}%</p></div>
                </div>
              </div>
            ) : <p className="text-xs text-muted-foreground text-center py-6">Enter assignment price and monthly rent</p>}
          </CardContent>
        </Card>
      </div>

      {/* Marketing Materials */}
      <Tabs defaultValue="zillow-ad" className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Marketing Materials</h2>
        <TabsList className="flex flex-wrap w-full bg-secondary gap-1 h-auto p-1">
          {standardAds.map((ad) => (
            <TabsTrigger key={ad.id} value={ad.id} className="text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <span className="truncate">{ad.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>
        {standardAds.map((ad) => (
          <TabsContent key={ad.id} value={ad.id}>
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold text-foreground">{ad.label}</CardTitle>
                  <CopyBtn id={ad.id} text={ad.content} />
                </div>
              </CardHeader>
              <CardContent>
                <Textarea readOnly value={ad.content} className="min-h-[180px] bg-secondary border-border text-foreground text-sm leading-relaxed font-mono resize-none" />
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {/* Dispo Training */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-primary" />
          Dispo Training Guide
        </h2>

        {/* Price Positioning */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-foreground">Price Positioning Strategy</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-primary font-semibold mb-2">{DISPO_PRICE_STRATEGY.goal}</p>
            <ul className="space-y-1.5">
              {DISPO_PRICE_STRATEGY.tactics.map((t, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-foreground">
                  <CheckCircle2 className="w-3 h-3 text-success shrink-0 mt-0.5" />{t}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Buyer Channels */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {DISPO_BUYER_CHANNELS.map((ch, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold text-foreground">{ch.channel}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                {"priority" in ch && (
                  <div><span className="text-muted-foreground">Priority:</span>
                    <div className="flex flex-wrap gap-1 mt-1">{ch.priority.map((p, j) => <Badge key={j} variant="outline" className="text-xs border-primary/30 text-primary">{p}</Badge>)}</div>
                  </div>
                )}
                {"methods" in ch && (
                  <div><span className="text-muted-foreground">Methods:</span>
                    <div className="flex flex-wrap gap-1 mt-1">{ch.methods.map((m, j) => <Badge key={j} variant="outline" className="text-xs border-accent/30 text-accent">{m}</Badge>)}</div>
                  </div>
                )}
                {"tips" in ch && (
                  <ul className="space-y-1">{ch.tips.map((t, j) => <li key={j} className="text-foreground flex items-start gap-1.5"><span className="text-primary shrink-0">-</span>{t}</li>)}</ul>
                )}
                {"filters" in ch && (
                  <div><span className="text-muted-foreground">Filters:</span>
                    <div className="flex flex-wrap gap-1 mt-1">{ch.filters.map((f, j) => <Badge key={j} variant="outline" className="text-xs">{f}</Badge>)}</div>
                  </div>
                )}
                {"tactics" in ch && (
                  <div><span className="text-muted-foreground">Tactics:</span>
                    <div className="flex flex-wrap gap-1 mt-1">{ch.tactics.map((t, j) => <Badge key={j} variant="outline" className="text-xs border-accent/30 text-accent">{t}</Badge>)}</div>
                  </div>
                )}
                {"bestFor" in ch && (
                  <div><span className="text-muted-foreground">Best for:</span> {ch.bestFor.join(", ")}</div>
                )}
                {"howToFind" in ch && (
                  <ul className="space-y-1">{ch.howToFind.map((h, j) => <li key={j} className="text-foreground flex items-start gap-1.5"><span className="text-primary shrink-0">-</span>{h}</li>)}</ul>
                )}
                {"pitch" in ch && (
                  <div className="p-2 rounded bg-secondary italic text-foreground">{`"${ch.pitch}"`}</div>
                )}
                {"note" in ch && <p className="text-muted-foreground">{ch.note}</p>}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Zillow Objection Handler */}
        <Card className="border-primary/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-foreground">Handling: {`"${DISPO_OBJECTION_ZILLOW.objection}"`}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-foreground leading-relaxed p-3 rounded-lg bg-secondary italic">{`"${DISPO_OBJECTION_ZILLOW.response}"`}</p>
            <div className="flex flex-wrap gap-1.5">
              {DISPO_OBJECTION_ZILLOW.keys.map((k, i) => (
                <Badge key={i} variant="outline" className="text-xs border-success/30 text-success">{k}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* AI Objection Handlers */}
        {aiMarketing?.objectionHandlers && aiMarketing.objectionHandlers.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold text-foreground flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-accent" />AI-Generated Buyer Objection Handlers
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {aiMarketing.objectionHandlers.map((oh, i) => (
                <div key={i} className="p-3 rounded-lg bg-secondary space-y-1">
                  <p className="text-xs font-semibold text-destructive">{`"${oh.objection}"`}</p>
                  <p className="text-xs text-foreground leading-relaxed">{oh.response}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* CTA Ideas */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-foreground">CTA Ideas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {DISPO_CTA_IDEAS.map((cta, i) => (
                <button key={i} onClick={() => handleCopy(`cta-${i}`, cta)} className="px-3 py-1.5 rounded-lg bg-secondary text-xs text-foreground hover:bg-primary/10 transition-colors cursor-pointer">
                  {cta}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Buyer Checklist */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-foreground">Make It Easy to Buy - Checklist</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {DISPO_BUYER_CHECKLIST.map((item, i) => (
                <div key={i} className="flex items-center gap-2 p-2 rounded bg-secondary text-xs text-foreground">
                  <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0" />{item}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Your Buyer List */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3">Your Buyer List ({store.savedBuyers.length})</h2>
        <BuyerManager store={store} address={address} assignmentPrice={assignmentPrice} />
      </div>

      {/* Buyer Segments */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3">Buyer Segments</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {BUYER_SEGMENTS.map((segment) => (
            <Card key={segment.type}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">{segment.type}</h3>
                </div>
                <div className="space-y-2 text-xs">
                  <div><span className="text-muted-foreground">Criteria:</span><p className="text-foreground">{segment.criteria}</p></div>
                  <div><span className="text-muted-foreground">Strategy:</span><Badge variant="outline" className="ml-1 text-xs border-primary/30 text-primary">{segment.strategy}</Badge></div>
                  <div><span className="text-muted-foreground">Ideal Deal:</span><p className="text-foreground">{segment.idealDeal}</p></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}

// --- Buyer Manager Sub-Component ---

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

function BuyerManager({ store, address, assignmentPrice }: { store: AppStore; address: string; assignmentPrice: number }) {
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [buyerType, setBuyerType] = useState<"cash-buyer" | "landlord" | "llc" | "fix-flip" | "brrrr" | "turnkey" | "other">("cash-buyer")
  const [buyBox, setBuyBox] = useState("")
  const [maxPrice, setMaxPrice] = useState(0)
  const [notes, setNotes] = useState("")

  const handleAddBuyer = () => {
    if (!name) return
    store.addBuyer({
      name, email, phone, type: buyerType, buyBox, maxPrice, notes,
      markets: [], lastContact: new Date().toISOString(),
    })
    setShowForm(false)
    setName(""); setEmail(""); setPhone(""); setBuyBox(""); setMaxPrice(0); setNotes("")
  }

  const handleBlast = (buyerId: string, buyerEmail: string) => {
    const subject = encodeURIComponent(`Deal Alert: ${address} - $${assignmentPrice.toLocaleString()}`)
    const body = encodeURIComponent(`Hi,\n\nI have a property under contract:\n\nAddress: ${address}\nAssignment Price: $${assignmentPrice.toLocaleString()}\n\nLet me know if you'd like the full deal packet.\n\nBest`)
    window.open(`mailto:${buyerEmail}?subject=${subject}&body=${body}`, "_blank")
    store.updateBuyer(buyerId, { dealsSent: (store.savedBuyers.find(b => b.id === buyerId)?.dealsSent || 0) + 1, lastContact: new Date().toISOString() })
  }

  return (
    <div className="space-y-3">
      {store.savedBuyers.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {store.savedBuyers.map((buyer) => (
            <Card key={buyer.id}>
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-primary" />
                    <span className="text-sm font-semibold text-foreground">{buyer.name}</span>
                    <Badge variant="outline" className="text-[10px]">{buyer.type}</Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    {buyer.email && address && assignmentPrice > 0 && (
                      <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => handleBlast(buyer.id, buyer.email)}>
                        <Send className="w-3 h-3 mr-1" />Blast
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="text-xs h-7 text-destructive" onClick={() => store.removeBuyer(buyer.id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground grid grid-cols-2 gap-1">
                  {buyer.email && <span>{buyer.email}</span>}
                  {buyer.phone && <span>{buyer.phone}</span>}
                  {buyer.maxPrice > 0 && <span>Max: ${buyer.maxPrice.toLocaleString()}</span>}
                  <span>Deals sent: {buyer.dealsSent}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showForm ? (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div><Label className="text-xs mb-1 block text-muted-foreground">Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} className="h-8 text-xs bg-secondary border-border text-foreground" /></div>
              <div><Label className="text-xs mb-1 block text-muted-foreground">Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-8 text-xs bg-secondary border-border text-foreground" /></div>
              <div><Label className="text-xs mb-1 block text-muted-foreground">Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} className="h-8 text-xs bg-secondary border-border text-foreground" /></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs mb-1 block text-muted-foreground">Buyer Type</Label>
                <Select value={buyerType} onValueChange={(v) => setBuyerType(v as typeof buyerType)}>
                  <SelectTrigger className="h-8 text-xs bg-secondary border-border text-foreground"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash-buyer">Cash Buyer</SelectItem>
                    <SelectItem value="landlord">Landlord</SelectItem>
                    <SelectItem value="llc">LLC Investor</SelectItem>
                    <SelectItem value="fix-flip">Fix & Flip</SelectItem>
                    <SelectItem value="brrrr">BRRRR</SelectItem>
                    <SelectItem value="turnkey">Turnkey</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs mb-1 block text-muted-foreground">Buy Box / Markets</Label><Input value={buyBox} onChange={(e) => setBuyBox(e.target.value)} className="h-8 text-xs bg-secondary border-border text-foreground" placeholder="e.g. Memphis 3/2, <$150k" /></div>
              <div><Label className="text-xs mb-1 block text-muted-foreground">Max Price</Label><Input type="number" value={maxPrice || ""} onChange={(e) => setMaxPrice(Number(e.target.value))} className="h-8 text-xs bg-secondary border-border text-foreground" /></div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAddBuyer} disabled={!name} className="text-xs"><Plus className="w-3 h-3 mr-1" />Save Buyer</Button>
              <Button size="sm" variant="outline" onClick={() => setShowForm(false)} className="text-xs">Cancel</Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setShowForm(true)} className="text-xs">
          <Plus className="w-3 h-3 mr-1.5" />Add Buyer
        </Button>
      )}
    </div>
  )
}
