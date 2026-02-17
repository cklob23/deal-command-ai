"use client"

import { useState, useTransition } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sparkles,
  Loader2,
  ExternalLink,
  ArrowRight,
  Home,
  Mountain,
  Target,
  DollarSign,
  AlertTriangle,
  Send,
  Mail,
  MessageSquare,
  Phone,
  Plus,
  ChevronDown,
  ChevronUp,
  Zap,
  MapPin,
  Clock,
  Copy,
  Check,
  TrendingUp,
} from "lucide-react"
import { US_STATES } from "@/lib/wholesaling-engine"
import { aiScoutProperties, aiGenerateAutomatedOutreach } from "@/app/actions/ai-actions"
import type { AppStore, PrefillData } from "@/lib/store"
import { buildAllListingUrls } from "@/lib/listing-urls"

type PageId = "dashboard" | "finder" | "scout" | "market" | "deal" | "qualification" | "pipeline" | "outreach" | "partner" | "dispo" | "kpi"

interface ScoutedProperty {
  address: string
  city: string
  state: string
  zipCode: string
  estimatedListPrice: number
  estimatedARV: number
  estimatedRepairs: number
  estimatedMAO: number
  estimatedSpread: number
  propertyType: string
  beds: number
  baths: number
  sqft: number
  yearBuilt: number
  condition: string
  motivatedSellerSignals: string[]
  whyGoodDeal: string
  recommendedOfferRange: { low: number; high: number }
  zillowSearchUrl: string
  realtorSearchUrl: string
  redfinSearchUrl: string
  urgency: string
  sellerType: string
  likelySellerName: string
  likelyAgentName: string
  estimatedDOM: number
  listingStatus: string
}

interface PropertyScoutProps {
  store: AppStore
  onNavigate: (page: PageId, data?: PrefillData) => void
}

