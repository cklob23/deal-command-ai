"use client"

import { useState, useEffect, useTransition, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
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
  MapPin,
  Sparkles,
  Loader2,
  ExternalLink,
  Save,
  ArrowRight,
  Calculator,
} from "lucide-react"
import {
  evaluateMarket,
  US_STATES,
  ATTORNEY_STATES,
  NON_DISCLOSURE_STATES,
  RESTRICTED_STATES,
  LICENSE_REQUIRED_STATES,
  type MarketData,
  type MarketScore,
} from "@/lib/wholesaling-engine"
import { aiResearchMarket } from "@/app/actions/ai-actions"
import type { AppStore, PrefillData } from "@/lib/store"

type PageId = "dashboard" | "finder" | "scout" | "market" | "deal" | "qualification" | "pipeline" | "outreach" | "partner" | "dispo" | "kpi"

interface MarketAnalyzerProps {
  store: AppStore
  onNavigate: (page: PageId, data?: PrefillData) => void
  prefillData?: PrefillData
}

export function MarketAnalyzer({ store, onNavigate, prefillData }: MarketAnalyzerProps) {
  const [formData, setFormData] = useState<MarketData>({
    city: "",
    state: "",
    msa: 0,
    cityPop: 0,
    medianPrice: 0,
    dom: 0,
    pendingRatio: 0,
  })
  const [result, setResult] = useState<MarketScore | null>(null)
  const [isPending, startTransition] = useTransition()
  const [aiInsight, setAiInsight] = useState<string>("")
  const [marketDataSources, setMarketDataSources] = useState<string[]>([])
  const [saved, setSaved] = useState(false)
  const didPrefill = useRef(false)

  // Auto-fill from prefillData (when navigated from Property Finder or saved market)
  useEffect(() => {
    if (!prefillData || didPrefill.current) return
    if (prefillData.city || prefillData.state) {
      const newForm: MarketData = {
        city: prefillData.city || "",
        state: prefillData.state || "",
        msa: prefillData.msaPopulation || 0,
        cityPop: prefillData.cityPopulation || 0,
        medianPrice: prefillData.medianPrice || 0,
        dom: prefillData.daysOnMarket || 0,
        pendingRatio: prefillData.pendingRatio || 0,
      }
      setFormData(newForm)
      didPrefill.current = true

      // If we have full data, auto-evaluate
      if (newForm.msa && newForm.cityPop && newForm.medianPrice && newForm.dom && newForm.pendingRatio) {
        const score = evaluateMarket(newForm)
        setResult(score)

        // If we got AI market data, set insight
        if (prefillData.aiMarketData) {
          const md = prefillData.aiMarketData as Record<string, string>
          setAiInsight(md.overallAssessment || "")
        }
      }
    }
  }, [prefillData])

  const handleAIResearch = () => {
    if (!formData.city || !formData.state) return
    setSaved(false)
    startTransition(async () => {
      const res = await aiResearchMarket(formData.city, formData.state)
      if (res.success && res.data) {
        const newForm = {
          ...formData,
          msa: res.data.msaPopulation,
          cityPop: res.data.cityPopulation,
          medianPrice: res.data.medianHomePrice,
          dom: res.data.avgDaysOnMarket,
          pendingRatio: res.data.pendingToActiveRatio,
        }
        setFormData(newForm)
        setAiInsight(res.data.overallAssessment)
        setMarketDataSources((res as { dataSources?: string[] }).dataSources ?? [])
        const score = evaluateMarket(newForm)
        setResult(score)
      }
    })
  }

  const handleEvaluate = () => {
    if (!formData.city || !formData.state) return
    setSaved(false)
    const score = evaluateMarket(formData)
    setResult(score)
  }

  const handleSaveMarket = () => {
    if (!result) return
    store.addMarket({
      city: formData.city,
      state: formData.state,
      msaPopulation: formData.msa,
      cityPopulation: formData.cityPop,
      medianPrice: formData.medianPrice,
      daysOnMarket: formData.dom,
      pendingRatio: formData.pendingRatio,
      score: result.score,
      verdict: result.status,
      aiSummary: aiInsight,
      zipCodes: [],
      isAttorneyState: ATTORNEY_STATES.includes(formData.state),
      isNonDisclosure: NON_DISCLOSURE_STATES.includes(formData.state),
      isRestricted: !!RESTRICTED_STATES[formData.state],
    })
    setSaved(true)
  }

  const handleSendToDealAnalyzer = () => {
    onNavigate("deal", {
      city: formData.city,
      state: formData.state,
      marketMedian: formData.medianPrice,
    })
  }

  const handleReset = () => {
    setFormData({ city: "", state: "", msa: 0, cityPop: 0, medianPrice: 0, dom: 0, pendingRatio: 0 })
    setResult(null)
    setAiInsight("")
    setSaved(false)
    didPrefill.current = false
  }

  const statusConfig = {
    ideal: { color: "bg-success text-success-foreground", label: "Ideal Market" },
    borderline: { color: "bg-warning text-warning-foreground", label: "Borderline" },
    disqualified: { color: "bg-destructive text-destructive-foreground", label: "Disqualified" },
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-foreground tracking-tight">
          Market Analyzer
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Evaluate markets against ideal wholesaling criteria. Use AI to auto-fill or get data from Property Finder.
        </p>
      </div>

      {/* Saved Markets Quick Selector */}
      {store.savedMarkets.length > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary border border-border overflow-x-auto">
          <span className="text-xs text-muted-foreground shrink-0">Saved:</span>
          {store.savedMarkets.slice(0, 8).map((m) => (
            <button
              key={m.id}
              onClick={() => {
                setFormData({
                  city: m.city, state: m.state, msa: m.msaPopulation,
                  cityPop: m.cityPopulation, medianPrice: m.medianPrice,
                  dom: m.daysOnMarket, pendingRatio: m.pendingRatio,
                })
                setAiInsight(m.aiSummary)
                const score = evaluateMarket({
                  city: m.city, state: m.state, msa: m.msaPopulation,
                  cityPop: m.cityPopulation, medianPrice: m.medianPrice,
                  dom: m.daysOnMarket, pendingRatio: m.pendingRatio,
                })
                setResult(score)
                setSaved(true)
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs bg-card border border-border hover:border-primary/50 text-foreground transition-colors shrink-0"
            >
              <MapPin className="w-3 h-3 text-primary" />
              {m.city}, {m.state}
              <Badge variant="outline" className={`text-[10px] px-1 py-0 ${
                m.verdict === "ideal" ? "text-success border-success/30" :
                m.verdict === "borderline" ? "text-warning border-warning/30" :
                "text-destructive border-destructive/30"
              }`}>
                {m.score}
              </Badge>
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
              <MapPin className="w-4 h-4 text-primary" />
              Market Data Input
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">City</Label>
                <Input placeholder="e.g., Jacksonville" value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} className="bg-secondary border-border text-foreground" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">State</Label>
                <Select value={formData.state} onValueChange={(val) => setFormData({ ...formData, state: val })}>
                  <SelectTrigger className="bg-secondary border-border text-foreground"><SelectValue placeholder="Select state" /></SelectTrigger>
                  <SelectContent>
                    {US_STATES.map((s) => (
                      <SelectItem key={s} value={s}>{s} {RESTRICTED_STATES[s] ? "(Restricted)" : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button onClick={handleAIResearch} disabled={isPending || !formData.city || !formData.state} variant="outline" className="w-full">
              {isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />AI Researching...</>
              ) : (
                <><Sparkles className="w-4 h-4 mr-2" />AI Auto-Fill Market Data</>
              )}
            </Button>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">MSA Population</Label>
                <Input type="number" placeholder="e.g., 500000" value={formData.msa || ""} onChange={(e) => setFormData({ ...formData, msa: Number(e.target.value) })} className="bg-secondary border-border text-foreground" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">City Population</Label>
                <Input type="number" placeholder="e.g., 150000" value={formData.cityPop || ""} onChange={(e) => setFormData({ ...formData, cityPop: Number(e.target.value) })} className="bg-secondary border-border text-foreground" />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Median Home Price ($)</Label>
              <Input type="number" placeholder="e.g., 250000" value={formData.medianPrice || ""} onChange={(e) => setFormData({ ...formData, medianPrice: Number(e.target.value) })} className="bg-secondary border-border text-foreground" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Avg Days on Market</Label>
                <Input type="number" placeholder="e.g., 35" value={formData.dom || ""} onChange={(e) => setFormData({ ...formData, dom: Number(e.target.value) })} className="bg-secondary border-border text-foreground" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">{"Pending/Active Ratio (%)"}</Label>
                <Input type="number" placeholder="e.g., 30" value={formData.pendingRatio || ""} onChange={(e) => setFormData({ ...formData, pendingRatio: Number(e.target.value) })} className="bg-secondary border-border text-foreground" />
              </div>
            </div>

            {/* State Warnings */}
            {formData.state && (
              <div className="space-y-2">
                {RESTRICTED_STATES[formData.state] && (
                  <div className="flex items-start gap-2 p-2 rounded-lg bg-destructive/10 text-xs">
                    <XCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                    <span className="text-destructive">{RESTRICTED_STATES[formData.state]}</span>
                  </div>
                )}
                {LICENSE_REQUIRED_STATES[formData.state] && (
                  <div className="flex items-start gap-2 p-2 rounded-lg bg-warning/10 text-xs">
                    <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                    <span className="text-warning">{LICENSE_REQUIRED_STATES[formData.state]}</span>
                  </div>
                )}
                {ATTORNEY_STATES.includes(formData.state) && (
                  <div className="flex items-start gap-2 p-2 rounded-lg bg-warning/10 text-xs">
                    <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                    <span className="text-warning">Attorney state - expect additional legal costs</span>
                  </div>
                )}
                {NON_DISCLOSURE_STATES.includes(formData.state) && (
                  <div className="flex items-start gap-2 p-2 rounded-lg bg-warning/10 text-xs">
                    <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                    <span className="text-warning">Non-disclosure state - limited comp data</span>
                  </div>
                )}
              </div>
            )}

            {/* Quick Links */}
            {formData.city && formData.state && (
              <div className="flex flex-wrap gap-2 text-xs">
                <a href={`https://www.zillow.com/homes/${encodeURIComponent(formData.city)}-${formData.state}_rb/`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                  <ExternalLink className="w-3 h-3" />Zillow
                </a>
                <a href={`https://www.redfin.com/city/${formData.city.replace(/\s/g, "-")}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                  <ExternalLink className="w-3 h-3" />Redfin
                </a>
                <a href={`https://www.google.com/search?q=MSA+population+${encodeURIComponent(formData.city)}+${formData.state}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                  <ExternalLink className="w-3 h-3" />Google MSA
                </a>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button onClick={handleEvaluate} className="flex-1">Evaluate Market</Button>
              <Button onClick={handleReset} variant="outline">Reset</Button>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        <div className="space-y-4">
          {result ? (
            <>
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold text-foreground">Market Score</CardTitle>
                    <Badge className={statusConfig[result.status].color}>{statusConfig[result.status].label}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-3xl font-bold font-mono text-foreground">{result.score}</span>
                      <span className="text-sm text-muted-foreground">/100</span>
                    </div>
                    <Progress value={result.score} className="h-2" />
                  </div>
                </CardContent>
              </Card>

              {/* Flow Buttons */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                <Button size="sm" variant="outline" className="text-xs" onClick={handleSaveMarket} disabled={saved}>
                  <Save className="w-3 h-3 mr-1.5" />{saved ? "Saved" : "Save Market"}
                </Button>
                <Button size="sm" className="text-xs" onClick={handleSendToDealAnalyzer}>
                  <Calculator className="w-3 h-3 mr-1.5" />Find Deals Here
                  <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              </div>

              {aiInsight && (
                <Card className="border-primary/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-semibold text-primary flex items-center gap-2">
                      <Sparkles className="w-4 h-4" />AI Assessment
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-foreground leading-relaxed">{aiInsight}</p>
                    {marketDataSources.length > 0 && (
                      <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] text-muted-foreground">Data:</span>
                        {marketDataSources.map((src, i) => (
                          <span key={i} className="inline-flex items-center rounded-full bg-success/10 px-1.5 py-0.5 text-[10px] font-medium text-success ring-1 ring-success/20">{src}</span>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {result.passed.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-semibold text-success flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" />Passed ({result.passed.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-1.5">
                      {result.passed.map((p, i) => (
                        <li key={i} className="flex items-center gap-2 text-xs text-foreground">
                          <CheckCircle2 className="w-3 h-3 text-success shrink-0" />{p}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {result.flags.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-semibold text-destructive flex items-center gap-2">
                      <XCircle className="w-4 h-4" />Flags ({result.flags.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-1.5">
                      {result.flags.map((f, i) => (
                        <li key={i} className="flex items-center gap-2 text-xs text-foreground">
                          <XCircle className="w-3 h-3 text-destructive shrink-0" />{f}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card className="h-full flex items-center justify-center min-h-[300px]">
              <CardContent className="text-center py-12">
                <MapPin className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Enter market data or use AI to auto-fill</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {"Criteria: MSA > 400k, Pop > 100k, Median $200k-$400k, DOM < 50, Pending > 25%"}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
