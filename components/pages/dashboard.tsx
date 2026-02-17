"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  MapPin,
  Calculator,
  UserCheck,
  MessageSquare,
  Megaphone,
  BarChart3,
  ArrowRight,
  TrendingUp,
  Target,
  Zap,
  Search,
  GitBranch,
  Handshake,
  Sparkles,
  DollarSign,
  Users,
  Mountain,
  Home,
} from "lucide-react"
import { useState, useEffect } from "react"
import type { AppStore, PrefillData } from "@/lib/store"

type PageId = "dashboard" | "finder" | "scout" | "market" | "deal" | "qualification" | "pipeline" | "outreach" | "partner" | "dispo" | "kpi"

interface DashboardProps {
  store: AppStore
  onNavigate: (page: PageId, data?: PrefillData) => void
}

const WORKFLOW_STEPS = [
  { step: 1, title: "Find Properties", description: "AI search strategy with Zillow filters, zip codes & daily routine", icon: Search, page: "finder" as PageId, color: "text-primary", badge: "AI" },
  { step: 2, title: "Analyze Market", description: "Evaluate MSA, price, DOM, pending ratio. Auto-fills from Finder.", icon: MapPin, page: "market" as PageId, color: "text-accent", badge: "AI" },
  { step: 3, title: "Analyze Deal", description: "MAO, 80% qualifier, spread. Auto-fills from Market Analyzer.", icon: Calculator, page: "deal" as PageId, color: "text-primary", badge: "AI" },
  { step: 4, title: "Qualify Lead", description: "Partner Program compliance check. Auto-fills from Deal Analyzer.", icon: UserCheck, page: "qualification" as PageId, color: "text-success" },
  { step: 5, title: "Track Pipeline", description: "Manage leads from contact to close. Actions flow to all modules.", icon: GitBranch, page: "pipeline" as PageId, color: "text-primary" },
  { step: 6, title: "Generate Outreach", description: "AI scripts with Gmail & SMS. Auto-fills from Pipeline.", icon: MessageSquare, page: "outreach" as PageId, color: "text-warning", badge: "AI" },
  { step: 7, title: "Partner Program", description: "Full scripts, qualification rules, and submission checklist.", icon: Handshake, page: "partner" as PageId, color: "text-accent" },
  { step: 8, title: "Dispo & Buyers", description: "AI marketing, ROI projections, buyer targeting. Auto-fills from Pipeline.", icon: Megaphone, page: "dispo" as PageId, color: "text-success", badge: "AI" },
  { step: 9, title: "Track KPIs", description: "Auto-tracked metrics from every action. Persists across sessions.", icon: BarChart3, page: "kpi" as PageId, color: "text-warning" },
]

