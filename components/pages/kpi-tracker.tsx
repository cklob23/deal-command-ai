"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import {
  BarChart3,
  Target,
  Zap,
  UserCheck,
  Send,
  DollarSign,
  Users,
  RotateCcw,
  Phone,
  FileCheck,
  Handshake,
  TrendingUp,
  CheckSquare,
  Square,
  Award,
} from "lucide-react"
import type { AppStore } from "@/lib/store"

interface KPITrackerProps {
  store: AppStore
}

const DAILY_TARGETS = {
  marketsTested: { target: 3, label: "Markets Tested", icon: Target, color: "text-primary", bg: "bg-primary/10" },
  dealsAnalyzed: { target: 10, label: "Deals Analyzed", icon: Zap, color: "text-accent", bg: "bg-accent/10" },
  leadsContacted: { target: 15, label: "Leads Contacted", icon: Phone, color: "text-chart-3", bg: "bg-chart-3/10" },
  qualifiedLeads: { target: 5, label: "Qualified Leads", icon: UserCheck, color: "text-success", bg: "bg-success/10" },
  offersSent: { target: 3, label: "Offers Sent", icon: Send, color: "text-primary", bg: "bg-primary/10" },
  underContract: { target: 1, label: "Under Contract", icon: FileCheck, color: "text-accent", bg: "bg-accent/10" },
  partnerSubmissions: { target: 2, label: "Partner Submissions", icon: Handshake, color: "text-warning", bg: "bg-warning/10" },
  outreachSent: { target: 20, label: "Outreach Sent", icon: Send, color: "text-chart-5", bg: "bg-chart-5/10" },
  buyerContacts: { target: 10, label: "Buyer Contacts", icon: Users, color: "text-primary", bg: "bg-primary/10" },
  estimatedSpread: { target: 25000, label: "Est. Spread ($)", icon: DollarSign, color: "text-success", bg: "bg-success/10", isCurrency: true },
  closedDeals: { target: 1, label: "Closed Deals", icon: Award, color: "text-success", bg: "bg-success/10" },
} as const

type KpiField = keyof typeof DAILY_TARGETS

const CHECKLIST_ITEMS = [
  { key: "zillow-alerts", label: "Check Zillow saved search alerts", step: "1" },
  { key: "new-leads", label: "Run new leads through Deal Analyzer", step: "2" },
  { key: "qualify-leads", label: "Qualify top leads (80% test, motivation)", step: "3" },
  { key: "send-outreach", label: "Send outreach (calls, SMS, emails)", step: "4" },
  { key: "follow-ups", label: "Follow up with pending conversations", step: "5" },
  { key: "submit-partner", label: "Submit qualified leads to Partner Program", step: "6" },
  { key: "dispo-deals", label: "Market under-contract deals to buyers", step: "7" },
  { key: "update-pipeline", label: "Update pipeline statuses & notes", step: "8" },
  { key: "add-buyers", label: "Add new buyer contacts to list", step: "9" },
  { key: "log-kpis", label: "Log all KPIs and review progress", step: "10" },
]

