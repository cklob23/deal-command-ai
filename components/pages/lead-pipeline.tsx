"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  GitBranch,
  Plus,
  Trash2,
  Phone,
  Mail,
  ArrowRight,
  Filter,
  DollarSign,
  ChevronDown,
  ChevronUp,
  Calculator,
  MessageSquare,
  Megaphone,
  UserCheck,
  ExternalLink,
  Radar,
} from "lucide-react"
import { US_STATES, type PipelineLead } from "@/lib/wholesaling-engine"
import type { AppStore, PrefillData } from "@/lib/store"
import { buildAllListingUrls } from "@/lib/listing-urls"

type PageId = "dashboard" | "finder" | "scout" | "market" | "deal" | "qualification" | "pipeline" | "outreach" | "partner" | "dispo" | "kpi"

interface LeadPipelineProps {
  store: AppStore
  onNavigate: (page: PageId, data?: PrefillData) => void
}

const STATUSES = [
  { value: "new", label: "New", color: "bg-primary/10 text-primary" },
  { value: "contacted", label: "Contacted", color: "bg-primary/20 text-primary" },
  { value: "qualified", label: "Qualified", color: "bg-success/10 text-success" },
  { value: "offer-sent", label: "Offer Sent", color: "bg-warning/10 text-warning" },
  { value: "under-contract", label: "Under Contract", color: "bg-accent/10 text-accent" },
  { value: "dispo", label: "Disposition", color: "bg-chart-5/10 text-chart-5" },
  { value: "closed", label: "Closed", color: "bg-success/20 text-success" },
  { value: "dead", label: "Dead", color: "bg-destructive/10 text-destructive" },
] as const

const LEAD_SOURCES = [
  { value: "zillow", label: "Zillow" },
  { value: "cold-call", label: "Cold Call" },
  { value: "sms", label: "SMS" },
  { value: "facebook", label: "Facebook" },
  { value: "website", label: "Website" },
  { value: "referral", label: "Referral" },
  { value: "other", label: "Other" },
] as const

