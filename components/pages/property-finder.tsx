"use client"

import { useState, useTransition } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Search,
  Sparkles,
  MapPin,
  Target,
  Loader2,
  Copy,
  Check,
  ExternalLink,
  AlertTriangle,
  ArrowRight,
  Save,
  Trash2,
  Calculator,
  Mountain,
  Home,
  TreePine,
  Shovel,
  CheckCircle2,
  Layers,
} from "lucide-react"
import { US_STATES } from "@/lib/wholesaling-engine"
import { aiFindProperties, aiResearchMarket, aiFindLand } from "@/app/actions/ai-actions"
import type { AppStore, PrefillData, SavedMarket } from "@/lib/store"

type PageId = "dashboard" | "finder" | "scout" | "market" | "deal" | "qualification" | "pipeline" | "outreach" | "partner" | "dispo" | "kpi"

interface PropertyFinderProps {
  store: AppStore
  onNavigate: (page: PageId, data?: PrefillData) => void
}

export function PropertyFinder({ store, onNavigate }: PropertyFinderProps) {
  const [searchMode, setSearchMode] = useState<"houses" | "land">("houses")
  const [city, setCity] = useState("")
  const [state, setState] = useState("")
  const [medianPrice, setMedianPrice] = useState(250000)
  // Land-specific fields
  const [landMaxPrice, setLandMaxPrice] = useState(100000)
  const [landUse, setLandUse] = useState("Any")
  const [minAcres, setMinAcres] = useState(0.25)
  const [maxAcres, setMaxAcres] = useState(10)
  const [isPending, startTransition] = useTransition()
  const [finderResult, setFinderResult] = useState<{
    searchStrategy: string
    zillowFilters: {
      priceMax: number
      priceMin: number
      homeTypes: string[]
      keywords: string[]
      daysOnZillow: string
    }
    targetZipCodes: { zip: string; reason: string }[]
    redFlagIndicators: string[]
    dealIndicators: string[]
    dailyRoutine: string[]
    estimatedDealsPerMonth: number
  } | null>(null)
  const [marketData, setMarketData] = useState<{
    msaPopulation: number
    cityPopulation: number
    medianHomePrice: number
    avgDaysOnMarket: number
    pendingToActiveRatio: number
    isAttorneyState: boolean
    isNonDisclosureState: boolean
    hasWholesaleRestrictions: boolean
    wholesaleNotes: string | null
    marketTrend: string
    topZipCodes: string[]
    recommendedKeywords: string[]
    overallAssessment: string
  } | null>(null)
  const [landResult, setLandResult] = useState<{
    searchStrategy: string
    zillowFilters: {
      priceMax: number
      priceMin: number
      lotSizeMin: number
      lotSizeMax: number
      keywords: string[]
      daysOnZillow: string
    }
    targetZipCodes: { zip: string; reason: string }[]
    landTypes: { type: string; avgPrice: number; bestUse: string; demandLevel: string }[]
    exitStrategies: { strategy: string; description: string; estimatedMargin: string; timeframe: string }[]
    redFlagIndicators: string[]
    dealIndicators: string[]
    dueDiligenceChecklist: string[]
    dailyRoutine: string[]
    estimatedDealsPerMonth: number
    marketInsights: string
  } | null>(null)
  const [error, setError] = useState("")
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const handleSearch = () => {
    if (!city || !state) return
    setError("")
    setSaved(false)
    setLandResult(null)
    setFinderResult(null)
    setMarketData(null)
    startTransition(async () => {
      if (searchMode === "land") {
        const [landRes, marketRes] = await Promise.all([
          aiFindLand(city, state, landMaxPrice, landUse, minAcres, maxAcres),
          aiResearchMarket(city, state),
        ])
        if (landRes.success && landRes.data) {
          setLandResult(landRes.data)
        } else {
          setError(landRes.error || "Failed to generate land search strategy")
        }
        if (marketRes.success && marketRes.data) {
          setMarketData(marketRes.data)
        }
      } else {
        const [finderRes, marketRes] = await Promise.all([
          aiFindProperties(city, state, medianPrice),
          aiResearchMarket(city, state),
        ])
        if (finderRes.success && finderRes.data) {
          setFinderResult(finderRes.data)
        } else {
          setError(finderRes.error || "Failed to generate search strategy")
        }
        if (marketRes.success && marketRes.data) {
          setMarketData(marketRes.data)
        }
      }
    })
  }

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch { /* noop */ }
  }

  const handleSaveMarket = () => {
    if (!city || !state) return
    if (searchMode === "land") {
      // Save land market even without full AI market data
      store.addMarket({
        city,
        state,
        searchType: "land",
        msaPopulation: marketData?.msaPopulation || 0,
        cityPopulation: marketData?.cityPopulation || 0,
        medianPrice: landMaxPrice,
        daysOnMarket: marketData?.avgDaysOnMarket || 0,
        pendingRatio: marketData?.pendingToActiveRatio || 0,
        score: landResult ? 60 : 0,
        verdict: landResult ? (landResult.estimatedDealsPerMonth >= 3 ? "ideal" : landResult.estimatedDealsPerMonth >= 1 ? "borderline" : "disqualified") : "borderline",
        aiSummary: landResult?.marketInsights || "",
        zipCodes: landResult?.targetZipCodes.map((z) => z.zip) || [],
        isAttorneyState: marketData?.isAttorneyState || false,
        isNonDisclosure: marketData?.isNonDisclosureState || false,
        isRestricted: marketData?.hasWholesaleRestrictions || false,
        landMaxPrice,
        landUse,
        minAcres,
        maxAcres,
        landExitStrategies: landResult?.exitStrategies.map((e) => e.strategy) || [],
      })
    } else {
      if (!marketData) return
      const score = calculateScore(marketData)
      store.addMarket({
        city,
        state,
        searchType: "houses",
        msaPopulation: marketData.msaPopulation,
        cityPopulation: marketData.cityPopulation,
        medianPrice: marketData.medianHomePrice,
        daysOnMarket: marketData.avgDaysOnMarket,
        pendingRatio: marketData.pendingToActiveRatio,
        score,
        verdict: score >= 70 ? "ideal" : score >= 40 ? "borderline" : "disqualified",
        aiSummary: marketData.overallAssessment,
        zipCodes: marketData.topZipCodes,
        isAttorneyState: marketData.isAttorneyState,
        isNonDisclosure: marketData.isNonDisclosureState,
        isRestricted: marketData.hasWholesaleRestrictions,
      })
    }
    setSaved(true)
  }

  const handleSendToMarketAnalyzer = () => {
    if (!marketData) return
    onNavigate("market", {
      city,
      state,
      msaPopulation: marketData.msaPopulation,
      cityPopulation: marketData.cityPopulation,
      medianPrice: marketData.medianHomePrice,
      daysOnMarket: marketData.avgDaysOnMarket,
      pendingRatio: marketData.pendingToActiveRatio,
      aiMarketData: marketData as unknown as Record<string, unknown>,
    })
  }

  const handleSendToDealAnalyzer = () => {
    onNavigate("deal", {
      city,
      state,
      marketMedian: marketData?.medianHomePrice || medianPrice,
    })
  }

  const handleReanalyzeSaved = (m: SavedMarket) => {
    setCity(m.city)
    setState(m.state)
    setMedianPrice(m.medianPrice)
  }

  const handleSavedToMarketAnalyzer = (m: SavedMarket) => {
    onNavigate("market", {
      city: m.city,
      state: m.state,
      msaPopulation: m.msaPopulation,
      cityPopulation: m.cityPopulation,
      medianPrice: m.medianPrice,
      daysOnMarket: m.daysOnMarket,
      pendingRatio: m.pendingRatio,
    })
  }

  const handleSavedToDealAnalyzer = (m: SavedMarket) => {
    onNavigate("deal", {
      city: m.city,
      state: m.state,
      marketMedian: m.medianPrice,
    })
  }

  const zillowSearchUrl = city && state
    ? searchMode === "land"
      ? `https://www.zillow.com/${encodeURIComponent(city.toLowerCase().replace(/\s+/g, "-"))}-${state.toLowerCase()}/land/`
      : `https://www.zillow.com/homes/${encodeURIComponent(city)}-${state}_rb/`
    : ""

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground tracking-tight">
            AI Property Finder
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            AI-powered search strategy generator. Find houses or vacant land to buy and sell for profit.
          </p>
        </div>
        <div className="flex rounded-lg bg-secondary border border-border p-0.5 self-start md:self-auto">
          <button
            onClick={() => setSearchMode("houses")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-sm font-medium transition-colors ${
              searchMode === "houses"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Home className="w-3.5 h-3.5" />Houses
          </button>
          <button
            onClick={() => setSearchMode("land")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-sm font-medium transition-colors ${
              searchMode === "land"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Mountain className="w-3.5 h-3.5" />Land
          </button>
        </div>
      </div>

      {/* Saved Markets Summary */}
      {store.savedMarkets.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
              <Save className="w-4 h-4 text-primary" />
              Saved Markets ({store.savedMarkets.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {store.savedMarkets.map((m) => (
                <div key={m.id} className="p-3 rounded-lg bg-secondary border border-border space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      {m.searchType === "land" ? (
                        <Mountain className="w-4 h-4 text-accent shrink-0" />
                      ) : (
                        <Home className="w-4 h-4 text-primary shrink-0" />
                      )}
                      <div>
                        <p className="text-sm font-semibold text-foreground">{m.city}, {m.state}</p>
                        <p className="text-xs text-muted-foreground">
                          {m.searchType === "land" ? (
                            <>Budget: ${m.medianPrice.toLocaleString()} | {m.landUse || "Any"} | {m.minAcres}-{m.maxAcres} ac</>
                          ) : (
                            <>Median: ${m.medianPrice.toLocaleString()} | DOM: {m.daysOnMarket} | Score: {m.score}</>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${
                          m.searchType === "land"
                            ? "border-accent/40 text-accent"
                            : "border-primary/40 text-primary"
                        }`}
                      >
                        {m.searchType === "land" ? "Land" : "Houses"}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${
                          m.verdict === "ideal" ? "text-success border-success/30" :
                          m.verdict === "borderline" ? "text-warning border-warning/30" :
                          "text-destructive border-destructive/30"
                        }`}
                      >
                        {m.verdict}
                      </Badge>
                    </div>
                  </div>
                  {m.searchType === "land" && m.landExitStrategies && m.landExitStrategies.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {m.landExitStrategies.slice(0, 3).map((s, i) => (
                        <Badge key={i} variant="outline" className="text-[10px] border-border text-muted-foreground">{s}</Badge>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => handleReanalyzeSaved(m)}>
                      <Search className="w-3 h-3 mr-1" />Re-research
                    </Button>
                    {m.searchType !== "land" && (
                      <>
                        <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => handleSavedToMarketAnalyzer(m)}>
                          <Target className="w-3 h-3 mr-1" />Analyze
                        </Button>
                        <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => handleSavedToDealAnalyzer(m)}>
                          <Calculator className="w-3 h-3 mr-1" />Find Deals
                        </Button>
                      </>
                    )}
                    {/* Smart Search Links with pre-filled filters */}
                    <a
                      href={m.searchType === "land"
                        ? `https://www.zillow.com/${m.city.toLowerCase().replace(/\s+/g, "-")}-${m.state.toLowerCase()}/land/?searchQueryState=${encodeURIComponent(JSON.stringify({ filterState: { price: { min: 0, max: m.medianPrice }, isLotLand: { value: true } } }))}`
                        : `https://www.zillow.com/${m.city.toLowerCase().replace(/\s+/g, "-")}-${m.state.toLowerCase()}/?searchQueryState=${encodeURIComponent(JSON.stringify({ filterState: { price: { min: Math.round(m.medianPrice * 0.4), max: Math.round(m.medianPrice * 0.85) }, doz: { value: "30" }, sort: { value: "days" } } }))}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 h-6 text-xs px-2 text-primary hover:underline"
                    >
                      <ExternalLink className="w-3 h-3" />Zillow
                    </a>
                    <a
                      href={`https://www.redfin.com/city/${m.city.replace(/\s+/g, "-")}/${m.state}/filter/property-type=${m.searchType === "land" ? "land" : "house"},max-price=${m.searchType === "land" ? m.medianPrice : Math.round(m.medianPrice * 0.85)},min-price=${m.searchType === "land" ? 0 : Math.round(m.medianPrice * 0.4)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 h-6 text-xs px-2 text-destructive hover:underline"
                    >
                      <ExternalLink className="w-3 h-3" />Redfin
                    </a>
                    <a
                      href={`https://www.realtor.com/realestateandhomes-search/${m.city.replace(/\s+/g, "-")}_${m.state}/type-${m.searchType === "land" ? "land" : "single-family-home"}/price-${m.searchType === "land" ? 0 : Math.round(m.medianPrice * 0.4)}-${m.searchType === "land" ? m.medianPrice : Math.round(m.medianPrice * 0.85)}/age-1+`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 h-6 text-xs px-2 text-accent hover:underline"
                    >
                      <ExternalLink className="w-3 h-3" />Realtor
                    </a>
                    <Button size="sm" variant="ghost" className="h-6 text-xs px-2 text-destructive hover:text-destructive" onClick={() => store.removeMarket(m.id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search Input */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
            {searchMode === "land" ? <Mountain className="w-4 h-4 text-primary" /> : <Search className="w-4 h-4 text-primary" />}
            {searchMode === "land" ? "Land Search" : "Market Search"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Row 1: City, State, and mode-specific price */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                  <SelectValue placeholder="Select state" />
                </SelectTrigger>
                <SelectContent>
                  {US_STATES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {searchMode === "houses" ? (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Approx. Median Price ($)</Label>
                <Input
                  type="number"
                  value={medianPrice || ""}
                  onChange={(e) => setMedianPrice(Number(e.target.value))}
                  className="bg-secondary border-border text-foreground"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Max Land Budget ($)</Label>
                <Input
                  type="number"
                  value={landMaxPrice || ""}
                  onChange={(e) => setLandMaxPrice(Number(e.target.value))}
                  className="bg-secondary border-border text-foreground"
                />
              </div>
            )}
            <div className="flex items-end">
              <Button onClick={handleSearch} disabled={isPending || !city || !state} className="w-full">
                {isPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Researching...</>
                ) : (
                  <><Sparkles className="w-4 h-4 mr-2" />{searchMode === "land" ? "Find Land" : "AI Research"}</>
                )}
              </Button>
            </div>
          </div>

          {/* Row 2: Land-specific fields */}
          {searchMode === "land" && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-1 border-t border-border">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Land Use</Label>
                <Select value={landUse} onValueChange={setLandUse}>
                  <SelectTrigger className="bg-secondary border-border text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Any">Any Use</SelectItem>
                    <SelectItem value="Residential">Residential Build</SelectItem>
                    <SelectItem value="Commercial">Commercial</SelectItem>
                    <SelectItem value="Agricultural">Agricultural / Farm</SelectItem>
                    <SelectItem value="Recreational">Recreational</SelectItem>
                    <SelectItem value="Infill">Infill Lot (urban)</SelectItem>
                    <SelectItem value="Subdivision">Subdivision-Ready</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Min Acres</Label>
                <Input
                  type="number"
                  step="0.25"
                  value={minAcres || ""}
                  onChange={(e) => setMinAcres(Number(e.target.value))}
                  className="bg-secondary border-border text-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Max Acres</Label>
                <Input
                  type="number"
                  step="0.25"
                  value={maxAcres || ""}
                  onChange={(e) => setMaxAcres(Number(e.target.value))}
                  className="bg-secondary border-border text-foreground"
                />
              </div>
              <div className="flex items-end">
                <a
                  href={`https://www.landwatch.com/${state.toLowerCase()}-land-for-sale/${city.toLowerCase().replace(/\s+/g, "-")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 w-full h-9 rounded-md text-xs font-medium border border-border text-foreground hover:bg-secondary transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />LandWatch
                </a>
              </div>
            </div>
          )}

          {/* Zillow Link & Error */}
          {zillowSearchUrl && (
            <div className="flex items-center gap-3 flex-wrap">
              <a
                href={zillowSearchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
              >
                <ExternalLink className="w-3 h-3" />
                Open Zillow {searchMode === "land" ? "Land" : "Homes"} for {city}, {state}
              </a>
              {searchMode === "land" && (
                <>
                  <a
                    href={`https://www.landsofamerica.com/${state.toLowerCase()}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                  >
                    <ExternalLink className="w-3 h-3" />Lands of America
                  </a>
                  <a
                    href={`https://www.landflip.com/search?state=${state}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                  >
                    <ExternalLink className="w-3 h-3" />LandFlip
                  </a>
                </>
              )}
            </div>
          )}
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-xs text-destructive">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Bar when results exist */}
      {marketData && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
          <p className="text-xs text-foreground flex-1">
            <span className="font-semibold">{city}, {state}</span> research complete.
          </p>
          <Button size="sm" variant="outline" className="text-xs" onClick={handleSaveMarket} disabled={saved}>
            <Save className="w-3 h-3 mr-1.5" />
            {saved ? "Saved" : "Save Market"}
          </Button>
          <Button size="sm" variant="outline" className="text-xs" onClick={handleSendToMarketAnalyzer}>
            <Target className="w-3 h-3 mr-1.5" />
            Full Analysis
            <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
          <Button size="sm" className="text-xs" onClick={handleSendToDealAnalyzer}>
            <Calculator className="w-3 h-3 mr-1.5" />
            Find Deals
            <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        </div>
      )}

      {/* Land Results */}
      {landResult && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Market + Land Types + Exit Strategies */}
          <div className="space-y-4">
            {/* Market Intelligence - reused */}
            {marketData && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
                    <Target className="w-4 h-4 text-primary" />
                    AI Market Intelligence
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 rounded bg-secondary">
                      <span className="text-muted-foreground">MSA Population</span>
                      <p className="font-mono font-bold text-foreground">{marketData.msaPopulation.toLocaleString()}</p>
                    </div>
                    <div className="p-2 rounded bg-secondary">
                      <span className="text-muted-foreground">Median Home Price</span>
                      <p className="font-mono font-bold text-foreground">${marketData.medianHomePrice.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                    <p className="text-xs text-foreground leading-relaxed">{landResult.marketInsights}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Land Types Found */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
                  <Layers className="w-4 h-4 text-primary" />
                  Land Types in Market
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {landResult.landTypes.map((lt, i) => (
                  <div key={i} className="p-3 rounded-lg bg-secondary border border-border space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-foreground">{lt.type}</span>
                      <Badge
                        variant="outline"
                        className={`text-xs ${
                          lt.demandLevel === "HIGH" ? "text-success border-success/30" :
                          lt.demandLevel === "MEDIUM" ? "text-warning border-warning/30" :
                          "text-muted-foreground border-border"
                        }`}
                      >
                        {lt.demandLevel} Demand
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">Avg: ${lt.avgPrice.toLocaleString()}</p>
                    <p className="text-xs text-foreground">{lt.bestUse}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Exit Strategies */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
                  <TreePine className="w-4 h-4 text-accent" />
                  Exit Strategies
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {landResult.exitStrategies.map((es, i) => (
                  <div key={i} className="p-3 rounded-lg bg-secondary border border-border space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-foreground">{es.strategy}</span>
                      <span className="text-xs font-mono text-success">{es.estimatedMargin}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{es.description}</p>
                    <p className="text-xs text-muted-foreground">Timeline: {es.timeframe}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Deal vs Red Flag Indicators */}
            <div className="grid grid-cols-2 gap-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold text-success">Deal Signs</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1">
                    {landResult.dealIndicators.map((ind, i) => (
                      <li key={i} className="text-xs text-foreground flex items-start gap-1.5">
                        <span className="text-success shrink-0">+</span>{ind}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold text-destructive">Red Flags</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1">
                    {landResult.redFlagIndicators.map((ind, i) => (
                      <li key={i} className="text-xs text-foreground flex items-start gap-1.5">
                        <span className="text-destructive shrink-0">-</span>{ind}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Right: Strategy + Zips + Due Diligence + Routine */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
                  <Sparkles className="w-4 h-4 text-accent" />
                  AI Land Search Strategy
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-foreground leading-relaxed">{landResult.searchStrategy}</p>
                <div className="p-3 rounded-lg bg-secondary space-y-2">
                  <p className="text-xs font-semibold text-foreground">Zillow Land Filters</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Price Range:</span>
                      <p className="font-mono font-bold text-foreground">${landResult.zillowFilters.priceMin.toLocaleString()} - ${landResult.zillowFilters.priceMax.toLocaleString()}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Lot Size:</span>
                      <p className="font-mono font-bold text-foreground">{landResult.zillowFilters.lotSizeMin} - {landResult.zillowFilters.lotSizeMax} acres</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">DOM Filter:</span>
                      <p className="font-mono font-bold text-foreground">{landResult.zillowFilters.daysOnZillow}</p>
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Keywords:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {landResult.zillowFilters.keywords.map((kw, i) => (
                        <Badge key={i} variant="outline" className="text-xs border-accent/30 text-accent">{kw}</Badge>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg border border-accent/30 bg-accent/5">
                  <div>
                    <p className="text-xs text-muted-foreground">Est. Land Deals/Month</p>
                    <p className="text-2xl font-bold font-mono text-accent">{landResult.estimatedDealsPerMonth}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Target Zip Codes */}
            {landResult.targetZipCodes.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold text-foreground">Target Zip Codes for Land</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {landResult.targetZipCodes.map((zc, i) => (
                    <div key={i} className="flex items-start gap-2 p-2 rounded bg-secondary">
                      <a
                        href={`https://www.zillow.com/${zc.zip}/land/`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-xs text-primary hover:underline shrink-0"
                      >
                        {zc.zip}
                      </a>
                      <span className="text-xs text-muted-foreground">{zc.reason}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Due Diligence Checklist */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold flex items-center gap-2 text-foreground">
                  <Shovel className="w-3.5 h-3.5 text-warning" />
                  Land Due Diligence Checklist
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5">
                  {landResult.dueDiligenceChecklist.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-foreground">
                      <CheckCircle2 className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Daily Routine */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold text-foreground">Daily Land Hunting Routine</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="space-y-2">
                  {landResult.dailyRoutine.map((step, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs">
                      <span className="text-primary font-bold shrink-0">{i + 1}.</span>
                      <span className="text-foreground">{step}</span>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Land Results Action Bar */}
      {landResult && (
        <Card className="border-accent/30 bg-accent/5">
          <CardContent className="p-4 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Mountain className="w-4 h-4 text-accent" />
              <p className="text-xs text-foreground">
                <span className="font-semibold">{city}, {state}</span> land research complete -- {landResult.estimatedDealsPerMonth} estimated deals/mo.
              </p>
            </div>
            <Button size="sm" variant="outline" className="text-xs" onClick={handleSaveMarket} disabled={saved}>
              <Save className="w-3 h-3 mr-1.5" />
              {saved ? "Saved" : "Save Land Market"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* House Results */}
      {(finderResult || (marketData && !landResult)) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Market Intelligence */}
          {marketData && (
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
                    <Target className="w-4 h-4 text-primary" />
                    AI Market Intelligence
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 rounded bg-secondary">
                      <span className="text-muted-foreground">MSA Population</span>
                      <p className="font-mono font-bold text-foreground">
                        {marketData.msaPopulation.toLocaleString()}
                      </p>
                    </div>
                    <div className="p-2 rounded bg-secondary">
                      <span className="text-muted-foreground">City Population</span>
                      <p className="font-mono font-bold text-foreground">
                        {marketData.cityPopulation.toLocaleString()}
                      </p>
                    </div>
                    <div className="p-2 rounded bg-secondary">
                      <span className="text-muted-foreground">Median Price</span>
                      <p className="font-mono font-bold text-foreground">
                        ${marketData.medianHomePrice.toLocaleString()}
                      </p>
                    </div>
                    <div className="p-2 rounded bg-secondary">
                      <span className="text-muted-foreground">Avg DOM</span>
                      <p className="font-mono font-bold text-foreground">
                        {marketData.avgDaysOnMarket} days
                      </p>
                    </div>
                    <div className="p-2 rounded bg-secondary">
                      <span className="text-muted-foreground">Pending Ratio</span>
                      <p className="font-mono font-bold text-foreground">
                        {marketData.pendingToActiveRatio}%
                      </p>
                    </div>
                    <div className="p-2 rounded bg-secondary">
                      <span className="text-muted-foreground">Market Trend</span>
                      <p className="font-medium text-foreground capitalize">
                        {marketData.marketTrend}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5 pt-2">
                    {marketData.isAttorneyState && (
                      <Badge variant="outline" className="text-xs text-warning border-warning/30">Attorney State</Badge>
                    )}
                    {marketData.isNonDisclosureState && (
                      <Badge variant="outline" className="text-xs text-warning border-warning/30">Non-Disclosure</Badge>
                    )}
                    {marketData.hasWholesaleRestrictions ? (
                      <Badge variant="outline" className="text-xs text-destructive border-destructive/30">Wholesale Restrictions</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-success border-success/30">Wholesale Friendly</Badge>
                    )}
                  </div>

                  {marketData.wholesaleNotes && (
                    <p className="text-xs text-muted-foreground p-2 rounded bg-secondary">
                      {marketData.wholesaleNotes}
                    </p>
                  )}

                  <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                    <p className="text-xs text-foreground leading-relaxed">
                      {marketData.overallAssessment}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Recommended Keywords */}
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xs font-semibold text-foreground">
                      Recommended Zillow Keywords
                    </CardTitle>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      onClick={() => handleCopy("keywords", marketData.recommendedKeywords.join(", "))}
                    >
                      {copiedId === "keywords" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-1.5">
                    {marketData.recommendedKeywords.map((kw, i) => (
                      <Badge key={i} variant="outline" className="text-xs border-primary/30 text-primary">
                        {kw}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Top Zip Codes */}
              {marketData.topZipCodes.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-semibold text-foreground">Top Zip Codes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {marketData.topZipCodes.map((zip, i) => (
                        <a
                          key={i}
                          href={`https://www.zillow.com/homes/${zip}_rb/`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-1 rounded bg-secondary text-xs text-foreground hover:bg-primary/10 transition-colors"
                        >
                          <MapPin className="w-3 h-3 text-primary" />
                          {zip}
                          <ExternalLink className="w-2.5 h-2.5 text-muted-foreground" />
                        </a>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Search Strategy */}
          {finderResult && (
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
                    <Sparkles className="w-4 h-4 text-accent" />
                    AI Search Strategy
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs text-foreground leading-relaxed">
                    {finderResult.searchStrategy}
                  </p>

                  <div className="p-3 rounded-lg bg-secondary space-y-2">
                    <p className="text-xs font-semibold text-foreground">Zillow Filters</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">Price Range:</span>
                        <p className="font-mono font-bold text-foreground">
                          ${finderResult.zillowFilters.priceMin.toLocaleString()} - ${finderResult.zillowFilters.priceMax.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">DOM Filter:</span>
                        <p className="font-mono font-bold text-foreground">
                          {finderResult.zillowFilters.daysOnZillow}
                        </p>
                      </div>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Keywords:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {finderResult.zillowFilters.keywords.map((kw, i) => (
                          <Badge key={i} variant="outline" className="text-xs border-accent/30 text-accent">
                            {kw}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg border border-accent/30 bg-accent/5">
                    <div>
                      <p className="text-xs text-muted-foreground">Est. Deals/Month</p>
                      <p className="text-2xl font-bold font-mono text-accent">
                        {finderResult.estimatedDealsPerMonth}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Target Zip Codes */}
              {finderResult.targetZipCodes.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-semibold text-foreground">Target Zip Codes</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {finderResult.targetZipCodes.map((zc, i) => (
                      <div key={i} className="flex items-start gap-2 p-2 rounded bg-secondary">
                        <a
                          href={`https://www.zillow.com/homes/${zc.zip}_rb/`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-xs text-primary hover:underline shrink-0"
                        >
                          {zc.zip}
                        </a>
                        <span className="text-xs text-muted-foreground">{zc.reason}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Daily Routine */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold text-foreground">Daily Zillow Hunting Routine</CardTitle>
                </CardHeader>
                <CardContent>
                  <ol className="space-y-2">
                    {finderResult.dailyRoutine.map((step, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs">
                        <span className="text-primary font-bold shrink-0">{i + 1}.</span>
                        <span className="text-foreground">{step}</span>
                      </li>
                    ))}
                  </ol>
                </CardContent>
              </Card>

              {/* Deal vs Red Flag Indicators */}
              <div className="grid grid-cols-2 gap-3">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-semibold text-success">Deal Signs</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-1">
                      {finderResult.dealIndicators.map((ind, i) => (
                        <li key={i} className="text-xs text-foreground flex items-start gap-1.5">
                          <span className="text-success shrink-0">+</span>
                          {ind}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-semibold text-destructive">Red Flags</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-1">
                      {finderResult.redFlagIndicators.map((ind, i) => (
                        <li key={i} className="text-xs text-foreground flex items-start gap-1.5">
                          <span className="text-destructive shrink-0">-</span>
                          {ind}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!finderResult && !marketData && !landResult && !isPending && store.savedMarkets.length === 0 && (
        <Card className="flex items-center justify-center min-h-[300px]">
          <CardContent className="text-center py-12">
            {searchMode === "land" ? (
              <>
                <Mountain className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  Enter a market to find vacant land, lots, and acreage deals
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  AI generates search filters, exit strategies, due diligence checklists, and target zip codes
                </p>
              </>
            ) : (
              <>
                <Search className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  Enter a market to get AI-powered search strategies and Zillow filters
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Saved markets persist and auto-fill downstream analysis steps
                </p>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// Simple scoring function
function calculateScore(data: {
  msaPopulation: number
  cityPopulation: number
  medianHomePrice: number
  avgDaysOnMarket: number
  pendingToActiveRatio: number
  hasWholesaleRestrictions: boolean
}): number {
  let score = 0
  if (data.msaPopulation >= 400000) score += 20; else if (data.msaPopulation >= 200000) score += 10
  if (data.cityPopulation >= 100000) score += 20; else if (data.cityPopulation >= 50000) score += 10
  if (data.medianHomePrice >= 200000 && data.medianHomePrice <= 400000) score += 20
  else if (data.medianHomePrice >= 150000 && data.medianHomePrice <= 500000) score += 10
  if (data.avgDaysOnMarket < 50) score += 20; else if (data.avgDaysOnMarket < 70) score += 10
  if (data.pendingToActiveRatio >= 25) score += 20; else if (data.pendingToActiveRatio >= 15) score += 10
  if (data.hasWholesaleRestrictions) score = Math.max(0, score - 30)
  return score
}