export function KPITracker({ store }: KPITrackerProps) {
  const { kpiData, checklist, bumpKpi, setKpiField, toggleChecklistItem } = store

  const kpiEntries = Object.entries(DAILY_TARGETS) as [KpiField, (typeof DAILY_TARGETS)[KpiField]][]

  const totalProgress = kpiEntries.reduce((sum, [key, config]) => {
    const value = kpiData[key] as number
    return sum + Math.min(100, (value / config.target) * 100)
  }, 0) / kpiEntries.length

  const completedChecklist = CHECKLIST_ITEMS.filter((item) => checklist.items[item.key]).length
  const checklistProgress = (completedChecklist / CHECKLIST_ITEMS.length) * 100

  // Summary stats from store
  const totalLeads = store.leads.length
  const activeLeads = store.leads.filter((l) => !["dead", "closed"].includes(l.status)).length
  const totalDeals = store.savedDeals.length
  const totalMarkets = store.savedMarkets.length
  const totalBuyers = store.savedBuyers.length
  const pipelineValue = store.leads.reduce((s, l) => s + (l.assignmentPrice - l.mao), 0)

  const handleReset = () => {
    // Reset KPIs for new day
    Object.keys(DAILY_TARGETS).forEach((key) => {
      setKpiField(key as KpiField, 0)
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground tracking-tight">
            KPI Tracker
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Live metrics from your pipeline activity
          </p>
        </div>
        <Button onClick={handleReset} variant="outline" size="sm" className="text-xs">
          <RotateCcw className="w-3 h-3 mr-1.5" />
          New Day Reset
        </Button>
      </div>

      {/* Lifetime Stats Banner */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Saved Markets", value: totalMarkets, icon: Target, color: "text-primary" },
          { label: "Saved Deals", value: totalDeals, icon: Zap, color: "text-accent" },
          { label: "Total Leads", value: totalLeads, icon: Users, color: "text-chart-3" },
          { label: "Active Leads", value: activeLeads, icon: UserCheck, color: "text-success" },
          { label: "Buyers", value: totalBuyers, icon: Handshake, color: "text-warning" },
          { label: "Pipeline Value", value: `$${pipelineValue > 0 ? pipelineValue.toLocaleString() : "0"}`, icon: TrendingUp, color: "text-success" },
        ].map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.label}>
              <CardContent className="p-3 flex items-center gap-3">
                <Icon className={`w-4 h-4 ${stat.color} shrink-0`} />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground truncate">{stat.label}</p>
                  <p className="text-lg font-bold font-mono text-foreground">{stat.value}</p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Overall Daily Progress */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-foreground">Daily Target Progress</p>
            <Badge variant={totalProgress >= 100 ? "default" : "secondary"} className={totalProgress >= 100 ? "bg-success text-success-foreground" : ""}>
              {Math.round(totalProgress)}%
            </Badge>
          </div>
          <Progress value={totalProgress} className="h-3" />
          <p className="text-xs text-muted-foreground mt-2">
            {totalProgress >= 100
              ? "All daily targets met! Outstanding work."
              : totalProgress >= 75
                ? "Almost there - strong day."
                : totalProgress >= 50
                  ? "Over halfway. Stay locked in."
                  : "Keep grinding - every action counts."}
          </p>
        </CardContent>
      </Card>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {kpiEntries.map(([key, config]) => {
          const Icon = config.icon
          const value = kpiData[key] as number
          const isCurrency = "isCurrency" in config && config.isCurrency
          const progress = Math.min(100, (value / config.target) * 100)
          const met = value >= config.target

          return (
            <Card key={key}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xs font-semibold text-muted-foreground flex items-center gap-2">
                    <div className={`flex items-center justify-center w-6 h-6 rounded ${config.bg}`}>
                      <Icon className={`w-3 h-3 ${config.color}`} />
                    </div>
                    {config.label}
                  </CardTitle>
                  {met && (
                    <Badge className="bg-success/20 text-success text-[10px] px-1.5 py-0">MET</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-end justify-between">
                  <span className="text-2xl font-bold font-mono text-foreground">
                    {isCurrency ? `$${value.toLocaleString()}` : value}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    / {isCurrency ? `$${config.target.toLocaleString()}` : config.target}
                  </span>
                </div>
                <Progress value={progress} className="h-1.5" />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 text-xs h-8"
                    onClick={() => bumpKpi(key, isCurrency ? 5000 : 1)}
                  >
                    +{isCurrency ? "$5k" : "1"}
                  </Button>
                  <Input
                    type="number"
                    value={value || ""}
                    onChange={(e) => setKpiField(key, Number(e.target.value) || 0)}
                    className="w-24 text-xs h-8 bg-secondary border-border text-foreground text-center font-mono"
                  />
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Daily Checklist */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
              <BarChart3 className="w-4 h-4 text-primary" />
              Daily Workflow Checklist
            </CardTitle>
            <Badge variant="secondary" className="font-mono text-xs">
              {completedChecklist}/{CHECKLIST_ITEMS.length}
            </Badge>
          </div>
          <Progress value={checklistProgress} className="h-1.5 mt-2" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {CHECKLIST_ITEMS.map((item) => {
              const checked = checklist.items[item.key] || false
              return (
                <button
                  key={item.key}
                  onClick={() => toggleChecklistItem(item.key)}
                  className={`flex items-start gap-3 p-3 rounded-lg text-left transition-all ${
                    checked
                      ? "bg-success/10 border border-success/20"
                      : "bg-secondary hover:bg-secondary/80 border border-transparent"
                  }`}
                >
                  {checked ? (
                    <CheckSquare className="w-4 h-4 text-success shrink-0 mt-0.5" />
                  ) : (
                    <Square className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0">
                    <p className={`text-xs font-semibold ${checked ? "text-success line-through" : "text-foreground"}`}>
                      Step {item.step}
                    </p>
                    <p className={`text-xs ${checked ? "text-success/70" : "text-muted-foreground"}`}>
                      {item.label}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