export function LeadPipeline({ store, onNavigate }: LeadPipelineProps) {
  const leads = store.leads
  const [showAddForm, setShowAddForm] = useState(false)
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [expandedLead, setExpandedLead] = useState<string | null>(null)
  const [newLead, setNewLead] = useState<Partial<PipelineLead>>({
    address: "", city: "", state: "", listPrice: 0, zestimate: 0, askingPrice: 0,
    sellerName: "", sellerPhone: "", sellerEmail: "", leadSource: "zillow", status: "new",
    motivationScore: 5, keywords: [], notes: "", partnerEligible: false,
    arv: 0, repairEstimate: 0, mao: 0, assignmentPrice: 0,
  })

  const addLead = () => {
    if (!newLead.address || !newLead.city) return
    const arv = newLead.arv || 0
    const repairs = newLead.repairEstimate || 0
    store.addLead({
      ...newLead as PipelineLead,
      lastContact: new Date().toISOString(),
      mao: arv > 0 ? (arv * 0.7) - repairs : 0,
    })
    store.bumpKpi("leadsContacted")
    setNewLead({ address: "", city: "", state: "", listPrice: 0, zestimate: 0, askingPrice: 0, sellerName: "", sellerPhone: "", sellerEmail: "", leadSource: "zillow", status: "new", motivationScore: 5, keywords: [], notes: "", partnerEligible: false, arv: 0, repairEstimate: 0, mao: 0, assignmentPrice: 0 })
    setShowAddForm(false)
  }

  const updateLeadStatus = (id: string, status: PipelineLead["status"]) => {
    store.updateLead(id, { status, lastContact: new Date().toISOString() })
    if (status === "under-contract") store.bumpKpi("underContract")
    if (status === "closed") store.bumpKpi("closedDeals")
  }

  const sendToOutreach = (lead: PipelineLead) => {
    onNavigate("outreach", {
      sellerName: lead.sellerName,
      sellerPhone: lead.sellerPhone,
      sellerEmail: lead.sellerEmail,
      address: lead.address,
      city: lead.city,
      state: lead.state,
      listPrice: lead.listPrice,
      zestimate: lead.zestimate,
      askingPrice: lead.askingPrice,
      motivationScore: lead.motivationScore,
      leadId: lead.id,
    })
  }

  const sendToDealAnalyzer = (lead: PipelineLead) => {
    onNavigate("deal", {
      address: lead.address,
      city: lead.city,
      state: lead.state,
      listPrice: lead.listPrice,
      zestimate: lead.zestimate,
      askingPrice: lead.askingPrice,
      arv: lead.arv,
      repairEstimate: lead.repairEstimate,
      motivationScore: lead.motivationScore,
    })
  }

  const sendToDispo = (lead: PipelineLead) => {
    onNavigate("dispo", {
      address: lead.address,
      city: lead.city,
      state: lead.state,
      listPrice: lead.listPrice,
      assignmentPrice: lead.assignmentPrice || lead.mao,
      arv: lead.arv,
      repairEstimate: lead.repairEstimate,
    })
  }

  const sendToQualification = (lead: PipelineLead) => {
    onNavigate("qualification", {
      sellerName: lead.sellerName,
      sellerPhone: lead.sellerPhone,
      sellerEmail: lead.sellerEmail,
      address: lead.address,
      city: lead.city,
      state: lead.state,
      listPrice: lead.listPrice,
      zestimate: lead.zestimate,
      askingPrice: lead.askingPrice,
      motivationScore: lead.motivationScore,
      arv: lead.arv,
      repairEstimate: lead.repairEstimate,
      mao: lead.mao,
    })
  }

  const filteredLeads = filterStatus === "all" ? leads : leads.filter((l) => l.status === filterStatus)

  const statusCounts = STATUSES.reduce((acc, s) => {
    acc[s.value] = leads.filter((l) => l.status === s.value).length
    return acc
  }, {} as Record<string, number>)

  const totalSpread = leads
    .filter((l) => l.status !== "dead")
    .reduce((sum, l) => sum + Math.max(0, (l.mao || 0) - (l.askingPrice || l.listPrice)), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground tracking-tight">Lead Pipeline</h1>
          <p className="text-sm text-muted-foreground mt-1">Track every lead from first contact to close. Click a lead for actions.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => onNavigate("scout")} size="sm" variant="outline"><Radar className="w-4 h-4 mr-1" />AI Scout</Button>
          <Button onClick={() => setShowAddForm(!showAddForm)} size="sm"><Plus className="w-4 h-4 mr-1" />Add Lead</Button>
        </div>
      </div>

      {/* Pipeline Stats */}
      <div className="grid grid-cols-4 lg:grid-cols-8 gap-2">
        {STATUSES.map((s) => (
          <button key={s.value} onClick={() => setFilterStatus(filterStatus === s.value ? "all" : s.value)} className={`p-2 rounded-lg text-center transition-colors ${filterStatus === s.value ? "ring-2 ring-primary" : ""} ${s.color}`}>
            <p className="text-lg font-bold font-mono">{statusCounts[s.value] || 0}</p>
            <p className="text-xs truncate">{s.label}</p>
          </button>
        ))}
      </div>

      {/* Summary */}
      <div className="flex flex-wrap gap-4">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary text-xs">
          <GitBranch className="w-3.5 h-3.5 text-primary" />
          <span className="text-muted-foreground">Total:</span>
          <span className="font-mono font-bold text-foreground">{leads.length}</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary text-xs">
          <DollarSign className="w-3.5 h-3.5 text-success" />
          <span className="text-muted-foreground">Pipeline Spread:</span>
          <span className="font-mono font-bold text-success">${totalSpread.toLocaleString()}</span>
        </div>
        {filterStatus !== "all" && (
          <button onClick={() => setFilterStatus("all")} className="text-xs text-primary hover:underline flex items-center gap-1">
            <Filter className="w-3 h-3" />Clear filter
          </button>
        )}
      </div>

      {/* Add Form */}
      {showAddForm && (
        <Card className="border-primary/30">
          <CardHeader><CardTitle className="text-sm font-semibold text-foreground">Add New Lead</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-1 col-span-2"><Label className="text-xs text-muted-foreground">Address</Label><Input placeholder="123 Main St" value={newLead.address || ""} onChange={(e) => setNewLead({ ...newLead, address: e.target.value })} className="bg-secondary border-border text-foreground text-sm" /></div>
              <div className="space-y-1"><Label className="text-xs text-muted-foreground">City</Label><Input placeholder="Jacksonville" value={newLead.city || ""} onChange={(e) => setNewLead({ ...newLead, city: e.target.value })} className="bg-secondary border-border text-foreground text-sm" /></div>
              <div className="space-y-1"><Label className="text-xs text-muted-foreground">State</Label><Select value={newLead.state || ""} onValueChange={(v) => setNewLead({ ...newLead, state: v })}><SelectTrigger className="bg-secondary border-border text-foreground text-sm"><SelectValue placeholder="State" /></SelectTrigger><SelectContent>{US_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-1"><Label className="text-xs text-muted-foreground">Seller Name</Label><Input placeholder="John Doe" value={newLead.sellerName || ""} onChange={(e) => setNewLead({ ...newLead, sellerName: e.target.value })} className="bg-secondary border-border text-foreground text-sm" /></div>
              <div className="space-y-1"><Label className="text-xs text-muted-foreground">Phone</Label><Input placeholder="555-0123" value={newLead.sellerPhone || ""} onChange={(e) => setNewLead({ ...newLead, sellerPhone: e.target.value })} className="bg-secondary border-border text-foreground text-sm" /></div>
              <div className="space-y-1"><Label className="text-xs text-muted-foreground">Email</Label><Input placeholder="seller@email.com" value={newLead.sellerEmail || ""} onChange={(e) => setNewLead({ ...newLead, sellerEmail: e.target.value })} className="bg-secondary border-border text-foreground text-sm" /></div>
              <div className="space-y-1"><Label className="text-xs text-muted-foreground">Source</Label><Select value={newLead.leadSource || "zillow"} onValueChange={(v) => setNewLead({ ...newLead, leadSource: v as PipelineLead["leadSource"] })}><SelectTrigger className="bg-secondary border-border text-foreground text-sm"><SelectValue /></SelectTrigger><SelectContent>{LEAD_SOURCES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-1"><Label className="text-xs text-muted-foreground">List Price</Label><Input type="number" value={newLead.listPrice || ""} onChange={(e) => setNewLead({ ...newLead, listPrice: Number(e.target.value) })} className="bg-secondary border-border text-foreground text-sm" /></div>
              <div className="space-y-1"><Label className="text-xs text-muted-foreground">Zestimate</Label><Input type="number" value={newLead.zestimate || ""} onChange={(e) => setNewLead({ ...newLead, zestimate: Number(e.target.value) })} className="bg-secondary border-border text-foreground text-sm" /></div>
              <div className="space-y-1"><Label className="text-xs text-muted-foreground">ARV</Label><Input type="number" value={newLead.arv || ""} onChange={(e) => setNewLead({ ...newLead, arv: Number(e.target.value) })} className="bg-secondary border-border text-foreground text-sm" /></div>
              <div className="space-y-1"><Label className="text-xs text-muted-foreground">Repairs</Label><Input type="number" value={newLead.repairEstimate || ""} onChange={(e) => setNewLead({ ...newLead, repairEstimate: Number(e.target.value) })} className="bg-secondary border-border text-foreground text-sm" /></div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between"><Label className="text-xs text-muted-foreground">Motivation</Label><span className="text-xs font-mono font-bold text-foreground">{newLead.motivationScore}/10</span></div>
              <Slider value={[newLead.motivationScore || 5]} onValueChange={([v]) => setNewLead({ ...newLead, motivationScore: v })} min={1} max={10} step={1} />
            </div>
            <div className="space-y-1"><Label className="text-xs text-muted-foreground">Notes</Label><Textarea placeholder="Notes..." value={newLead.notes || ""} onChange={(e) => setNewLead({ ...newLead, notes: e.target.value })} className="bg-secondary border-border text-foreground text-sm min-h-[60px]" /></div>
            <div className="flex gap-2"><Button onClick={addLead} className="flex-1">Add to Pipeline</Button><Button onClick={() => setShowAddForm(false)} variant="outline">Cancel</Button></div>
          </CardContent>
        </Card>
      )}

      {/* Lead Cards */}
      <div className="space-y-3">
        {filteredLeads.length === 0 ? (
          <Card className="flex items-center justify-center min-h-[200px]">
            <CardContent className="text-center py-12">
              <GitBranch className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">{leads.length === 0 ? "No leads yet. Qualify leads or add them manually." : "No leads match this filter."}</p>
            </CardContent>
          </Card>
        ) : (
          filteredLeads.map((lead) => {
            const expanded = expandedLead === lead.id
            const statusConfig = STATUSES.find((s) => s.value === lead.status)
            const spread = (lead.mao || 0) - (lead.askingPrice || lead.listPrice)

            return (
              <Card key={lead.id} className="overflow-hidden">
                <button className="w-full text-left p-4 flex items-center gap-4" onClick={() => setExpandedLead(expanded ? null : lead.id)}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-foreground truncate">{lead.address}</p>
                      <Badge className={`text-xs ${statusConfig?.color || ""}`}>{statusConfig?.label}</Badge>
                      {lead.partnerEligible && <Badge variant="outline" className="text-xs text-success border-success/30">Partner</Badge>}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span>{lead.city}, {lead.state}</span>
                      <span className="font-mono">${(lead.listPrice || 0).toLocaleString()}</span>
                      {spread > 0 && <span className="text-success font-mono">+${spread.toLocaleString()}</span>}
                      <span>{lead.leadSource}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {lead.sellerPhone && <a href={`tel:${lead.sellerPhone}`} onClick={(e) => e.stopPropagation()} className="p-1.5 rounded bg-secondary hover:bg-primary/10 transition-colors"><Phone className="w-3.5 h-3.5 text-primary" /></a>}
                    {lead.sellerEmail && <a href={`mailto:${lead.sellerEmail}`} onClick={(e) => e.stopPropagation()} className="p-1.5 rounded bg-secondary hover:bg-primary/10 transition-colors"><Mail className="w-3.5 h-3.5 text-primary" /></a>}
                    {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </button>

                {expanded && (
                  <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                      <div className="p-2 rounded bg-secondary"><span className="text-muted-foreground">List Price</span><p className="font-mono font-bold text-foreground">${(lead.listPrice || 0).toLocaleString()}</p></div>
                      <div className="p-2 rounded bg-secondary"><span className="text-muted-foreground">Zestimate</span><p className="font-mono font-bold text-foreground">${(lead.zestimate || 0).toLocaleString()}</p></div>
                      <div className="p-2 rounded bg-secondary"><span className="text-muted-foreground">MAO</span><p className="font-mono font-bold text-primary">${(lead.mao || 0).toLocaleString()}</p></div>
                      <div className="p-2 rounded bg-secondary"><span className="text-muted-foreground">Motivation</span><p className={`font-mono font-bold ${lead.motivationScore >= 7 ? "text-success" : lead.motivationScore >= 4 ? "text-warning" : "text-destructive"}`}>{lead.motivationScore}/10</p></div>
                    </div>
                    {lead.sellerName && <p className="text-xs text-muted-foreground">Seller: <span className="text-foreground font-medium">{lead.sellerName}</span> {lead.sellerPhone && `| ${lead.sellerPhone}`} {lead.sellerEmail && `| ${lead.sellerEmail}`}</p>}
                    {lead.notes && <p className="text-xs text-muted-foreground p-2 rounded bg-secondary">{lead.notes}</p>}
                    {/* View Listing Links (address lookup) */}
                    {lead.address && (() => {
                      const urls = buildAllListingUrls(lead.address, lead.city, lead.state)
                      return (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">View Listing:</span>
                          <a href={urls.zillow} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-primary/10 text-primary hover:bg-primary/20 font-medium transition-colors">
                            <ExternalLink className="w-2.5 h-2.5" />Zillow
                          </a>
                          <a href={urls.redfin} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-destructive/10 text-destructive hover:bg-destructive/20 font-medium transition-colors">
                            <ExternalLink className="w-2.5 h-2.5" />Redfin
                          </a>
                          <a href={urls.realtor} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-accent/10 text-accent hover:bg-accent/20 font-medium transition-colors">
                            <ExternalLink className="w-2.5 h-2.5" />Realtor
                          </a>
                          <a href={urls.google} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-foreground/5 text-foreground hover:bg-foreground/10 font-medium transition-colors">
                            <ExternalLink className="w-2.5 h-2.5" />Google
                          </a>
                        </div>
                      )
                    })()}
                    {/* Smart Search Links (comps) */}
                    {lead.city && lead.state && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Search Comps:</span>
                        <a
                          href={`https://www.zillow.com/${lead.city.toLowerCase().replace(/\s+/g, "-")}-${lead.state.toLowerCase()}/?searchQueryState=${encodeURIComponent(JSON.stringify({ filterState: { price: { min: Math.round((lead.listPrice || 0) * 0.7), max: Math.round((lead.listPrice || 0) * 1.3) }, doz: { value: "30" } } }))}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-secondary text-primary hover:bg-primary/10 transition-colors"
                        >
                          <ExternalLink className="w-2.5 h-2.5" />Zillow Comps
                        </a>
                        <a
                          href={`https://www.redfin.com/city/${lead.city.replace(/\s+/g, "-")}/${lead.state}/filter/property-type=house,max-price=${Math.round((lead.listPrice || 0) * 1.3)},min-price=${Math.round((lead.listPrice || 0) * 0.7)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-secondary text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          <ExternalLink className="w-2.5 h-2.5" />Redfin Comps
                        </a>
                        <a
                          href={`https://www.realtor.com/realestateandhomes-search/${lead.city.replace(/\s+/g, "-")}_${lead.state}/type-single-family-home/price-${Math.round((lead.listPrice || 0) * 0.7)}-${Math.round((lead.listPrice || 0) * 1.3)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-secondary text-accent hover:bg-accent/10 transition-colors"
                        >
                          <ExternalLink className="w-2.5 h-2.5" />Realtor Comps
                        </a>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <Select value={lead.status} onValueChange={(v) => updateLeadStatus(lead.id, v as PipelineLead["status"])}>
                        <SelectTrigger className="w-[160px] bg-secondary border-border text-xs h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>{STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                      </Select>
                      <Button size="sm" variant="outline" className="text-xs h-8" onClick={() => sendToOutreach(lead)}><MessageSquare className="w-3 h-3 mr-1" />Outreach</Button>
                      <Button size="sm" variant="outline" className="text-xs h-8" onClick={() => sendToDealAnalyzer(lead)}><Calculator className="w-3 h-3 mr-1" />Analyze</Button>
                      <Button size="sm" variant="outline" className="text-xs h-8" onClick={() => sendToQualification(lead)}><UserCheck className="w-3 h-3 mr-1" />Qualify</Button>
                      {(lead.status === "under-contract" || lead.status === "dispo") && (
                        <Button size="sm" variant="outline" className="text-xs h-8 text-accent border-accent/30" onClick={() => sendToDispo(lead)}><Megaphone className="w-3 h-3 mr-1" />Dispo</Button>
                      )}
                      <Button size="sm" variant="ghost" className="text-xs h-8 text-destructive hover:text-destructive" onClick={() => store.removeLead(lead.id)}><Trash2 className="w-3 h-3 mr-1" />Remove</Button>
                    </div>
                  </div>
                )}
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}
