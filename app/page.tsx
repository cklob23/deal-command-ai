"use client"

import { useState, useCallback } from "react"
import { AppShell, type PageId } from "@/components/app-shell"
import { Dashboard } from "@/components/pages/dashboard"
import { PropertyFinder } from "@/components/pages/property-finder"
import { PropertyScout } from "@/components/pages/property-scout"
import { MarketAnalyzer } from "@/components/pages/market-analyzer"
import { DealAnalyzer } from "@/components/pages/deal-analyzer"
import { LeadQualificationPage } from "@/components/pages/lead-qualification"
import { LeadPipeline } from "@/components/pages/lead-pipeline"
import { OutreachGenerator } from "@/components/pages/outreach-generator"
import { PartnerProgram } from "@/components/pages/partner-program"
import { DispoBuyerEngine } from "@/components/pages/dispo-buyer-engine"
import { KPITracker } from "@/components/pages/kpi-tracker"
import { useAppStore, type PrefillData } from "@/lib/store"

export default function Home() {
  const [activePage, setActivePage] = useState<PageId>("dashboard")
  const [prefillData, setPrefillData] = useState<PrefillData>({})
  const store = useAppStore()

  const navigateWithData = useCallback((page: PageId, data?: PrefillData) => {
    setPrefillData(data || {})
    setActivePage(page)
  }, [])

  const renderPage = () => {
    switch (activePage) {
      case "dashboard":
        return <Dashboard store={store} onNavigate={navigateWithData} />
      case "finder":
        return <PropertyFinder store={store} onNavigate={navigateWithData} />
      case "scout":
        return <PropertyScout store={store} onNavigate={navigateWithData} />
      case "market":
        return <MarketAnalyzer store={store} onNavigate={navigateWithData} prefillData={prefillData} />
      case "deal":
        return <DealAnalyzer store={store} onNavigate={navigateWithData} prefillData={prefillData} />
      case "qualification":
        return <LeadQualificationPage store={store} onNavigate={navigateWithData} prefillData={prefillData} />
      case "pipeline":
        return <LeadPipeline store={store} onNavigate={navigateWithData} />
      case "outreach":
        return <OutreachGenerator store={store} onNavigate={navigateWithData} prefillData={prefillData} />
      case "partner":
        return <PartnerProgram store={store} onNavigate={navigateWithData} prefillData={prefillData} />
      case "dispo":
        return <DispoBuyerEngine store={store} onNavigate={navigateWithData} prefillData={prefillData} />
      case "kpi":
        return <KPITracker store={store} />
      default:
        return <Dashboard store={store} onNavigate={navigateWithData} />
    }
  }

  return (
    <AppShell activePage={activePage} onNavigate={setActivePage}>
      {renderPage()}
    </AppShell>
  )
}
