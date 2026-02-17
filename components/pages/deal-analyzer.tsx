"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Checkbox } from "@/components/ui/checkbox"
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Calculator,
  TrendingUp,
  DollarSign,
  Save,
  ArrowRight,
  UserCheck,
  Trash2,
} from "lucide-react"
import {
  analyzeDeal,
  MOTIVATED_KEYWORDS,
  type DealInput,
  type DealAnalysis,
} from "@/lib/wholesaling-engine"
import type { AppStore, PrefillData } from "@/lib/store"

type PageId = "dashboard" | "finder" | "scout" | "market" | "deal" | "qualification" | "pipeline" | "outreach" | "partner" | "dispo" | "kpi"

interface DealAnalyzerProps {
  store: AppStore
  onNavigate: (page: PageId, data?: PrefillData) => void
  prefillData?: PrefillData
}

export function DealAnalyzer({ store, onNavigate, prefillData }: DealAnalyzerProps) {
  const [formData, setFormData] = useState<DealInput>({
    address: "",
    listPrice: 0,
    zestimate: 0,
    repairEstimate: 0,
    arv: 0,
    keywords: [],
    dom: 0,
    sellerMotivation: 5,
  })
  const [result, setResult] = useState<DealAnalysis | null>(null)
  const [saved, setSaved] = useState(false)
  const [city, setCity] = useState("")
  const [state, setState] = useState("")
  const didPrefill = useRef(false)

  // Auto-fill from prefillData
  useEffect(() => {
    if (!prefillData || didPrefill.current) return
    if (prefillData.address || prefillData.listPrice || prefillData.city) {
      setFormData((prev) => ({
        ...prev,
        address: prefillData.address || prev.address,
        listPrice: prefillData.listPrice || prev.listPrice,
        zestimate: prefillData.zestimate || prev.zestimate,
        repairEstimate: prefillData.repairEstimate || prev.repairEstimate,
        arv: prefillData.arv || prev.arv,
        sellerMotivation: prefillData.motivationScore || prev.sellerMotivation,
      }))
      setCity(prefillData.city || "")
      setState(prefillData.state || "")
      didPrefill.current = true
    }
  }, [prefillData])

  const handleAnalyze = () => {
    if (!formData.listPrice) return
    setSaved(false)
    const analysis = analyzeDeal(formData)
    setResult(analysis)
  }

  const handleSaveDeal = () => {
    if (!result) return
    store.addDeal({
      address: formData.address,
      city,
      state,
      listPrice: formData.listPrice,
      zestimate: formData.zestimate,
      askingPrice: formData.listPrice,
      arv: formData.arv,
      repairEstimate: formData.repairEstimate,
      mao: result.mao,
      qualifierPrice: result.qualifierPrice80,
      spread: result.spreadPotential,
      motivationScore: result.motivationScore,
      motivatedKeywords: formData.keywords,
      aiVerdict: "",
    })
    setSaved(true)
  }

  const handleSendToQualification = () => {
    onNavigate("qualification", {
      address: formData.address,
      city,
      state,
      listPrice: formData.listPrice,
      zestimate: formData.zestimate,
      askingPrice: formData.listPrice,
      arv: formData.arv,
      repairEstimate: formData.repairEstimate,
      mao: result?.mao,
      spread: result?.spreadPotential,
      motivationScore: result?.motivationScore || formData.sellerMotivation,
    })
  }

  const handleLoadSavedDeal = (d: typeof store.savedDeals[0]) => {
    setFormData({
      address: d.address,
      listPrice: d.listPrice,
      zestimate: d.zestimate,
      repairEstimate: d.repairEstimate,
      arv: d.arv,
      keywords: d.motivatedKeywords,
      dom: 0,
      sellerMotivation: d.motivationScore,
    })
    setCity(d.city)
    setState(d.state)
    const analysis = analyzeDeal({
      address: d.address,
      listPrice: d.listPrice,
      zestimate: d.zestimate,
      repairEstimate: d.repairEstimate,
      arv: d.arv,
      keywords: d.motivatedKeywords,
      dom: 0,
      sellerMotivation: d.motivationScore,
    })
    setResult(analysis)
    setSaved(true)
  }

  const handleReset = () => {
    setFormData({ address: "", listPrice: 0, zestimate: 0, repairEstimate: 0, arv: 0, keywords: [], dom: 0, sellerMotivation: 5 })
    setResult(null)
    setSaved(false)
    setCity("")
    setState("")
    didPrefill.current = false
  }

  const toggleKeyword = (keyword: string) => {
    setFormData((prev) => ({
      ...prev,
      keywords: prev.keywords.includes(keyword)
        ? prev.keywords.filter((k) => k !== keyword)
        : [...prev.keywords, keyword],
    }))
  }

  const motivationColor = (score: number) => {
    if (score >= 7) return "text-success"
    if (score >= 4) return "text-warning"
    return "text-destructive"
  }

  const motivationLabel = (score: number) => {
    if (score >= 7) return "Hot"
    if (score >= 4) return "Warm"
    return "Cold"
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-foreground tracking-tight">Deal Analyzer</h1>
        <p className="text-sm text-muted-foreground mt-1">Calculate MAO, 80% qualifier, and spread potential. Save deals and send to qualification.</p>
      </div>

      {/* Saved Deals Quick Selector */}
      {store.savedDeals.length > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary border border-border overflow-x-auto">
          <span className="text-xs text-muted-foreground shrink-0">Saved Deals:</span>
          {store.savedDeals.slice(0, 6).map((d) => (
            <button
              key={d.id}
              onClick={() => handleLoadSavedDeal(d)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs bg-card border border-border hover:border-primary/50 text-foreground transition-colors shrink-0"
            >
              <DollarSign className="w-3 h-3 text-primary" />
              <span className="max-w-[120px] truncate">{d.address || `${d.city}, ${d.state}`}</span>
              <Badge variant="outline" className={`text-[10px] px-1 py-0 ${d.spread > 10000 ? "text-success border-success/30" : d.spread > 0 ? "text-warning border-warning/30" : "text-destructive border-destructive/30"}`}>
                ${d.spread.toLocaleString()}
              </Badge>
              <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); store.removeDeal(d.id) }} onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); store.removeDeal(d.id) } }} className="text-muted-foreground hover:text-destructive ml-1 cursor-pointer">
                <Trash2 className="w-3 h-3" />
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Form */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
                <Calculator className="w-4 h-4 text-primary" />
                Property Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Property Address</Label>
                <Input placeholder="e.g., 123 Main St, Jacksonville, FL" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} className="bg-secondary border-border text-foreground" />
              </div>

              {(prefillData?.city || city) && (
                <div className="flex gap-4">
                  <div className="space-y-2 flex-1">
                    <Label className="text-xs text-muted-foreground">City</Label>
                    <Input value={city} onChange={(e) => setCity(e.target.value)} className="bg-secondary border-border text-foreground" />
                  </div>
                  <div className="space-y-2 w-24">
                    <Label className="text-xs text-muted-foreground">State</Label>
                    <Input value={state} onChange={(e) => setState(e.target.value)} className="bg-secondary border-border text-foreground" />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">List Price ($)</Label>
                  <Input type="number" placeholder="e.g., 120000" value={formData.listPrice || ""} onChange={(e) => setFormData({ ...formData, listPrice: Number(e.target.value) })} className="bg-secondary border-border text-foreground" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Zestimate ($)</Label>
                  <Input type="number" placeholder="e.g., 140000" value={formData.zestimate || ""} onChange={(e) => setFormData({ ...formData, zestimate: Number(e.target.value) })} className="bg-secondary border-border text-foreground" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Repair Estimate ($)</Label>
                  <Input type="number" placeholder="e.g., 25000" value={formData.repairEstimate || ""} onChange={(e) => setFormData({ ...formData, repairEstimate: Number(e.target.value) })} className="bg-secondary border-border text-foreground" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">After Repair Value ($)</Label>
                  <Input type="number" placeholder="e.g., 180000" value={formData.arv || ""} onChange={(e) => setFormData({ ...formData, arv: Number(e.target.value) })} className="bg-secondary border-border text-foreground" />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Days on Market</Label>
                <Input type="number" placeholder="e.g., 25" value={formData.dom || ""} onChange={(e) => setFormData({ ...formData, dom: Number(e.target.value) })} className="bg-secondary border-border text-foreground" />
              </div>
            </CardContent>
          </Card>

          {/* Motivation Meter */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-foreground">Seller Motivation Score</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className={`text-3xl font-bold font-mono ${motivationColor(formData.sellerMotivation)}`}>{formData.sellerMotivation}</span>
                <Badge variant="outline" className={`${motivationColor(formData.sellerMotivation)} border-current`}>{motivationLabel(formData.sellerMotivation)}</Badge>
              </div>
              <Slider value={[formData.sellerMotivation]} onValueChange={([val]) => setFormData({ ...formData, sellerMotivation: val })} min={1} max={10} step={1} className="py-2" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Cold (1-3)</span><span>Warm (4-6)</span><span>Hot (7-10)</span>
              </div>
            </CardContent>
          </Card>

          {/* Keywords */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-foreground">Motivated Seller Keywords</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {MOTIVATED_KEYWORDS.slice(0, 12).map((kw) => (
                  <label key={kw} className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <Checkbox checked={formData.keywords.includes(kw)} onCheckedChange={() => toggleKeyword(kw)} />
                    <span className="text-foreground capitalize">{kw}</span>
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button onClick={handleAnalyze} className="flex-1">Analyze Deal</Button>
            <Button onClick={handleReset} variant="outline">Reset</Button>
          </div>
        </div>

        {/* Results */}
        <div className="space-y-4">
          {result ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground mb-1">80% Qualifier</p>
                    <p className="text-xl font-bold font-mono text-primary">${result.qualifierPrice80.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground mt-1">Initial contact price</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground mb-1">90% Zestimate</p>
                    <div className="flex items-center gap-2">
                      <p className="text-xl font-bold font-mono text-foreground">${result.zestimateCheck90.toLocaleString()}</p>
                      {result.passesZestimateRule ? <CheckCircle2 className="w-4 h-4 text-success" /> : <XCircle className="w-4 h-4 text-destructive" />}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{result.passesZestimateRule ? "Passes rule" : "Fails rule"}</p>
                  </CardContent>
                </Card>
              </div>

              <Card className="border-primary/30">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="w-5 h-5 text-primary" />
                    <p className="text-sm font-semibold text-foreground">Max Allowable Offer (MAO)</p>
                  </div>
                  <p className="text-3xl font-bold font-mono text-primary">${result.mao.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground mt-1">{"(ARV x 70%) - Repairs = MAO"}</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-4 h-4 text-accent" />
                    <p className="text-sm font-semibold text-foreground">Spread Potential</p>
                  </div>
                  <p className={`text-2xl font-bold font-mono ${result.spreadPotential > 10000 ? "text-success" : result.spreadPotential > 5000 ? "text-warning" : "text-destructive"}`}>
                    ${result.spreadPotential.toLocaleString()}
                  </p>
                </CardContent>
              </Card>

              {/* Flow Action Bar */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                <Button size="sm" variant="outline" className="text-xs" onClick={handleSaveDeal} disabled={saved}>
                  <Save className="w-3 h-3 mr-1.5" />{saved ? "Saved" : "Save Deal"}
                </Button>
                <Button size="sm" className="text-xs" onClick={handleSendToQualification}>
                  <UserCheck className="w-3 h-3 mr-1.5" />Qualify Lead
                  <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              </div>

              <Card>
                <CardContent className="p-4">
                  <p className="text-sm font-semibold text-foreground mb-2">Motivation Score</p>
                  <div className="flex items-center gap-3">
                    <span className={`text-2xl font-bold font-mono ${motivationColor(result.motivationScore)}`}>{result.motivationScore}/10</span>
                    <Badge variant="outline" className={`${motivationColor(result.motivationScore)} border-current`}>{motivationLabel(result.motivationScore)}</Badge>
                  </div>
                </CardContent>
              </Card>

              {result.flags.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-semibold text-warning flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />Deal Flags ({result.flags.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-1.5">
                      {result.flags.map((f, i) => (
                        <li key={i} className="flex items-center gap-2 text-xs text-foreground">
                          <AlertTriangle className="w-3 h-3 text-warning shrink-0" />{f}
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
                <Calculator className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Enter property details to see deal analysis</p>
                <p className="text-xs text-muted-foreground mt-1">{"MAO = (ARV x 70%) - Repairs"}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
