"use client"

import { useState } from "react"
import {
  LayoutDashboard,
  MapPin,
  Calculator,
  UserCheck,
  MessageSquare,
  Megaphone,
  BarChart3,
  Menu,
  X,
  Crosshair,
  Handshake,
  Search,
  GitBranch,
  Radar,
} from "lucide-react"
import { cn } from "@/lib/utils"

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "finder", label: "Property Finder", icon: Search },
  { id: "scout", label: "AI Property Scout", icon: Radar },
  { id: "market", label: "Market Analyzer", icon: MapPin },
  { id: "deal", label: "Deal Analyzer", icon: Calculator },
  { id: "qualification", label: "Lead Qualification", icon: UserCheck },
  { id: "pipeline", label: "Lead Pipeline", icon: GitBranch },
  { id: "outreach", label: "Outreach Scripts", icon: MessageSquare },
  { id: "partner", label: "Partner Program", icon: Handshake },
  { id: "dispo", label: "Dispo & Buyers", icon: Megaphone },
  { id: "kpi", label: "KPI Tracker", icon: BarChart3 },
] as const

export type PageId = (typeof NAV_ITEMS)[number]["id"]

interface AppShellProps {
  activePage: PageId
  onNavigate: (page: PageId) => void
  children: React.ReactNode
}

export function AppShell({ activePage, onNavigate, children }: AppShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-card border-r border-border">
        <div className="flex items-center gap-2 p-6 border-b border-border">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary">
            <Crosshair className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-base font-bold text-foreground tracking-tight">DealCommand</h1>
            <p className="text-xs text-muted-foreground">Wholesaling OS</p>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const active = activePage === item.id
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={cn(
                  "flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {item.label}
              </button>
            )
          })}
        </nav>
        <div className="p-4 border-t border-border">
          <p className="text-xs text-muted-foreground">REI GameChangers</p>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="flex flex-col flex-1 overflow-hidden">
        <header className="flex items-center justify-between lg:hidden px-4 py-3 bg-card border-b border-border">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary">
              <Crosshair className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
            <span className="text-sm font-bold text-foreground">DealCommand</span>
          </div>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-muted-foreground hover:text-foreground"
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </header>

        {/* Mobile Menu Overlay */}
        {mobileMenuOpen && (
          <div className="lg:hidden absolute inset-0 z-50 bg-background/95 backdrop-blur-sm">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary">
                  <Crosshair className="w-3.5 h-3.5 text-primary-foreground" />
                </div>
                <span className="text-sm font-bold text-foreground">DealCommand</span>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 text-muted-foreground hover:text-foreground"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="p-4 space-y-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon
                const active = activePage === item.id
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      onNavigate(item.id)
                      setMobileMenuOpen(false)
                    }}
                    className={cn(
                      "flex items-center gap-3 w-full px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                      active
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                    )}
                  >
                    <Icon className="w-5 h-5 shrink-0" />
                    {item.label}
                  </button>
                )
              })}
            </nav>
          </div>
        )}

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