export function PropertyScout({ store, onNavigate }: PropertyScoutProps) {
  const [searchType, setSearchType] = useState<"houses" | "land">("houses")
  const [city, setCity] = useState("")
  const [state, setState] = useState("")
  const [medianPrice, setMedianPrice] = useState(250000)
  const [priceMin, setPriceMin] = useState(50000)
  const [priceMax, setPriceMax] = useState(300000)
  const [landUse, setLandUse] = useState("Any")
  const [minAcres, setMinAcres] = useState(0.25)
  const [maxAcres, setMaxAcres] = useState(10)
  const [yourName, setYourName] = useState("")

  const [isPending, startTransition] = useTransition()
  const [isOutreachPending, startOutreachTransition] = useTransition()
  const [scoutDataSources, setScoutDataSources] = useState<{ realData: boolean; sources: string[] }>({ realData: false, sources: [] })
  const [scoutResult, setScoutResult] = useState<{
    properties: ScoutedProperty[]
    marketSummary: string
    bestZipCodes: string[]
    searchTips: string[]
  } | null>(null)
  const [expandedProperty, setExpandedProperty] = useState<string | null>(null)
  const [outreachData, setOutreachData] = useState<Record<string, {
    emails: { subject: string; body: string; type: string; sendDelay: string }[]
    smsMessages: { message: string; type: string; sendDelay: string }[]
    callScript: string
  }>>({})
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [autoStatus, setAutoStatus] = useState<Record<string, "pending" | "pipeline" | "outreach" | "sending" | "done" | "error">>({})
  const [sendResults, setSendResults] = useState<Record<string, { emails: number; sms: number; method: string }>>({})

  // Load from saved market
  const loadFromSavedMarket = (m: typeof store.savedMarkets[0]) => {
    setCity(m.city)
    setState(m.state)
    setSearchType(m.searchType || "houses")
    setMedianPrice(m.medianPrice)
    if (m.searchType === "land") {
      setPriceMin(0)
      setPriceMax(m.landMaxPrice || 100000)
      setLandUse(m.landUse || "Any")
      setMinAcres(m.minAcres || 0.25)
      setMaxAcres(m.maxAcres || 10)
    } else {
      setPriceMin(Math.round(m.medianPrice * 0.4))
      setPriceMax(Math.round(m.medianPrice * 0.85))
    }
  }

  const handleScout = () => {
    if (!city || !state) return
    setError("")
    setScoutResult(null)
    setOutreachData({})
    startTransition(async () => {
      const targetZips = store.savedMarkets
        .filter((m) => m.city === city && m.state === state)
        .flatMap((m) => m.zipCodes)
      const keywords = searchType === "land"
        ? ["owner financing", "motivated", "below market", "must sell", "price reduced", "back taxes"]
        : ["fixer-upper", "needs work", "motivated seller", "cash only", "as-is", "handyman special", "price reduced"]
      const res = await aiScoutProperties(
        city, state, searchType, medianPrice, targetZips, keywords,
        priceMin, priceMax, "30+",
        searchType === "land" ? landUse : undefined,
        searchType === "land" ? minAcres : undefined,
        searchType === "land" ? maxAcres : undefined,
      )
      if (res.success && res.data) {
        setScoutResult(res.data)
        setScoutDataSources({
          realData: !!(res as { realData?: boolean }).realData,
          sources: ((res as { sources?: string[] }).sources) ?? ["AI-Generated"],
        })
      } else {
        setError(res.error || "AI scouting failed")
      }
    })
  }

  const handleGenerateOutreach = (prop: ScoutedProperty) => {
    startOutreachTransition(async () => {
      const res = await aiGenerateAutomatedOutreach(
        yourName,
        prop.address,
        prop.estimatedListPrice,
        prop.recommendedOfferRange,
        prop.motivatedSellerSignals,
        searchType,
      )
      if (res.success && res.data) {
        setOutreachData((prev) => ({ ...prev, [prop.address]: res.data! }))
      }
    })
  }

  const handleAddToPipeline = (prop: ScoutedProperty) => {
    store.addLead({
      address: prop.address,
      city: prop.city,
      state: prop.state,
      listPrice: prop.estimatedListPrice,
      zestimate: prop.estimatedARV,
      askingPrice: prop.estimatedListPrice,
      sellerName: prop.likelySellerName || prop.likelyAgentName || "",
      sellerPhone: "",
      sellerEmail: "",
      leadSource: "ai-scout" as "zillow",
      status: "new",
      motivationScore: prop.urgency === "HIGH" ? 8 : prop.urgency === "MEDIUM" ? 6 : 4,
      keywords: prop.motivatedSellerSignals,
      notes: `AI Scout: ${prop.whyGoodDeal} | ${prop.condition} | ${prop.propertyType} | ${prop.beds}bd/${prop.baths}ba/${prop.sqft}sqft | Built ${prop.yearBuilt} | Seller: ${prop.sellerType}${prop.likelyAgentName ? ` | Agent: ${prop.likelyAgentName}` : ""} | DOM: ${prop.estimatedDOM} | ${prop.listingStatus}`,
      partnerEligible: prop.estimatedListPrice <= prop.estimatedARV * 0.9,
      arv: prop.estimatedARV,
      repairEstimate: prop.estimatedRepairs,
      mao: prop.estimatedMAO,
      assignmentPrice: prop.estimatedMAO,
      lastContact: "",
    })
    store.bumpKpi("leadsContacted")
  }

  const handleAddAllToPipeline = () => {
    if (!scoutResult) return
    scoutResult.properties.forEach((prop) => handleAddToPipeline(prop))
  }

  const handleSendToDealAnalyzer = (prop: ScoutedProperty) => {
    onNavigate("deal", {
      address: prop.address,
      city: prop.city,
      state: prop.state,
      listPrice: prop.estimatedListPrice,
      zestimate: prop.estimatedARV,
      arv: prop.estimatedARV,
      repairEstimate: prop.estimatedRepairs,
    })
  }

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch { /* noop */ }
  }

  // Full Auto Pipeline: Scout -> Pipeline -> Outreach -> Send in one click
  const handleFullAutoPipeline = async (prop: ScoutedProperty) => {
    setAutoStatus((prev) => ({ ...prev, [prop.address]: "pipeline" }))

    // Step 1: Add to pipeline
    handleAddToPipeline(prop)

    // Step 2: Generate outreach
    setAutoStatus((prev) => ({ ...prev, [prop.address]: "outreach" }))
    const outreachRes = await aiGenerateAutomatedOutreach(
      yourName,
      prop.address,
      prop.estimatedListPrice,
      prop.recommendedOfferRange,
      prop.motivatedSellerSignals,
      searchType,
    )

    if (!outreachRes.success || !outreachRes.data) {
      setAutoStatus((prev) => ({ ...prev, [prop.address]: "error" }))
      return
    }

    setOutreachData((prev) => ({ ...prev, [prop.address]: outreachRes.data! }))

    // Step 3: Send via API (initial emails and SMS only)
    setAutoStatus((prev) => ({ ...prev, [prop.address]: "sending" }))
    try {
      const res = await fetch("/api/send-outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emails: outreachRes.data.emails.map((e) => ({
            to: "", // Will use compose links since no seller email yet
            subject: e.subject,
            body: e.body,
            type: e.type,
            sendDelay: e.sendDelay,
          })),
          smsMessages: outreachRes.data.smsMessages.map((s) => ({
            to: "",
            message: s.message,
            type: s.type,
            sendDelay: s.sendDelay,
          })),
          senderName: yourName,
          sendImmediate: true,
        }),
      })
      const data = await res.json()
      setSendResults((prev) => ({
        ...prev,
        [prop.address]: {
          emails: data.summary?.sent || 0,
          sms: data.summary?.sent || 0,
          method: data.results?.[0]?.method || "compose-link",
        },
      }))
      setAutoStatus((prev) => ({ ...prev, [prop.address]: "done" }))
      store.bumpKpi("outreachSent")
    } catch {
      setAutoStatus((prev) => ({ ...prev, [prop.address]: "done" }))
    }
  }

  const handleFullAutoAll = async () => {
    if (!scoutResult) return
    for (const prop of scoutResult.properties) {
      await handleFullAutoPipeline(prop)
    }
  }

  // Build smart search URLs with pre-filled filters
  const buildZillowUrl = (zip?: string) => {
    const base = zip
      ? `https://www.zillow.com/homes/${zip}_rb/`
      : `https://www.zillow.com/${city.toLowerCase().replace(/\s+/g, "-")}-${state.toLowerCase()}/${searchType === "land" ? "land/" : ""}`
    const params = new URLSearchParams()
    if (searchType === "land") {
      params.set("searchQueryState", JSON.stringify({
        filterState: {
          price: { min: priceMin, max: priceMax },
          lot: { min: (minAcres * 43560), max: (maxAcres * 43560) },
          doz: { value: "30" },
          isLotLand: { value: true },
        },
      }))
    } else {
      params.set("searchQueryState", JSON.stringify({
        filterState: {
          price: { min: priceMin, max: priceMax },
          doz: { value: "30" },
          sort: { value: "days" },
        },
      }))
    }
    return base
  }

  const buildRedfinUrl = () => {
    const citySlug = city.replace(/\s+/g, "-")
    return `https://www.redfin.com/city/${citySlug}/${state}/filter/property-type=${searchType === "land" ? "land" : "house"},max-price=${priceMax},min-price=${priceMin},hoa=0,viewport=,,,,include=sold-3mo`
  }

  const buildRealtorUrl = () => {
    const citySlug = city.replace(/\s+/g, "-")
    const type = searchType === "land" ? "land" : "single-family-home"
    return `https://www.realtor.com/realestateandhomes-search/${citySlug}_${state}/type-${type}/price-${priceMin}-${priceMax}/age-1+`
  }

  // Listing URLs use the shared utility in lib/listing-urls.ts

  const getGmailLink = (to: string, subject: string, body: string) => {
    return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  }

  const getSMSLink = (phone: string, body: string) => {
    return `sms:${phone}?body=${encodeURIComponent(body)}`
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground tracking-tight">
            AI Property Scout
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            AI discovers actual properties matching your criteria. One-click to pipeline, outreach, or deal analysis.
          </p>
        </div>
        <div className="flex rounded-lg bg-secondary border border-border p-0.5 self-start md:self-auto">
          <button
            onClick={() => setSearchType("houses")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-sm font-medium transition-colors ${
              searchType === "houses"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Home className="w-3.5 h-3.5" />Houses
          </button>
          <button
            onClick={() => setSearchType("land")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-sm font-medium transition-colors ${
              searchType === "land"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Mountain className="w-3.5 h-3.5" />Land
          </button>
        </div>
      </div>

      {/* Quick Load from Saved Markets */}
      {store.savedMarkets.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="text-xs text-muted-foreground shrink-0">Saved Markets:</span>
          {store.savedMarkets.map((m) => (
            <button
              key={m.id}
              onClick={() => loadFromSavedMarket(m)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs bg-secondary border border-border hover:border-primary/50 text-foreground transition-colors shrink-0"
            >
              {m.searchType === "land" ? <Mountain className="w-3 h-3 text-accent" /> : <Home className="w-3 h-3 text-primary" />}
              {m.city}, {m.state}
              <Badge variant="outline" className={`text-[10px] px-1 py-0 ${m.searchType === "land" ? "text-accent border-accent/30" : "text-primary border-primary/30"}`}>
                {m.searchType === "land" ? "Land" : "Houses"}
              </Badge>
            </button>
          ))}
        </div>
      )}

      {/* Search Config */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
            <Target className="w-4 h-4 text-primary" />
            Scout Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">City</Label>
              <Input
                placeholder="e.g., Jacksonville"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="bg-secondary border-border text-foreground"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">State</Label>
              <Select value={state} onValueChange={setState}>
                <SelectTrigger className="bg-secondary border-border text-foreground">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {US_STATES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Your Name</Label>
              <Input
                placeholder="For outreach scripts"
                value={yourName}
                onChange={(e) => setYourName(e.target.value)}
                className="bg-secondary border-border text-foreground"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Market Median ($)</Label>
              <Input
                type="number"
                value={medianPrice || ""}
                onChange={(e) => setMedianPrice(Number(e.target.value))}
                className="bg-secondary border-border text-foreground"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Min Price ($)</Label>
              <Input
                type="number"
                value={priceMin || ""}
                onChange={(e) => setPriceMin(Number(e.target.value))}
                className="bg-secondary border-border text-foreground"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Max Price ($)</Label>
              <Input
                type="number"
                value={priceMax || ""}
                onChange={(e) => setPriceMax(Number(e.target.value))}
                className="bg-secondary border-border text-foreground"
              />
            </div>
            {searchType === "land" && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Land Use</Label>
                  <Select value={landUse} onValueChange={setLandUse}>
                    <SelectTrigger className="bg-secondary border-border text-foreground">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Any">Any</SelectItem>
                      <SelectItem value="Residential">Residential</SelectItem>
                      <SelectItem value="Commercial">Commercial</SelectItem>
                      <SelectItem value="Agricultural">Agricultural</SelectItem>
                      <SelectItem value="Recreational">Recreational</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Acres Range</Label>
                  <div className="flex gap-1.5">
                    <Input
                      type="number"
                      step="0.25"
                      placeholder="Min"
                      value={minAcres || ""}
                      onChange={(e) => setMinAcres(Number(e.target.value))}
                      className="bg-secondary border-border text-foreground"
                    />
                    <Input
                      type="number"
                      step="0.25"
                      placeholder="Max"
                      value={maxAcres || ""}
                      onChange={(e) => setMaxAcres(Number(e.target.value))}
                      className="bg-secondary border-border text-foreground"
                    />
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Smart Search Links */}
          {city && state && (
            <div className="flex items-center gap-3 flex-wrap pt-2 border-t border-border">
              <span className="text-xs text-muted-foreground">Search live listings:</span>
              <a href={buildZillowUrl()} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                <ExternalLink className="w-3 h-3" />Zillow
              </a>
              <a href={buildRedfinUrl()} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors">
                <ExternalLink className="w-3 h-3" />Redfin
              </a>
              <a href={buildRealtorUrl()} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs bg-accent/10 text-accent hover:bg-accent/20 transition-colors">
                <ExternalLink className="w-3 h-3" />Realtor.com
              </a>
              {searchType === "land" && (
                <>
                  <a href={`https://www.landwatch.com/${state.toLowerCase()}-land-for-sale/${city.toLowerCase().replace(/\s+/g, "-")}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs bg-success/10 text-success hover:bg-success/20 transition-colors">
                    <ExternalLink className="w-3 h-3" />LandWatch
                  </a>
                  <a href={`https://www.landflip.com/search?state=${state}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs bg-warning/10 text-warning hover:bg-warning/20 transition-colors">
                    <ExternalLink className="w-3 h-3" />LandFlip
                  </a>
                </>
              )}
            </div>
          )}

          <Button onClick={handleScout} disabled={isPending || !city || !state} className="w-full">
            {isPending ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Scouting Properties...</>
            ) : (
              <><Sparkles className="w-4 h-4 mr-2" />AI Scout {searchType === "land" ? "Land" : "Properties"}</>
            )}
          </Button>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-xs text-destructive">
              <AlertTriangle className="w-4 h-4 shrink-0" />{error}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Scout Results */}
      {scoutResult && (
        <>
          {/* Summary Bar */}
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                    {scoutResult.properties.length} Properties Found in {city}, {state}
                    {scoutDataSources.realData ? (
                      <span className="inline-flex items-center rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success ring-1 ring-success/30">LIVE DATA</span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-semibold text-warning ring-1 ring-warning/30">AI-SIMULATED</span>
                    )}
                  </p>
                  {scoutDataSources.realData ? (
                    <p className="text-xs text-success font-medium mt-0.5">Real listings from {scoutDataSources.sources.join(", ")} -- verify details before contacting</p>
                  ) : (
                    <p className="text-xs text-warning font-medium mt-0.5">Simulated leads -- verify each property on Zillow/Redfin before contacting</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-0.5">{scoutResult.marketSummary}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" className="text-xs" onClick={handleAddAllToPipeline}>
                    <Plus className="w-3 h-3 mr-1" />Add All to Pipeline
                  </Button>
                  <Button
                    size="sm"
                    className="text-xs bg-success hover:bg-success/90 text-background"
                    onClick={handleFullAutoAll}
                    disabled={Object.values(autoStatus).some((s) => s === "pipeline" || s === "outreach" || s === "sending")}
                  >
                    <Zap className="w-3 h-3 mr-1" />Full Auto Pipeline
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <span className="text-xs text-muted-foreground">Best ZIPs:</span>
                {scoutResult.bestZipCodes.map((zip) => (
                  <a
                    key={zip}
                    href={buildZillowUrl(zip)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-secondary text-xs font-mono text-primary hover:bg-primary/10 transition-colors"
                  >
                    <MapPin className="w-2.5 h-2.5" />{zip}
                    <ExternalLink className="w-2 h-2" />
                  </a>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Search Tips */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold text-foreground">Search Tips</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1">
                {scoutResult.searchTips.map((tip, i) => (
                  <li key={i} className="text-xs text-foreground flex items-start gap-2">
                    <span className="text-primary font-bold shrink-0">{i + 1}.</span>{tip}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Property Cards */}
          <div className="space-y-3">
            {scoutResult.properties.map((prop, idx) => {
              const isExpanded = expandedProperty === prop.address
              const hasOutreach = !!outreachData[prop.address]
              const urgencyColor = prop.urgency === "HIGH"
                ? "text-destructive bg-destructive/10 border-destructive/30"
                : prop.urgency === "MEDIUM"
                  ? "text-warning bg-warning/10 border-warning/30"
                  : "text-muted-foreground bg-secondary border-border"

              return (
                <Card key={idx} className="overflow-hidden">
                  <button
                    className="w-full text-left p-4 flex items-start gap-4"
                    onClick={() => setExpandedProperty(isExpanded ? null : prop.address)}
                  >
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary font-bold text-sm shrink-0">
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-foreground truncate">{prop.address}</p>
                        <Badge variant="outline" className={`text-[10px] ${urgencyColor}`}>
                          {prop.urgency}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">
                          {prop.propertyType}
                        </Badge>
                        {autoStatus[prop.address] && (
                          <Badge variant="outline" className={`text-[10px] ${
                            autoStatus[prop.address] === "done" ? "border-success/30 text-success" :
                            autoStatus[prop.address] === "error" ? "border-destructive/30 text-destructive" :
                            "border-primary/30 text-primary"
                          }`}>
                            {autoStatus[prop.address] === "pipeline" && "Adding to pipeline..."}
                            {autoStatus[prop.address] === "outreach" && "Generating outreach..."}
                            {autoStatus[prop.address] === "sending" && "Sending..."}
                            {autoStatus[prop.address] === "done" && "Auto-pipeline complete"}
                            {autoStatus[prop.address] === "error" && "Error"}
                          </Badge>
                        )}
                        {sendResults[prop.address] && (
                          <Badge variant="outline" className="text-[10px] border-success/30 text-success">
                            Outreach ready ({sendResults[prop.address].method})
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                        <span className="font-mono">${prop.estimatedListPrice.toLocaleString()}</span>
                        <span>{prop.beds}bd / {prop.baths}ba / {prop.sqft.toLocaleString()}sqft</span>
                        <span>{prop.condition}</span>
                        <span className="text-success font-mono font-bold">+${prop.estimatedSpread.toLocaleString()} spread</span>
                        {prop.likelySellerName && (
                          <span className="text-foreground/70">
                            {prop.sellerType === "Agent-Listed" ? "Agent" : "Seller"}: {prop.likelyAgentName || prop.likelySellerName}
                          </span>
                        )}
                        <span>{prop.listingStatus} ({prop.estimatedDOM}d)</span>
                      </div>
                    </div>
                    <div className="shrink-0">
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-4 border-t border-border pt-3">
                      {/* Deal Numbers */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                        <div className="p-2 rounded bg-secondary">
                          <span className="text-muted-foreground">List Price</span>
                          <p className="font-mono font-bold text-foreground">${prop.estimatedListPrice.toLocaleString()}</p>
                        </div>
                        <div className="p-2 rounded bg-secondary">
                          <span className="text-muted-foreground">ARV</span>
                          <p className="font-mono font-bold text-foreground">${prop.estimatedARV.toLocaleString()}</p>
                        </div>
                        <div className="p-2 rounded bg-secondary">
                          <span className="text-muted-foreground">MAO (70% Rule)</span>
                          <p className="font-mono font-bold text-primary">${prop.estimatedMAO.toLocaleString()}</p>
                        </div>
                        <div className="p-2 rounded bg-secondary">
                          <span className="text-muted-foreground">Est. Spread</span>
                          <p className={`font-mono font-bold ${prop.estimatedSpread > 10000 ? "text-success" : prop.estimatedSpread > 0 ? "text-warning" : "text-destructive"}`}>
                            ${prop.estimatedSpread.toLocaleString()}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                        <div className="p-2 rounded bg-secondary">
                          <span className="text-muted-foreground">Repairs</span>
                          <p className="font-mono font-bold text-foreground">${prop.estimatedRepairs.toLocaleString()}</p>
                        </div>
                        <div className="p-2 rounded bg-secondary">
                          <span className="text-muted-foreground">Offer Range</span>
                          <p className="font-mono font-bold text-foreground">
                            ${prop.recommendedOfferRange.low.toLocaleString()} - ${prop.recommendedOfferRange.high.toLocaleString()}
                          </p>
                        </div>
                        <div className="p-2 rounded bg-secondary">
                          <span className="text-muted-foreground">Year Built</span>
                          <p className="font-mono font-bold text-foreground">{prop.yearBuilt}</p>
                        </div>
                        <div className="p-2 rounded bg-secondary">
                          <span className="text-muted-foreground">ZIP</span>
                          <p className="font-mono font-bold text-foreground">{prop.zipCode}</p>
                        </div>
                      </div>

                      {/* Why it's a good deal */}
                      <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                        <div className="flex items-center gap-1.5 mb-1">
                          <TrendingUp className="w-3.5 h-3.5 text-primary" />
                          <span className="text-xs font-semibold text-foreground">Why This Is a Deal</span>
                        </div>
                        <p className="text-xs text-foreground leading-relaxed">{prop.whyGoodDeal}</p>
                      </div>

                      {/* Motivated Seller Signals */}
                      <div className="flex flex-wrap gap-1">
                        {prop.motivatedSellerSignals.map((sig, i) => (
                          <Badge key={i} variant="outline" className="text-[10px] text-warning border-warning/30">{sig}</Badge>
                        ))}
                      </div>

                      {/* Seller / Agent Info */}
                      <div className="p-3 rounded-lg bg-secondary/80 border border-border space-y-1.5">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Seller / Agent Info</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                          <div>
                            <span className="text-muted-foreground">Seller Type</span>
                            <p className="font-medium text-foreground">{prop.sellerType}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Contact Name</span>
                            <p className="font-medium text-foreground">{prop.likelySellerName || "Unknown"}</p>
                          </div>
                          {prop.likelyAgentName && (
                            <div>
                              <span className="text-muted-foreground">Listing Agent</span>
                              <p className="font-medium text-foreground">{prop.likelyAgentName}</p>
                            </div>
                          )}
                          <div>
                            <span className="text-muted-foreground">Status / DOM</span>
                            <p className="font-medium text-foreground">{prop.listingStatus} ({prop.estimatedDOM}d)</p>
                          </div>
                        </div>
                      </div>

                      {/* View This Listing */}
                      {(() => {
                        const urls = buildAllListingUrls(prop.address, prop.city, prop.state, prop.zipCode)
                        return (
                          <div className="flex items-center gap-2 flex-wrap">
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
                            <a href={urls.google} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs bg-foreground/5 text-foreground hover:bg-foreground/10 font-medium transition-colors">
                              <ExternalLink className="w-2.5 h-2.5" />Google Search
                            </a>
                          </div>
                        )
                      })()}

                      {/* Search Similar (comps) */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Find Similar:</span>
                        <a href={prop.zillowSearchUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-secondary text-primary hover:bg-primary/10 transition-colors">
                          <ExternalLink className="w-2.5 h-2.5" />Zillow Comps
                        </a>
                        <a href={prop.redfinSearchUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-secondary text-destructive hover:bg-destructive/10 transition-colors">
                          <ExternalLink className="w-2.5 h-2.5" />Redfin Comps
                        </a>
                        <a href={prop.realtorSearchUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-secondary text-accent hover:bg-accent/10 transition-colors">
                          <ExternalLink className="w-2.5 h-2.5" />Realtor Comps
                        </a>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <Button size="sm" className="text-xs" onClick={() => handleAddToPipeline(prop)}>
                          <Plus className="w-3 h-3 mr-1" />Add to Pipeline
                        </Button>
                        <Button size="sm" variant="outline" className="text-xs" onClick={() => handleSendToDealAnalyzer(prop)}>
                          <DollarSign className="w-3 h-3 mr-1" />Analyze Deal
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs"
                          onClick={() => handleGenerateOutreach(prop)}
                          disabled={isOutreachPending}
                        >
                          {isOutreachPending ? (
                            <><Loader2 className="w-3 h-3 mr-1 animate-spin" />Generating...</>
                          ) : (
                            <><Zap className="w-3 h-3 mr-1" />Auto Outreach</>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs"
                          onClick={() => onNavigate("outreach", {
                            address: prop.address,
                            city: prop.city,
                            state: prop.state,
                            listPrice: prop.estimatedListPrice,
                            arv: prop.estimatedARV,
                            repairEstimate: prop.estimatedRepairs,
                            sellerName: prop.likelyAgentName || prop.likelySellerName || "",
                            motivationScore: prop.urgency === "HIGH" ? 8 : prop.urgency === "MEDIUM" ? 6 : 4,
                          })}
                        >
                          <Send className="w-3 h-3 mr-1" />Full Outreach
                        </Button>
                        <Button
                          size="sm"
                          className="text-xs bg-success hover:bg-success/90 text-background"
                          onClick={() => handleFullAutoPipeline(prop)}
                          disabled={!!autoStatus[prop.address] && autoStatus[prop.address] !== "done" && autoStatus[prop.address] !== "error"}
                        >
                          <Zap className="w-3 h-3 mr-1" />
                          {autoStatus[prop.address] === "done" ? "Done" : "Full Auto"}
                        </Button>
                      </div>

                      {/* Auto-Generated Outreach Sequence */}
                      {hasOutreach && (
                        <div className="space-y-3 pt-3 border-t border-border">
                          <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                            <Zap className="w-3.5 h-3.5 text-accent" />
                            Automated Outreach Sequence
                            <span className="text-[10px] text-muted-foreground font-normal ml-1">
                              (for {prop.likelyAgentName || prop.likelySellerName || "seller"})
                            </span>
                          </p>

                          {/* Email Drip */}
                          <div className="space-y-2">
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Email Sequence</p>
                            {outreachData[prop.address].emails.map((email, i) => (
                              <div key={i} className="p-3 rounded-lg bg-secondary space-y-1.5">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <Mail className="w-3 h-3 text-primary" />
                                    <span className="text-xs font-semibold text-foreground">{email.type}</span>
                                    <Badge variant="outline" className="text-[10px]">
                                      <Clock className="w-2.5 h-2.5 mr-0.5" />{email.sendDelay}
                                    </Badge>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <a
                                      href={getGmailLink("", email.subject, email.body)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      <Button size="sm" variant="ghost" className="h-6 text-xs px-2">
                                        <Send className="w-3 h-3 mr-1" />Send Email
                                      </Button>
                                    </a>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 text-xs px-2"
                                      onClick={() => handleCopy(`email-${idx}-${i}`, `Subject: ${email.subject}\n\n${email.body}`)}
                                    >
                                      {copiedId === `email-${idx}-${i}` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                    </Button>
                                  </div>
                                </div>
                                <p className="text-xs text-primary font-medium">Subject: {email.subject}</p>
                                <p className="text-xs text-foreground whitespace-pre-line leading-relaxed">{email.body}</p>
                              </div>
                            ))}
                          </div>

                          {/* SMS Sequence */}
                          <div className="space-y-2">
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">SMS Sequence</p>
                            {outreachData[prop.address].smsMessages.map((sms, i) => (
                              <div key={i} className="p-3 rounded-lg bg-secondary space-y-1.5">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <MessageSquare className="w-3 h-3 text-success" />
                                    <span className="text-xs font-semibold text-foreground">{sms.type}</span>
                                    <Badge variant="outline" className="text-[10px]">
                                      <Clock className="w-2.5 h-2.5 mr-0.5" />{sms.sendDelay}
                                    </Badge>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <a href={getSMSLink("", sms.message)}>
                                      <Button size="sm" variant="ghost" className="h-6 text-xs px-2">
                                        <MessageSquare className="w-3 h-3 mr-1" />Send SMS
                                      </Button>
                                    </a>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 text-xs px-2"
                                      onClick={() => handleCopy(`sms-${idx}-${i}`, sms.message)}
                                    >
                                      {copiedId === `sms-${idx}-${i}` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                    </Button>
                                  </div>
                                </div>
                                <p className="text-xs text-foreground leading-relaxed">{sms.message}</p>
                              </div>
                            ))}
                          </div>

                          {/* Call Script */}
                          <div className="space-y-2">
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Call Script</p>
                            <div className="p-3 rounded-lg bg-secondary space-y-1.5">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <Phone className="w-3 h-3 text-warning" />
                                  <span className="text-xs font-semibold text-foreground">Cold Call</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <a href="tel:">
                                    <Button size="sm" variant="ghost" className="h-6 text-xs px-2">
                                      <Phone className="w-3 h-3 mr-1" />Call
                                    </Button>
                                  </a>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 text-xs px-2"
                                    onClick={() => handleCopy(`call-${idx}`, outreachData[prop.address].callScript)}
                                  >
                                    {copiedId === `call-${idx}` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                  </Button>
                                </div>
                              </div>
                              <p className="text-xs text-foreground whitespace-pre-line leading-relaxed">{outreachData[prop.address].callScript}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              )
            })}
          </div>
        </>
      )}

      {/* Empty State */}
      {!scoutResult && !isPending && (
        <Card className="flex items-center justify-center min-h-[300px]">
          <CardContent className="text-center py-12">
            <Sparkles className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              AI will discover actual properties in your target market matching wholesale criteria
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Each property comes with deal numbers, search links, and one-click outreach generation
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