export function Dashboard({ store, onNavigate }: DashboardProps) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  const { savedMarkets, savedDeals, leads, savedBuyers, kpiData } = store

  const activePipelineLeads = leads.filter((l) => l.status !== "dead" && l.status !== "closed")
  const totalSpread = savedDeals.reduce((sum, d) => sum + Math.max(0, d.spread), 0)
  const recentLeads = leads.slice(0, 5)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground tracking-tight text-balance">Deal Command Center</h1>
          <Badge className="bg-primary/10 text-primary border-0 text-xs"><Sparkles className="w-3 h-3 mr-1" />AI-Powered</Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Automated wholesaling pipeline. Every step saves data and auto-fills the next step.
        </p>
      </div>

      {/* Live Stats from Store */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        {[
          { label: mounted ? `Markets (${savedMarkets.filter(m => m.searchType !== "land").length}H / ${savedMarkets.filter(m => m.searchType === "land").length}L)` : "Markets", value: mounted ? savedMarkets.length : 0, icon: Target, color: "text-primary", bg: "bg-primary/10", page: "finder" as PageId },
          { label: "Saved Deals", value: mounted ? savedDeals.length : 0, icon: Calculator, color: "text-accent", bg: "bg-accent/10", page: "deal" as PageId },
          { label: "Pipeline Leads", value: mounted ? activePipelineLeads.length : 0, icon: GitBranch, color: "text-success", bg: "bg-success/10", page: "pipeline" as PageId },
          { label: "Qualified", value: mounted ? kpiData.qualifiedLeads : 0, icon: UserCheck, color: "text-success", bg: "bg-success/10", page: "qualification" as PageId },
          { label: "Buyers", value: mounted ? savedBuyers.length : 0, icon: Users, color: "text-primary", bg: "bg-primary/10", page: "dispo" as PageId },
          { label: "Est. Spread", value: mounted ? `$${totalSpread.toLocaleString()}` : "$0", icon: TrendingUp, color: "text-warning", bg: "bg-warning/10", page: "kpi" as PageId },
        ].map((stat) => {
          const Icon = stat.icon
          return (
            <button key={stat.label} onClick={() => onNavigate(stat.page)} className="text-left">
              <Card className="h-full hover:border-primary/50 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`flex items-center justify-center w-9 h-9 rounded-lg ${stat.bg}`}>
                      <Icon className={`w-4 h-4 ${stat.color}`} />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{stat.label}</p>
                      <p className="text-xl font-bold font-mono text-foreground">{stat.value}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </button>
          )
        })}
      </div>

      {/* Recent Pipeline Activity */}
      {recentLeads.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" />Recent Pipeline Activity
              </CardTitle>
              <button onClick={() => onNavigate("pipeline")} className="text-xs text-primary hover:underline flex items-center gap-1">
                View all <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentLeads.map((lead) => (
                <button
                  key={lead.id}
                  onClick={() => onNavigate("pipeline")}
                  className="w-full text-left flex items-center justify-between p-2.5 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${
                      lead.status === "closed" ? "bg-success" :
                      lead.status === "dead" ? "bg-destructive" :
                      lead.status === "under-contract" ? "bg-accent" :
                      lead.status === "qualified" ? "bg-success" :
                      "bg-primary"
                    }`} />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{lead.address}</p>
                      <p className="text-xs text-muted-foreground">{lead.city}, {lead.state}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className="text-xs">{lead.status}</Badge>
                    <span className="text-xs font-mono text-muted-foreground">${(lead.listPrice || 0).toLocaleString()}</span>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Saved Markets Overview */}
      {savedMarkets.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                <MapPin className="w-4 h-4 text-accent" />Saved Markets
              </CardTitle>
              <button onClick={() => onNavigate("finder")} className="text-xs text-primary hover:underline flex items-center gap-1">
                Find more <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {savedMarkets.map((m) => (
                <button
                  key={m.id}
                  onClick={() => m.searchType === "land"
                    ? onNavigate("finder")
                    : onNavigate("market", { city: m.city, state: m.state, msaPopulation: m.msaPopulation, cityPopulation: m.cityPopulation, medianPrice: m.medianPrice, daysOnMarket: m.daysOnMarket, pendingRatio: m.pendingRatio })
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-xs hover:bg-primary/10 transition-colors"
                >
                  {m.searchType === "land" ? (
                    <Mountain className="w-3 h-3 text-accent" />
                  ) : (
                    <Home className="w-3 h-3 text-primary" />
                  )}
                  <span className="font-medium text-foreground">{m.city}, {m.state}</span>
                  <Badge variant="outline" className={`text-[10px] px-1 py-0 ${m.searchType === "land" ? "border-accent/40 text-accent" : "border-primary/40 text-primary"}`}>
                    {m.searchType === "land" ? "Land" : "Houses"}
                  </Badge>
                  <Badge variant="outline" className={`text-[10px] px-1 py-0 ${m.verdict === "ideal" ? "text-success border-success/30" : m.verdict === "borderline" ? "text-warning border-warning/30" : "text-destructive border-destructive/30"}`}>
                    {m.score}
                  </Badge>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Workflow Steps */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3">Pipeline Workflow</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {WORKFLOW_STEPS.map((step) => {
            const Icon = step.icon
            return (
              <button key={step.page} onClick={() => onNavigate(step.page)} className="text-left group">
                <Card className="h-full transition-colors hover:border-primary/50 group-focus-visible:ring-2 group-focus-visible:ring-ring">
                  <CardHeader className="pb-2 pt-4 px-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs font-mono border-border text-muted-foreground">Step {step.step}</Badge>
                        {step.badge && <Badge className="text-xs bg-primary/10 text-primary border-0"><Sparkles className="w-3 h-3 mr-0.5" />{step.badge}</Badge>}
                      </div>
                      <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
                        <Icon className={`w-4 h-4 ${step.color}`} />
                      </div>
                      <CardTitle className="text-sm font-semibold text-foreground">{step.title}</CardTitle>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{step.description}</p>
                  </CardContent>
                </Card>
              </button>
            )
          })}
        </div>
      </div>

      {/* Quick Reference */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-foreground">Zillow Strategy Quick Reference</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-secondary">
              <p className="font-semibold text-foreground mb-1">80% Qualifier</p>
              <p className="text-muted-foreground leading-relaxed">Text/email at 70-80% of list price to test if agent will play ball. This is NOT your offer.</p>
            </div>
            <div className="p-3 rounded-lg bg-secondary">
              <p className="font-semibold text-foreground mb-1">MAO Formula</p>
              <p className="text-muted-foreground leading-relaxed">{"MAO = (ARV x 70%) - Repair Costs. Maximum allowable offer based on after-repair value."}</p>
            </div>
            <div className="p-3 rounded-lg bg-secondary">
              <p className="font-semibold text-foreground mb-1">Partner Rules</p>
              <p className="text-muted-foreground leading-relaxed">{"Asking <= 90% Zestimate. Not FSBO/MLS. Not in OR, IL, SC, PA. Seller wants to sell."}</p>
            </div>
            <div className="p-3 rounded-lg bg-secondary">
              <p className="font-semibold text-foreground mb-1">Data Persists</p>
              <p className="text-muted-foreground leading-relaxed">All markets, deals, leads, buyers & KPIs save automatically and auto-fill downstream steps.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
